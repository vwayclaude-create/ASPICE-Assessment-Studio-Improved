import { useCallback, useEffect, useRef, useState } from "react";
import { processes } from "aspice-harness/spec/all";
import { wpCandidatesFor } from "aspice-harness/qa";

const ENDPOINT = "/api/qa-draft";
const CHUNK = 200; // server limit per request
const NEED_PROCESS = "프로세스 지정 필요";

const KINDS = {
  wp: { field: "wpItems", key: "checkId" },
  process: { field: "processItems", key: "itemId" },
};

// scope: "all" | { sheet } | { processId } | { keys }
function inScope(kind, item, scope) {
  if (scope === "all" || !scope) return true;
  if (scope.keys) return new Set(scope.keys).has(item[KINDS[kind].key]);
  if (scope.sheet !== undefined) return kind === "wp" && item.sheet === scope.sheet;
  if (scope.processId !== undefined) return item.processId === scope.processId;
  return true;
}

/**
 * AI draft runner for QA Audit. Builds flat per-item entries, splits them into
 * requests of at most 200, POSTs them in order and applies every successful
 * chunk right away via qa.applyDrafts (so progress survives a later failure).
 *
 * run({ kind: "wp"|"process"|"both", scope, includeConfirmed = false })
 */
export function useQaDraft(qa) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState({});
  const aliveRef = useRef(true);
  const runningRef = useRef(false);
  const qaRef = useRef(qa);

  useEffect(() => {
    qaRef.current = qa;
  });

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const run = useCallback(async ({ kind = "both", scope = "all", includeConfirmed = false } = {}) => {
    const version = qaRef.current.active;
    if (!version || runningRef.current) return;
    runningRef.current = true;
    const safe = (fn) => aliveRef.current && fn();
    const fail = {};
    const kinds = kind === "both" ? ["wp", "process"] : [kind];

    const jobs = [];
    for (const k of kinds) {
      const { field, key } = KINDS[k];
      const entries = [];
      for (const it of version[field]) {
        if (!inScope(k, it, scope)) continue;
        if (!includeConfirmed && it.status === "confirmed") continue;
        if (!it.processId) {
          fail[it[key]] = NEED_PROCESS;
          continue;
        }
        const e = { key: it[key], processId: it.processId, question: it.question };
        if (k === "wp") {
          e.workProduct = it.workProduct;
          e.area = it.area;
        } else {
          e.area = it.phase;
          e.candidates = wpCandidatesFor(version, it.processId, processes);
        }
        entries.push(e);
      }
      // Same process / work product next to each other so server batches fill up.
      entries.sort((a, b) =>
        `${a.processId}|${a.workProduct ?? ""}`.localeCompare(`${b.processId}|${b.workProduct ?? ""}`)
      );
      for (let i = 0; i < entries.length; i += CHUNK) jobs.push({ kind: k, groups: entries.slice(i, i + CHUNK) });
    }

    const total = jobs.reduce((n, j) => n + j.groups.length, 0);
    safe(() => {
      setRunning(true);
      setFailures({ ...fail });
      setProgress({ done: 0, total });
    });

    let done = 0;
    let fatal = null;
    try {
      for (const job of jobs) {
        if (fatal) {
          for (const g of job.groups) fail[g.key] = fatal;
          continue;
        }
        try {
          const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: job.kind, groups: job.groups }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            const m = [body.error, body.detail].filter(Boolean).join(": ") || `HTTP ${res.status}`;
            fatal = m;
            for (const g of job.groups) fail[g.key] = m;
            continue;
          }
          Object.assign(fail, body.failures ?? {});
          const results = body.results ?? {};
          if (Object.keys(results).length) {
            const ok = await qaRef.current.applyDrafts(job.kind, results);
            if (!ok) for (const k of Object.keys(results)) fail[k] = "초안을 저장하지 못했습니다";
          }
        } catch (e) {
          const m = `요청 실패: ${e?.message || e}`;
          fatal = m;
          for (const g of job.groups) fail[g.key] = m;
        }
        done += job.groups.length;
        safe(() => {
          setProgress({ done, total });
          setFailures({ ...fail });
        });
      }
    } finally {
      runningRef.current = false;
      safe(() => {
        setFailures({ ...fail });
        setProgress({ done: total, total });
        setRunning(false);
      });
    }
  }, []);

  return { running, progress, failures, run };
}
