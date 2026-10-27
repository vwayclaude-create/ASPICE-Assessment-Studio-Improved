// Browser-safe: no node:* imports.
// AI draft generation (spec 7): prompts, response sanitizing, batched execution.
import { bpCatalog, isValidBpId } from "./processNameMap.js";

const SEVERITIES = ["상", "중", "하"];

const bpLines = (bps) =>
  bps.length
    ? bps.map((bp) => `- ${bp.id} ${bp.title}: ${bp.description ?? ""}`).join("\n")
    : "(이 프로세스에는 관련 BP가 없습니다. relatedBPs는 빈 배열로 둡니다.)";

// Spec 7.3: same processId items + confirmed items of other processes that carry a BP of this process
export function wpCandidatesFor(version, processId, processes) {
  void processes;
  const prefix = `${processId}.`;
  return (version?.wpItems ?? [])
    .filter((it) =>
      it.processId === processId ||
      (it.status === "confirmed" &&
        (it.confirmed?.relatedBPs ?? []).some((bp) => String(bp).startsWith(prefix))))
    .map((it) => ({ checkId: it.checkId, workProduct: it.workProduct, question: it.question }));
}

export function buildWpDraftPrompt({ workProduct, processId, bps, items }) {
  const system = [
    "당신은 ASPICE 4.0 품질보증(QA) 심사 전문가입니다.",
    "산출물 체크리스트의 각 질문에 대해, 심사자가 산출물에서 검증할 수 있는 판정 기준을 작성합니다.",
    "- criteria: 검증 가능한 문장 1~5개.",
    "- 질문이 부정형이라 '예'가 위반을 뜻하면 polarity=negative, 그 외에는 positive. (예: '오타가 존재하는가?'는 negative)",
    "- targetLocations: 산출물에서 확인할 예상 절·표 이름.",
    "- relatedBPs: 반드시 아래 제공된 BP 목록의 ID만 사용. 관련 없으면 빈 배열.",
    "- 항목에 근거(엑셀의 BP/OII 표기)가 있으면 relatedBPs를 고르는 힌트로만 쓰고, 목록 밖 ID는 쓰지 않습니다.",
    "- severity: 상, 중, 하 중 하나.",
    "- rationale: 한 문장.",
    "입력의 모든 id에 대해 하나씩 답하고, JSON만 출력합니다.",
    '형식: {"items":[{"id":"...","criteria":["..."],"polarity":"positive|negative","targetLocations":["..."],"relatedBPs":["MAN.3.BP5"],"severity":"상|중|하","rationale":"..."}]}',
  ].join("\n");
  const context = `산출물: ${workProduct}\n프로세스: ${processId}\n\nBP 목록:\n${bpLines(bps)}`;
  const task =
    "다음 항목의 판정 기준 초안을 작성하세요.\n" +
    items.map((it) =>
      `- id: ${it.id}${it.area ? ` / 영역: ${it.area}` : ""}${it.basis ? ` / 근거: ${it.basis}` : ""} / question: ${it.question}`
    ).join("\n");
  return { system, context, task };
}

export function buildProcessDraftPrompt({ processId, bps, items, candidates }) {
  const system = [
    "당신은 ASPICE 4.0 품질보증(QA) 심사 전문가입니다.",
    "프로세스 심사 항목마다, 그 항목을 판정할 때 근거가 되는 산출물 체크 항목을 후보 중에서 고릅니다.",
    "- linkedWpCheckIds: 반드시 후보 목록의 checkId만 사용.",
    "- relatedBPs: 반드시 제공된 BP 목록의 ID만 사용. 관련 없으면 빈 배열.",
    "- 항목에 참고(엑셀의 BP 표기)가 있으면 relatedBPs를 고르는 힌트로만 쓰고, 목록 밖 ID는 쓰지 않습니다.",
    "- rationale: 한 문장.",
    "입력의 모든 id에 대해 하나씩 답하고, JSON만 출력합니다.",
    '형식: {"items":[{"id":"...","linkedWpCheckIds":["..."],"relatedBPs":["MAN.3.BP5"],"rationale":"..."}]}',
  ].join("\n");
  const cand = candidates.length
    ? candidates.map((c) => `- ${c.checkId} [${c.workProduct}] ${c.question}`).join("\n")
    : "(후보 없음)";
  const context = `프로세스: ${processId}\n\nBP 목록:\n${bpLines(bps)}\n\n산출물 항목 후보:\n${cand}`;
  const task =
    "다음 프로세스 심사 항목의 초안을 작성하세요.\n" +
    items.map((it) => `- id: ${it.id}${it.basis ? ` / 참고: ${it.basis}` : ""} / question: ${it.question}`).join("\n");
  return { system, context, task };
}

const strList = (v) =>
  (Array.isArray(v) ? v : []).map((s) => String(s ?? "").trim()).filter(Boolean);
const uniq = (a) => [...new Set(a)];

// With processId: only that process's BP catalog (spec 7.2); else any valid BP.
function keepBps(list, processes, processId) {
  const ids = uniq(strList(list));
  if (processId === undefined) return ids.filter((bp) => isValidBpId(processes, bp));
  const allowed = new Set(bpCatalog(processes, processId).map((bp) => bp.id));
  return ids.filter((bp) => allowed.has(bp));
}

export function sanitizeWpDraft(raw, { processes, processId }) {
  if (!raw || typeof raw !== "object") return null;
  const texts = strList(raw.criteria);
  if (texts.length === 0) return null;
  return {
    criteria: texts.map((text, i) => ({ id: `${raw.id}-${i + 1}`, text })),
    polarity: raw.polarity === "negative" ? "negative" : "positive",
    targetLocations: strList(raw.targetLocations),
    relatedBPs: keepBps(raw.relatedBPs, processes, processId),
    severity: SEVERITIES.includes(raw.severity) ? raw.severity : "중",
    rationale: String(raw.rationale ?? ""),
  };
}

export function sanitizeProcessDraft(raw, { processes, candidateIds, processId }) {
  const r = raw ?? {};
  return {
    linkedWpCheckIds: uniq(strList(r.linkedWpCheckIds)).filter((id) => candidateIds.has(id)),
    relatedBPs: keepBps(r.relatedBPs, processes, processId),
    aggregation: "default",
    rationale: String(r.rationale ?? ""),
  };
}

// Split into batches of one (workProduct, processId) each, at most batchSize entries.
function makeBatches(groups, kind, batchSize) {
  const buckets = new Map();
  for (const g of groups) {
    const k = kind === "wp" ? `${g.workProduct ?? ""}\u0000${g.processId}` : g.processId;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(g);
  }
  const batches = [];
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i += batchSize) batches.push(list.slice(i, i + batchSize));
  }
  return batches;
}

const msg = (e) => String(e?.message ?? e);

export async function generateDrafts({ client, kind, groups, processes, batchSize = 20 }) {
  const results = {};
  const failures = {};
  const batches = makeBatches(groups, kind, batchSize);

  await Promise.all(batches.map(async (batch) => {
    const first = batch[0];
    const bps = bpCatalog(processes, first.processId);
    const items = batch.map((g) => ({ id: g.key, area: g.area, basis: g.basis ?? "", question: g.question }));
    let candidates = [];
    if (kind === "process") {
      const seen = new Map();
      for (const g of batch) for (const c of g.candidates ?? []) seen.set(c.checkId, c);
      candidates = [...seen.values()];
    }
    const prompt = kind === "wp"
      ? buildWpDraftPrompt({ workProduct: first.workProduct, processId: first.processId, bps, items })
      : buildProcessDraftPrompt({ processId: first.processId, bps, items, candidates });

    let parsed;
    try {
      ({ parsed } = await client.generateJson(prompt));
    } catch (e) {
      for (const g of batch) failures[g.key] = msg(e);
      return;
    }
    const byId = new Map((Array.isArray(parsed?.items) ? parsed.items : []).map((it) => [String(it?.id), it]));
    const candidateIds = new Set(candidates.map((c) => c.checkId));
    for (const g of batch) {
      const rawItem = byId.get(g.key);
      if (!rawItem) { failures[g.key] = "응답 없음"; continue; }
      if (kind === "wp") {
        const d = sanitizeWpDraft({ ...rawItem, id: g.key }, { processes, processId: first.processId });
        if (d) results[g.key] = d; else failures[g.key] = "판정 기준이 비어 있음";
      } else {
        results[g.key] = sanitizeProcessDraft(rawItem, { processes, candidateIds, processId: first.processId });
      }
    }
  }));

  return { results, failures };
}
