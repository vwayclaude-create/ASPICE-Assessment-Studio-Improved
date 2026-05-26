// Default rule book for the "Custom" scorer engine.
//
// A rule book is { version, useAutoFallback, rules[] }. Each rule is a
// keyword/WPID matcher the user can add, edit, toggle, or delete in the UI;
// the harness CustomScorer (packages/harness/src/evaluators/customScorer.js)
// scores BP/WP/GP by the weighted fraction of satisfied rules.
//
// The defaults below are intentionally a small, illustrative starter set so a
// fresh user can see the rule shape and edit from there — not an exhaustive
// PAM rule library.

let seq = 0;

/**
 * Build a new rule with sane defaults. `partial` overrides any field.
 * Used by the UI for "룰 추가"; default rules below carry stable hand-set ids.
 */
export function makeRule(partial = {}) {
  return {
    id: `r_${Date.now().toString(36)}_${(seq++).toString(36)}`,
    enabled: true,
    label: "새 룰",
    appliesTo: "any", // "bp" | "wp" | "gp" | "any"
    process: "*", // "*" = 모든 프로세스, 또는 "SYS.2" 등
    match: "any", // "any" = 키워드 1개라도, "all" = 전부
    keywords: [],
    weight: 1, // 0.1 ‥ 5
    ...partial,
  };
}

/**
 * Build a new user-defined Base Practice. Custom BPs are *added* to a process's
 * BP list at evaluation time — they appear alongside the canonical PAM BPs and
 * count toward PA 1.1's average. Each carries its own keyword/match rule.
 */
export function makeCustomBP(partial = {}) {
  return {
    id: `bpx_${Date.now().toString(36)}_${(seq++).toString(36)}`,
    processId: "SYS.2",
    title: "사용자 정의 BP",
    intent: "",
    keywords: [],
    match: "any", // "any" | "all"
    weight: 1,
    ...partial,
  };
}

export const RULE_BOOK_VERSION = 2;

export const DEFAULT_RULE_BOOK = {
  version: RULE_BOOK_VERSION,
  // When no custom rule covers a given BP/WP/GP, fall back to the offline
  // auto-keyword rule scorer instead of scoring it 0.
  useAutoFallback: true,
  // User-defined Base Practices. Each is appended to its process's BP list so
  // it shows up alongside the canonical PAM BPs and is scored by the custom
  // engine's keyword matcher.
  customBPs: [],
  rules: [
    {
      id: "seed_requirement",
      enabled: true,
      label: "요구사항 정의",
      appliesTo: "bp",
      process: "*",
      match: "any",
      keywords: ["requirement", "요구사항", "specification", "명세", "shall"],
      weight: 1.5,
    },
    {
      id: "seed_traceability",
      enabled: true,
      label: "추적성 / 트레이스 매트릭스",
      appliesTo: "any",
      process: "*",
      match: "any",
      keywords: ["traceability", "추적성", "trace matrix", "추적 매트릭스", "trace"],
      weight: 1.5,
    },
    {
      id: "seed_verification",
      enabled: true,
      label: "검증 / 테스트 / 검토",
      appliesTo: "bp",
      process: "*",
      match: "any",
      keywords: ["test", "테스트", "verification", "검증", "review", "검토"],
      weight: 1,
    },
    {
      id: "seed_config_mgmt",
      enabled: true,
      label: "형상관리 / 베이스라인",
      appliesTo: "gp",
      process: "*",
      match: "any",
      keywords: ["configuration management", "형상관리", "baseline", "베이스라인", "version control"],
      weight: 1,
    },
    {
      id: "seed_change_request",
      enabled: true,
      label: "변경관리 / 변경요청",
      appliesTo: "any",
      process: "*",
      match: "any",
      keywords: ["change request", "변경요청", "change management", "변경 관리", "CR-"],
      weight: 1,
    },
  ],
};

/** A defensive deep copy of the defaults — never hand out the shared object. */
export function freshDefaultRuleBook() {
  return JSON.parse(JSON.stringify(DEFAULT_RULE_BOOK));
}
