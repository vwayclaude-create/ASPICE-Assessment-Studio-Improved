import { useCallback, useEffect, useState } from "react";
import { idbGet, idbSet } from "../utils/idb";
import {
  DEFAULT_RULE_BOOK,
  RULE_BOOK_VERSION,
  freshDefaultRuleBook,
  makeRule,
  makeCustomBP,
} from "../data/customRuleDefaults";

const STORAGE_KEY = "aspice_custom_rules";

const APPLIES_TO = new Set(["bp", "wp", "gp", "any"]);

/** Normalise an untrusted rule book (IndexedDB blob / imported JSON file). */
export function sanitizeRuleBook(raw) {
  const rb = raw && typeof raw === "object" ? raw : {};
  const rules = (Array.isArray(rb.rules) ? rb.rules : [])
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const keywords = (Array.isArray(r.keywords) ? r.keywords : [])
        .map((k) => String(k).trim())
        .filter(Boolean)
        .slice(0, 40);
      if (!keywords.length) return null;
      const weight = Number(r.weight);
      return {
        ...makeRule(),
        ...r,
        label: String(r.label || "이름 없는 룰").slice(0, 80),
        appliesTo: APPLIES_TO.has(r.appliesTo) ? r.appliesTo : "any",
        process: typeof r.process === "string" && r.process ? r.process : "*",
        match: r.match === "all" ? "all" : "any",
        enabled: r.enabled !== false,
        keywords,
        weight: Number.isFinite(weight)
          ? Math.max(0.1, Math.min(5, Math.round(weight * 10) / 10))
          : 1,
      };
    })
    .filter(Boolean)
    .slice(0, 200);
  const customBPs = (Array.isArray(rb.customBPs) ? rb.customBPs : [])
    .map((b) => {
      if (!b || typeof b !== "object") return null;
      const keywords = (Array.isArray(b.keywords) ? b.keywords : [])
        .map((k) => String(k).trim())
        .filter(Boolean)
        .slice(0, 40);
      if (!keywords.length) return null;
      const weight = Number(b.weight);
      return {
        ...makeCustomBP(),
        ...b,
        processId: typeof b.processId === "string" && b.processId ? b.processId : "SYS.2",
        title: String(b.title || "사용자 정의 BP").slice(0, 120),
        intent: String(b.intent || "").slice(0, 400),
        match: b.match === "all" ? "all" : "any",
        keywords,
        weight: Number.isFinite(weight)
          ? Math.max(0.1, Math.min(5, Math.round(weight * 10) / 10))
          : 1,
      };
    })
    .filter(Boolean)
    .slice(0, 80);
  return {
    version: RULE_BOOK_VERSION,
    useAutoFallback: rb.useAutoFallback !== false,
    rules,
    customBPs,
  };
}

/**
 * Manages the user's custom-scorer rule book: loads it from IndexedDB on
 * mount, persists every change, and exposes add/edit/toggle/delete helpers.
 *
 * The rule book is sent to /api/project (and /api/analyze) as `customRules`
 * whenever the selected engine is "custom".
 */
export function useCustomRules() {
  const [ruleBook, setRuleBook] = useState(DEFAULT_RULE_BOOK);
  // Gate persistence until the initial IndexedDB read resolves, otherwise the
  // first render would overwrite a stored book with the defaults.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    idbGet(STORAGE_KEY)
      .then((stored) => {
        if (alive && stored && Array.isArray(stored.rules)) {
          setRuleBook(sanitizeRuleBook(stored));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    idbSet(STORAGE_KEY, ruleBook).catch(() => {});
  }, [ruleBook, loaded]);

  const addRule = useCallback(
    (partial) =>
      setRuleBook((b) => ({ ...b, rules: [...b.rules, makeRule(partial)] })),
    []
  );

  const updateRule = useCallback(
    (id, patch) =>
      setRuleBook((b) => ({
        ...b,
        rules: b.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
    []
  );

  const toggleRule = useCallback(
    (id) =>
      setRuleBook((b) => ({
        ...b,
        rules: b.rules.map((r) =>
          r.id === id ? { ...r, enabled: !r.enabled } : r
        ),
      })),
    []
  );

  const deleteRule = useCallback(
    (id) =>
      setRuleBook((b) => ({ ...b, rules: b.rules.filter((r) => r.id !== id) })),
    []
  );

  const setUseAutoFallback = useCallback(
    (value) => setRuleBook((b) => ({ ...b, useAutoFallback: !!value })),
    []
  );

  const replaceRuleBook = useCallback(
    (book) => setRuleBook(sanitizeRuleBook(book)),
    []
  );

  const resetToDefaults = useCallback(
    () => setRuleBook(freshDefaultRuleBook()),
    []
  );

  const addCustomBP = useCallback(
    (partial) =>
      setRuleBook((b) => ({
        ...b,
        customBPs: [...(b.customBPs || []), makeCustomBP(partial)],
      })),
    []
  );

  const updateCustomBP = useCallback(
    (id, patch) =>
      setRuleBook((b) => ({
        ...b,
        customBPs: (b.customBPs || []).map((bp) =>
          bp.id === id ? { ...bp, ...patch } : bp
        ),
      })),
    []
  );

  const deleteCustomBP = useCallback(
    (id) =>
      setRuleBook((b) => ({
        ...b,
        customBPs: (b.customBPs || []).filter((bp) => bp.id !== id),
      })),
    []
  );

  return {
    ruleBook,
    addRule,
    updateRule,
    toggleRule,
    deleteRule,
    setUseAutoFallback,
    replaceRuleBook,
    resetToDefaults,
    addCustomBP,
    updateCustomBP,
    deleteCustomBP,
  };
}
