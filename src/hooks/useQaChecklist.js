import { useCallback, useEffect, useRef, useState } from "react";
import {
  readWorkbook,
  importWpChecklist,
  importProcessChecklist,
  buildVersion,
  confirmItem,
  unconfirmItem,
} from "aspice-harness/qa";
import { idbGet, idbSet } from "../utils/idb";
import { useAuth } from "../auth/useAuth";

const STORAGE_KEY = "aspice_qa_checklists";

const emptyState = () => ({
  activeVersionId: null,
  versions: [],
  mappingOverrides: { sheets: {}, processNames: {} },
});

function normalizeState(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  return {
    activeVersionId: raw.activeVersionId ?? null,
    versions: Array.isArray(raw.versions) ? raw.versions : [],
    mappingOverrides: {
      sheets: { ...(raw.mappingOverrides?.sheets ?? {}) },
      processNames: { ...(raw.mappingOverrides?.processNames ?? {}) },
    },
  };
}

// kind -> [items field, key field]
const KIND = {
  wp: ["wpItems", "checkId"],
  process: ["processItems", "itemId"],
};

const NOT_LOADED = "체크리스트를 아직 불러오지 못했습니다. 잠시 후 다시 시도하세요.";

const cleanStr = (v) => String(v ?? "").trim();

// Confirm input: deep copy, trim strings, drop blank rules / locations.
function cleanCriteria(kind, criteria) {
  const c = structuredClone(criteria ?? {});
  if (kind === "wp") {
    c.criteria = (c.criteria ?? [])
      .map((r) => ({ ...r, text: cleanStr(r?.text) }))
      .filter((r) => r.text !== "");
    c.targetLocations = (c.targetLocations ?? []).map(cleanStr).filter(Boolean);
  }
  for (const k of ["relatedBPs", "linkedWpCheckIds"]) {
    if (Array.isArray(c[k])) c[k] = c[k].map(cleanStr).filter(Boolean);
  }
  return c;
}

const activeOf = (s) => s.versions.find((v) => v.id === s.activeVersionId) ?? null;

const mapItems = (version, kind, key, fn) => {
  const [field, keyField] = KIND[kind];
  return { ...version, [field]: version[field].map((it) => (it[keyField] === key ? fn(it) : it)) };
};

/**
 * QA Audit checklist store: one set per browser (IndexedDB key
 * aspice_qa_checklists), shared by every signed-in user.
 *
 * lastImport is { summary, issues } or null; summary is null when the import
 * produced no new version (format errors only), then only issues are set.
 */
export function useQaChecklist() {
  const { user } = useAuth();
  const userName = user?.name ?? null;
  const [state, setState] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastImport, setLastImport] = useState(null);
  // Latest committed state, readable synchronously from handlers.
  const stateRef = useRef(state);
  // True once the stored set has been read. Mutators are blocked until then so
  // the empty initial state can never overwrite the stored PC-shared set.
  const loadedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    idbGet(STORAGE_KEY)
      .then((stored) => {
        if (!alive) return;
        // No mutator can have run yet (loadedRef is false), so this is safe.
        const s = normalizeState(stored);
        stateRef.current = s;
        setState(s);
        loadedRef.current = true;
      })
      .catch((e) => {
        if (alive) setError(`체크리스트를 불러오지 못했습니다: ${e?.message || e}`);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Apply next state, persist it, and roll back if the write fails. The
  // rollback only happens if no later commit replaced this state meanwhile.
  const commit = useCallback(async (next) => {
    if (!loadedRef.current) {
      setError(NOT_LOADED);
      return false;
    }
    const prev = stateRef.current;
    stateRef.current = next;
    setState(next);
    try {
      await idbSet(STORAGE_KEY, next);
      setError(null);
      return true;
    } catch (e) {
      if (stateRef.current === next) {
        stateRef.current = prev;
        setState(prev);
      }
      setError(`저장하지 못했습니다: ${e?.message || e}`);
      return false;
    }
  }, []);

  // Replace the active version via fn(version) -> version.
  const updateActive = useCallback(
    (fn) => {
      const s = stateRef.current;
      const cur = activeOf(s);
      if (!cur) return Promise.resolve(false);
      const nextV = fn(cur);
      return commit({ ...s, versions: s.versions.map((v) => (v.id === cur.id ? nextV : v)) });
    },
    [commit]
  );

  const importFiles = useCallback(
    async ({ wpFile, processFile } = {}) => {
      if (!wpFile && !processFile) return;
      if (!loadedRef.current) {
        setError(NOT_LOADED);
        return;
      }
      try {
        // Read the files first; everything after the awaits is synchronous up
        // to commit(), so state/overrides are read fresh and cannot go stale.
        const wpBuf = wpFile ? await wpFile.arrayBuffer() : null;
        const procBuf = processFile ? await processFile.arrayBuffer() : null;
        const s = stateRef.current;
        const ov = s.mappingOverrides;
        const run = (file, buf, importer, opt) => {
          const res = importer(readWorkbook(buf), { fileName: file.name, ...opt });
          res.fileName = file.name;
          return res;
        };
        const wp = wpFile
          ? run(wpFile, wpBuf, importWpChecklist, { sheetOverrides: ov.sheets })
          : null;
        const process = processFile
          ? run(processFile, procBuf, importProcessChecklist, { processNameOverrides: ov.processNames })
          : null;
        const issues = [...(wp?.issues ?? []), ...(process?.issues ?? [])];
        // Format errors only (no items): keep the active version, just report.
        const wpOk = wp && wp.items.length > 0;
        const procOk = process && process.items.length > 0;
        if (!wpOk && !procOk) {
          setLastImport({ summary: null, issues });
          return;
        }
        const { version, summary } = buildVersion({
          prev: activeOf(s),
          wp: wpOk ? wp : null,
          process: procOk ? process : null,
          mappingOverrides: ov,
          now: new Date().toISOString(),
          user: userName,
        });
        // Keep issues of a file that failed while the other one succeeded.
        version.importIssues = issues;
        // Version numbers keep growing even when an older version is active.
        version.version = Math.max(0, ...s.versions.map((v) => v.version)) + 1;
        const ok = await commit({
          ...s,
          activeVersionId: version.id,
          versions: [...s.versions, version],
        });
        if (ok) {
          setLastImport({ summary, issues });
          setError(null);
        }
      } catch (e) {
        setError(`가져오기에 실패했습니다: ${e?.message || e}`);
      }
    },
    [commit, userName]
  );

  const setActiveVersion = useCallback(
    (id) => {
      const s = stateRef.current;
      if (!s.versions.some((v) => v.id === id)) return Promise.resolve(false);
      return commit({ ...s, activeVersionId: id });
    },
    [commit]
  );

  const exportVersionJson = useCallback((id) => {
    const v = stateRef.current.versions.find((x) => x.id === id);
    return v ? JSON.stringify(v, null, 2) : "";
  }, []);

  const setSheetProcess = useCallback(
    (sheetName, processId) => {
      const s = stateRef.current;
      const cur = activeOf(s);
      const next = {
        ...s,
        mappingOverrides: {
          ...s.mappingOverrides,
          sheets: { ...s.mappingOverrides.sheets, [sheetName]: processId },
        },
      };
      if (cur) {
        const nv = {
          ...cur,
          wpItems: cur.wpItems.map((w) => (w.sheet === sheetName ? { ...w, processId } : w)),
        };
        next.versions = s.versions.map((v) => (v.id === cur.id ? nv : v));
      }
      return commit(next);
    },
    [commit]
  );

  const setProcessNameMapping = useCallback(
    (name, processId) => {
      const s = stateRef.current;
      const cur = activeOf(s);
      const next = {
        ...s,
        mappingOverrides: {
          ...s.mappingOverrides,
          processNames: { ...s.mappingOverrides.processNames, [name]: processId },
        },
      };
      if (cur) {
        const nv = {
          ...cur,
          processItems: cur.processItems.map((p) =>
            p.processName === name ? { ...p, processId } : p
          ),
        };
        next.versions = s.versions.map((v) => (v.id === cur.id ? nv : v));
      }
      return commit(next);
    },
    [commit]
  );

  const updateItem = useCallback(
    (kind, key, patch) => updateActive((v) => mapItems(v, kind, key, (it) => ({ ...it, ...patch }))),
    [updateActive]
  );

  const confirm = useCallback(
    (kind, key, criteria) => {
      const clean = cleanCriteria(kind, criteria);
      const now = new Date().toISOString();
      return updateActive((v) =>
        mapItems(v, kind, key, (it) => confirmItem(it, clean, { user: userName, now }))
      );
    },
    [updateActive, userName]
  );

  const unconfirm = useCallback(
    (kind, key) => updateActive((v) => mapItems(v, kind, key, unconfirmItem)),
    [updateActive]
  );

  // results: Record<itemKey, criteria>. pending -> drafted; other statuses stay.
  const applyDrafts = useCallback(
    (kind, results) => {
      const [field, keyField] = KIND[kind];
      return updateActive((v) => ({
        ...v,
        [field]: v[field].map((it) => {
          const draft = results?.[it[keyField]];
          if (!draft) return it;
          return { ...it, draft, status: it.status === "pending" ? "drafted" : it.status };
        }),
      }));
    },
    [updateActive]
  );

  return {
    loading,
    error,
    state,
    active: activeOf(state),
    lastImport,
    importFiles,
    setActiveVersion,
    exportVersionJson,
    setSheetProcess,
    setProcessNameMapping,
    updateItem,
    confirm,
    unconfirm,
    applyDrafts,
  };
}
