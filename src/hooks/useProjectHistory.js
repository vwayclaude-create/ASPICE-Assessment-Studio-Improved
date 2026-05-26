import { useStorageHistory } from "./useStorageHistory";

const STORAGE_KEY = "aspice_project_history";
const MAX_ENTRIES = 30;

// IDB has plenty of headroom, but we still drop debug-only `rawLlmResponse`
// payloads (only present on rejected LLM calls) to keep entries lean.
const slimEntryForStorage = (entry) => {
  if (!entry || !entry.verdict || !Array.isArray(entry.verdict.processes)) return entry;
  const dropRaw = (results) =>
    Array.isArray(results)
      ? results.map((r) => {
          if (!r || typeof r !== "object" || !("rawLlmResponse" in r)) return r;
          const slim = { ...r };
          delete slim.rawLlmResponse;
          return slim;
        })
      : results;
  return {
    ...entry,
    verdict: {
      ...entry.verdict,
      processes: entry.verdict.processes.map((p) => ({
        ...p,
        bps: dropRaw(p.bps),
        wps: dropRaw(p.wps),
        pas: Array.isArray(p.pas)
          ? p.pas.map((pa) => ({ ...pa, gps: dropRaw(pa.gps) }))
          : p.pas,
      })),
    },
  };
};

export const useProjectHistory = () =>
  useStorageHistory({
    storageKey: STORAGE_KEY,
    maxEntries: MAX_ENTRIES,
    backend: "idb",
    slimEntry: slimEntryForStorage,
    logTag: "aspice/projectHistory",
  });

export const buildProjectHistoryEntry = ({
  verdict,
  artifacts,
  processIds,
  targetLevel,
  engines,
  engine,
  isSample = false,
}) => {
  const enginesList = Array.isArray(engines) && engines.length
    ? [...engines]
    : engine
      ? [engine]
      : [];
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    artifactNames: (artifacts || []).map((a) => a.name),
    artifactCount: artifacts?.length ?? 0,
    processIds: [...(processIds || [])],
    targetLevel,
    engines: enginesList,
    // Keep `engine` populated with the first engine for legacy history readers.
    engine: enginesList[0],
    verdict,
    isSample,
  };
};
