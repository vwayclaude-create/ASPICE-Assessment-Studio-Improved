import { test } from "node:test";
import assert from "node:assert/strict";
import { createCustomScorer, sanitizeRuleBook } from "../src/evaluators/customScorer.js";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";

const bp = { id: "SYS.2.BP1", title: "Specify requirements", description: "" };
const gp = { id: "GP 2.1.1", title: "Identify objectives" };

function rule(over) {
  return {
    id: over.id ?? "r1",
    enabled: true,
    label: over.label ?? "rule",
    appliesTo: "bp",
    process: "*",
    match: "any",
    keywords: ["traceability"],
    weight: 1,
    ...over,
  };
}

test("customScorer: satisfied rule scores 100, unsatisfied scores 0", async () => {
  const scorer = createCustomScorer({
    ruleBook: { rules: [rule({ keywords: ["traceability"] })] },
  });
  const hit = await scorer.scoreBP({
    process: { id: "SYS.2" },
    bp,
    artifacts: [{ name: "doc.pdf", text: "full traceability matrix attached" }],
  });
  assert.equal(hit.scorePercent, 100);
  assert.ok(hit.evidence.length > 0, "satisfied rule should yield evidence");

  const miss = await scorer.scoreBP({
    process: { id: "SYS.2" },
    bp,
    artifacts: [{ name: "doc.pdf", text: "nothing relevant here" }],
  });
  assert.equal(miss.scorePercent, 0);
  assert.ok(miss.gaps.some((g) => g.includes("미충족")));
});

test("customScorer: score is the weighted fraction of satisfied rules", async () => {
  const scorer = createCustomScorer({
    ruleBook: {
      rules: [
        rule({ id: "a", keywords: ["alpha"], weight: 3 }),
        rule({ id: "b", keywords: ["beta"], weight: 1 }),
      ],
    },
  });
  // Only the weight-3 rule hits → 3 / (3+1) = 75%.
  const res = await scorer.scoreBP({
    process: { id: "SYS.2" },
    bp,
    artifacts: [{ name: "d.pdf", text: "alpha appears but not the other term" }],
  });
  assert.equal(res.scorePercent, 75);
});

test("customScorer: disabled rule is excluded from scoring", async () => {
  const scorer = createCustomScorer({
    ruleBook: {
      useAutoFallback: false,
      rules: [rule({ enabled: false, keywords: ["traceability"] })],
    },
  });
  const res = await scorer.scoreBP({
    process: { id: "SYS.2" },
    bp,
    artifacts: [{ name: "d.pdf", text: "traceability matrix" }],
  });
  // The only rule is disabled and fallback is off → no applicable rule.
  assert.equal(res.scorePercent, 0);
  assert.ok(res.gaps.some((g) => g.includes("적용되는 사용자 룰이 없")));
});

test("customScorer: rule scoped to another process does not apply", async () => {
  const scorer = createCustomScorer({
    ruleBook: {
      useAutoFallback: false,
      rules: [rule({ process: "SWE.1", keywords: ["traceability"] })],
    },
  });
  const res = await scorer.scoreBP({
    process: { id: "SYS.2" },
    bp,
    artifacts: [{ name: "d.pdf", text: "traceability" }],
  });
  assert.equal(res.scorePercent, 0, "SWE.1-scoped rule must not score SYS.2");
});

test("customScorer: match=all requires every keyword present", async () => {
  const scorer = createCustomScorer({
    ruleBook: { rules: [rule({ match: "all", keywords: ["alpha", "beta"] })] },
  });
  const partial = await scorer.scoreBP({
    process: { id: "SYS.2" },
    bp,
    artifacts: [{ name: "d.pdf", text: "alpha only" }],
  });
  assert.equal(partial.scorePercent, 0);

  const full = await scorer.scoreBP({
    process: { id: "SYS.2" },
    bp,
    artifacts: [{ name: "d.pdf", text: "alpha and beta both here" }],
  });
  assert.equal(full.scorePercent, 100);
});

test("customScorer: a keyword equal to a WP-ID tag matches via wpidCandidates", async () => {
  const scorer = createCustomScorer({
    ruleBook: { rules: [rule({ appliesTo: "wp", keywords: ["17-50"] })] },
  });
  const res = await scorer.scoreWP({
    process: { id: "SYS.2" },
    wp: { id: "17-50", name: "Verification results" },
    artifacts: [{ name: "results.xlsx", text: "", wpidCandidates: ["17-50"] }],
  });
  assert.equal(res.scorePercent, 100);
});

test("customScorer: falls back to the rule scorer when no rule applies", async () => {
  const marker = { scorePercent: 42, evidence: [], gaps: ["from-fallback"] };
  const fallback = { scoreBP: async () => marker, scoreWP: async () => marker, scoreGP: async () => marker };
  const scorer = createCustomScorer({
    ruleBook: { useAutoFallback: true, rules: [] },
    fallback,
  });
  const res = await scorer.scoreBP({ process: { id: "SYS.2" }, bp, artifacts: [] });
  assert.equal(res.scorePercent, 42);
});

test("customScorer: PA 1.1 GP score defers to the fallback (BP-derived)", async () => {
  const fallback = {
    scoreBP: ruleScorer.scoreBP,
    scoreWP: ruleScorer.scoreWP,
    scoreGP: async () => ({ scorePercent: 88, evidence: [], gaps: [] }),
  };
  const scorer = createCustomScorer({
    ruleBook: { rules: [rule({ appliesTo: "gp", keywords: ["traceability"] })] },
    fallback,
  });
  const res = await scorer.scoreGP({
    process: { id: "SYS.2" },
    paSpec: { id: "PA 1.1" },
    gp,
    bpResults: [],
    artifacts: [{ name: "d.pdf", text: "traceability" }],
  });
  assert.equal(res.scorePercent, 88, "PA 1.1 must use the BP-derived fallback, not GP rules");
});

test("sanitizeRuleBook: drops keyword-less rules and clamps weights", () => {
  const book = sanitizeRuleBook({
    useAutoFallback: false,
    rules: [
      { id: "ok", label: "ok", keywords: ["x"], weight: 99 },
      { id: "empty", label: "empty", keywords: [] },
      "not-an-object",
    ],
  });
  assert.equal(book.rules.length, 1, "keyword-less and malformed rules are dropped");
  assert.equal(book.rules[0].weight, 5, "weight is clamped to the 0.1‥5 range");
  assert.equal(book.useAutoFallback, false);
});
