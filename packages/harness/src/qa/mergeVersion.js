// Browser-safe: no node:* imports.
// New-version merge, carry-over and link re-check (spec 6.4).

const sameText = (a, b) => String(a ?? "") === String(b ?? "");

// Carried item = new import's Excel fields + previous version's QA work.
function carry(next, prev, status) {
  return {
    ...next,
    draft: prev.draft ?? null,
    confirmed: prev.confirmed ?? null,
    status,
    confirmedBy: prev.confirmedBy ?? null,
    confirmedAt: prev.confirmedAt ?? null,
  };
}

const emptyCounts = () => ({ carried: 0, stale: 0, added: 0, removed: 0 });

function mergeWp(prevItems, newItems) {
  const counts = emptyCounts();
  const prevById = new Map(prevItems.map((p) => [p.checkId, p]));
  const used = new Set();
  const items = newItems.map((n) => {
    const p = prevById.get(n.checkId);
    if (!p || used.has(p.checkId)) { counts.added++; return n; }
    used.add(p.checkId);
    if (sameText(p.question, n.question)) { counts.carried++; return carry(n, p, p.status); }
    counts.stale++;
    return carry(n, p, "stale");
  });
  counts.removed = prevItems.filter((p) => !used.has(p.checkId)).length;
  return { items, counts };
}

// Match order (spec 6.4 step 3): (processId, question) -> excelId -> order within processId.
function mergeProcess(prevItems, newItems) {
  const counts = emptyCounts();
  const usedPrev = new Set();
  const match = new Array(newItems.length).fill(null); // { prev, stale }

  newItems.forEach((n, i) => {
    const p = prevItems.find((q) => !usedPrev.has(q) && q.processId === n.processId && sameText(q.question, n.question));
    if (p) { usedPrev.add(p); match[i] = { prev: p, stale: false }; }
  });
  newItems.forEach((n, i) => {
    if (match[i] || !n.excelId) return;
    const p = prevItems.find((q) => !usedPrev.has(q) && q.excelId && q.excelId === n.excelId);
    if (p) { usedPrev.add(p); match[i] = { prev: p, stale: true }; }
  });
  const groupOf = (list, pid) => list.filter((x) => x.processId === pid);
  newItems.forEach((n, i) => {
    if (match[i]) return;
    const idx = groupOf(newItems, n.processId).indexOf(n);
    const p = groupOf(prevItems, n.processId)[idx];
    if (p && !usedPrev.has(p)) { usedPrev.add(p); match[i] = { prev: p, stale: true }; }
  });

  const items = newItems.map((n, i) => {
    const m = match[i];
    if (!m) { counts.added++; return n; }
    if (m.stale) { counts.stale++; return carry(n, m.prev, "stale"); }
    counts.carried++;
    return carry(n, m.prev, m.prev.status);
  });
  counts.removed = prevItems.filter((p) => !usedPrev.has(p)).length;
  return { items, counts };
}

// Missing / stale links of a confirmed process item. Falls back to draft links for display.
export function missingLinks(version, processItem) {
  const linked = (processItem?.confirmed ?? processItem?.draft)?.linkedWpCheckIds ?? [];
  const have = new Set((version?.wpItems ?? []).map((w) => w.checkId));
  return linked.filter((id) => !have.has(id));
}

// Spec 6.4 step 4. Never edits the link arrays.
export function relinkCheck(version) {
  const wpById = new Map((version.wpItems ?? []).map((w) => [w.checkId, w]));
  const processItems = (version.processItems ?? []).map((p) => {
    if (p.status !== "confirmed") return p;
    const linked = p.confirmed?.linkedWpCheckIds ?? [];
    const broken = linked.some((id) => !wpById.has(id) || wpById.get(id).status === "stale");
    return broken ? { ...p, status: "stale" } : p;
  });
  return { ...version, processItems };
}

export function buildVersion({ prev = null, wp = null, process = null, mappingOverrides = null, now, user }) {
  if (!wp && !process) throw new Error("buildVersion: wp와 process 중 하나는 필요합니다");
  const at = now ?? new Date().toISOString();

  const w = wp ? mergeWp(prev?.wpItems ?? [], wp.items) : { items: prev?.wpItems ?? [], counts: emptyCounts() };
  const p = process
    ? mergeProcess(prev?.processItems ?? [], process.items)
    : { items: prev?.processItems ?? [], counts: emptyCounts() };

  const sources = [];
  for (const [kind, res] of [["wp", wp], ["process", process]]) {
    if (res) {
      sources.push({
        kind,
        fileName: res.fileName ?? res.issues?.[0]?.file ?? "",
        sheetNames: res.sheetNames ?? [],
        importedAt: at,
      });
    } else {
      const old = (prev?.sources ?? []).find((s) => s.kind === kind);
      if (old) sources.push({ ...old });
    }
  }

  let version = {
    id: globalThis.crypto.randomUUID(),
    version: (prev?.version ?? 0) + 1,
    createdAt: at,
    createdBy: user ?? null,
    sources,
    wpItems: w.items,
    processItems: p.items,
    importIssues: [...(wp?.issues ?? []), ...(process?.issues ?? [])],
    mappingOverrides: mappingOverrides ?? null,
  };

  const before = new Map(version.processItems.map((x) => [x.itemId, x.status]));
  version = relinkCheck(version);
  // Items newly staled by the link re-check move from carried to stale in the summary.
  for (const x of version.processItems) {
    if (x.status === "stale" && before.get(x.itemId) !== "stale") {
      if (p.counts.carried > 0) p.counts.carried--;
      p.counts.stale++;
    }
  }
  return { version, summary: { wp: w.counts, process: p.counts } };
}
