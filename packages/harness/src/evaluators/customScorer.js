/**
 * CustomScorer — offline scorer driven by a user-authored rule book.
 *
 * Unlike the RuleScorer (which auto-extracts keywords from the PAM spec and is
 * not user-editable), the CustomScorer scores each BP/WP/GP against a flat list
 * of rules the user maintains in the UI. Each rule is a keyword/WPID matcher:
 *
 *   {
 *     id, enabled, label,
 *     appliesTo : "bp" | "wp" | "gp" | "any",   // which practice kind it scores
 *     process   : "*" | "SYS.2" | ...,          // restrict to one process, or all
 *     match     : "any" | "all",                // satisfied if ANY / ALL keywords hit
 *     keywords  : ["traceability", "추적성", "17-50", ...],
 *     weight    : 0.1 .. 5,                      // relative contribution
 *   }
 *
 * Scoring a practice:
 *   1. Collect enabled rules whose `appliesTo` matches the practice kind (or
 *      "any") and whose `process` matches the current process (or "*").
 *   2. If no rule applies and `useAutoFallback` is on, defer to the supplied
 *      `fallback` scorer (the offline RuleScorer) — so a sparse rule book still
 *      yields sensible grades for practices the user hasn't written a rule for.
 *   3. Otherwise score = round(100 × Σweight(satisfied) / Σweight(applicable)).
 *
 * PA 1.1 / GP 1.1.1 ("achieve the intent of the base practices") is BP-derived,
 * not keyword-derived, so its GP score always defers to the fallback, which
 * simply averages the (custom-scored) BP results.
 *
 * The scorer is deterministic, offline, and never fabricates evidence.
 * @type {import("./scorer.js").Scorer}
 */

const APPLIES_TO = new Set(["bp", "wp", "gp", "any"]);
const MAX_RULES = 200;
const MAX_KEYWORDS = 40;

/** Clamp a rule weight into the supported 0.1‥5 range (one decimal). */
function clampWeight(w) {
  const n = Number(w);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0.1, Math.min(5, Math.round(n * 10) / 10));
}

/** Normalise one rule; returns null when it carries no usable keyword. */
function sanitizeRule(r) {
  if (!r || typeof r !== "object") return null;
  const keywords = (Array.isArray(r.keywords) ? r.keywords : [])
    .map((k) => String(k).trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);
  if (!keywords.length) return null;
  return {
    id: String(r.id || `r_${Math.random().toString(36).slice(2, 10)}`),
    enabled: r.enabled !== false,
    label: String(r.label || "이름 없는 룰").slice(0, 80),
    appliesTo: APPLIES_TO.has(r.appliesTo) ? r.appliesTo : "any",
    process: typeof r.process === "string" && r.process ? r.process : "*",
    match: r.match === "all" ? "all" : "any",
    keywords,
    weight: clampWeight(r.weight),
  };
}

/**
 * Normalise an untrusted rule book (e.g. from a request body / localStorage)
 * into a safe shape. Exported so the API layer can sanitise before scoring.
 */
export function sanitizeRuleBook(raw) {
  const rb = raw && typeof raw === "object" ? raw : {};
  const rules = (Array.isArray(rb.rules) ? rb.rules : [])
    .map(sanitizeRule)
    .filter(Boolean)
    .slice(0, MAX_RULES);
  return {
    version: 1,
    // Default ON: a sparse rule book still produces sensible grades.
    useAutoFallback: rb.useAutoFallback !== false,
    rules,
  };
}

/** Compact snippet around the first occurrence of `needle` in `text`. */
function snippet(text, needle, radius = 240) {
  if (!text) return String(needle);
  const i = text.toLowerCase().indexOf(String(needle).toLowerCase());
  if (i < 0) return String(needle);
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + String(needle).length + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

/**
 * Find the first artifact each keyword of `rule` hits. A keyword matches when
 * it appears in an artifact's filename/body (case-insensitive substring) OR
 * exactly equals one of the artifact's detected WP-ID tags — so a keyword like
 * "17-50" doubles as a WPID rule.
 */
function ruleHits(rule, artifacts) {
  const hits = [];
  for (const kw of rule.keywords) {
    const needle = kw.toLowerCase();
    for (const a of artifacts) {
      const hay = (a.name + " " + (a.text ?? "")).toLowerCase();
      const wpidMatch = (a.wpidCandidates ?? []).some(
        (w) => String(w).toLowerCase() === needle
      );
      if (wpidMatch || hay.includes(needle)) {
        hits.push({
          keyword: kw,
          artifactName: a.name,
          quote: wpidMatch
            ? `WP ${kw} (으)로 태깅된 산출물`
            : snippet(a.text ?? a.name, kw),
        });
        break; // first artifact hit per keyword is enough
      }
    }
  }
  return hits;
}

/** Score a non-empty set of applicable rules against the artifacts. */
function scoreByRules(rules, artifacts) {
  let totalWeight = 0;
  let satisfiedWeight = 0;
  const evidence = [];
  const gaps = [];

  for (const rule of rules) {
    totalWeight += rule.weight;
    const hits = ruleHits(rule, artifacts);
    const matchedKw = new Set(hits.map((h) => h.keyword));
    const satisfied =
      rule.match === "all"
        ? matchedKw.size === rule.keywords.length
        : matchedKw.size >= 1;

    if (satisfied) {
      satisfiedWeight += rule.weight;
      for (const h of hits.slice(0, 2)) {
        evidence.push({
          artifactName: h.artifactName,
          quote: h.quote,
          location: `사용자 룰: ${rule.label}`,
        });
      }
    } else {
      const missing = rule.keywords.filter((k) => !matchedKw.has(k));
      const detail =
        rule.match === "all"
          ? `누락 키워드: ${missing.slice(0, 6).join(", ")}`
          : `매칭 키워드 없음: ${rule.keywords.slice(0, 6).join(", ")}`;
      gaps.push(`사용자 룰 미충족 — ${rule.label} (${detail})`);
    }
  }

  const scorePercent = totalWeight
    ? Math.max(0, Math.min(100, Math.round((satisfiedWeight / totalWeight) * 100)))
    : 0;
  return { scorePercent, evidence, gaps, contextConsistency: { status: "unknown", note: "" } };
}

const METHOD_BY_KIND = { bp: "scoreBP", wp: "scoreWP", gp: "scoreGP" };

/**
 * @param {{
 *   ruleBook: object,
 *   fallback?: import("./scorer.js").Scorer
 * }} opts
 * @returns {import("./scorer.js").Scorer}
 */
export function createCustomScorer({ ruleBook, fallback } = {}) {
  const book = sanitizeRuleBook(ruleBook);

  /** Rules that apply to a given practice kind + process. */
  const applicableRules = (kind, processId) =>
    book.rules.filter(
      (r) =>
        r.enabled &&
        (r.appliesTo === kind || r.appliesTo === "any") &&
        (r.process === "*" || r.process === processId)
    );

  const scoreKind = (kind) => async (ctx) => {
    const processId = ctx.process?.id ?? "";
    // A user-defined custom BP carries its own keyword rule inline. Score it
    // directly against that rule so the user does not have to mirror the BP as
    // a separate matching rule. Acts as if the rule book contained one rule
    // scoped to this BP only.
    const subject = kind === "bp" ? ctx.bp : kind === "wp" ? ctx.wp : ctx.gp;
    if (subject?._customRule) {
      const synthRule = sanitizeRule({
        ...subject._customRule,
        id: subject.id,
        label: subject.title || subject.id,
        appliesTo: kind,
        process: processId || "*",
        enabled: true,
      });
      if (synthRule) return scoreByRules([synthRule], ctx.artifacts ?? []);
    }
    const rules = applicableRules(kind, processId);
    if (!rules.length) {
      if (book.useAutoFallback && fallback) return fallback[METHOD_BY_KIND[kind]](ctx);
      return {
        scorePercent: 0,
        evidence: [],
        gaps: ["적용되는 사용자 룰이 없습니다 (자동 키워드 폴백 비활성화됨)."],
        contextConsistency: { status: "unknown", note: "" },
      };
    }
    return scoreByRules(rules, ctx.artifacts ?? []);
  };

  const scoreBP = scoreKind("bp");
  const scoreWP = scoreKind("wp");
  const scoreGPByRules = scoreKind("gp");

  return {
    scoreBP,
    scoreWP,
    async scoreGP(ctx) {
      // PA 1.1 / GP 1.1.1 is "achieve the intent of the base practices" — a
      // BP-derived attribute, not a keyword one. Defer to the fallback, which
      // averages the BP results that were themselves custom-scored above.
      if (ctx.paSpec?.id === "PA 1.1" && fallback) return fallback.scoreGP(ctx);
      return scoreGPByRules(ctx);
    },
  };
}
