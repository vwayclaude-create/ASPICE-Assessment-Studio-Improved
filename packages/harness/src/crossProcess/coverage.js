/**
 * Requirement → Test coverage matrix.
 * Sources: requirement artifacts (WP 17-00, 17-08, 17-11). Targets: test
 * artifacts (WP 08-50, 08-52, 03-50). Reports percentage of source IDs
 * referenced by any target artifact.
 *
 * Coverage scope is intentionally restricted to *requirement-shaped* IDs:
 * functional / non-functional / interface requirement prefixes plus the
 * common system/software/hardware/ML domain prefixes. IDs that look like
 * sequence numbers (SEQ-*), verification/version tags (VER-*, BSD-OTA-VER-*),
 * test cases (TC-*), or other artifact-internal references are dropped from
 * the denominator so the ratio reflects actual development requirements,
 * not arbitrary identifiers extracted from the document body.
 *
 * Callers can extend the recognised prefix set per project via
 * `opts.extraRequirementPrefixes`.
 *
 * @param {import("../model/evidence.js").Artifact[]} artifacts
 * @param {{ extraRequirementPrefixes?: Iterable<string> }} [opts]
 */
export const REQUIREMENT_PREFIXES = new Set([
  // Generic requirement
  "REQ", "SR",
  // Functional / non-functional / interface (the three categories the
  // assessor cares about under "기능 / 비기능 / 인터페이스")
  "FR", "FUNC",
  "NFR", "NF", "NFUNC",
  "IFR", "IF", "INT", "INTF",
  // Domain / category prefixes
  "SYS", "SW", "HW", "ML",
  // Specification document prefixes
  "SRS", "SYRS", "SWRS", "SYSRS",
]);

/**
 * Traceability-matrix scope. The matrix links only the requirement IDs an
 * assessor traces through the development V-model: generic requirement
 * (REQ / SR) plus the functional / non-functional / interface families
 * (기능 / 비기능 / 인터페이스). Unlike REQUIREMENT_PREFIXES — the wider
 * allow-list used for requirement→test coverage — this deliberately omits
 * domain prefixes (SYS / SW / HW / ML) and document prefixes (SRS / …) so the
 * matrix reflects requirement IDs, not domain or document identifiers.
 */
export const TRACE_ID_PREFIXES = new Set([
  // Generic requirement
  "REQ", "SR",
  // Functional / non-functional / interface (기능 / 비기능 / 인터페이스)
  "FR", "FUNC",
  "NFR", "NF", "NFUNC",
  "IFR", "IF", "INT", "INTF",
]);

function firstPrefixOf(id) {
  return String(id).split(/[-_]/)[0].toUpperCase();
}

export function isRequirementId(id, prefixSet = REQUIREMENT_PREFIXES) {
  return prefixSet.has(firstPrefixOf(id));
}

export function computeCoverage(artifacts, opts = {}) {
  // v4.0 work products — requirements (17-*) and verification/validation
  // evidence (08-60/59 plan, 15-52/13-24 results, 03-50 verification data).
  const reqWps = new Set(["17-00", "17-05", "17-54", "17-55", "17-57"]);
  const testWps = new Set(["08-60", "08-59", "08-58", "08-57", "15-52", "13-24", "13-25", "03-50"]);

  const allowedPrefixes = opts.extraRequirementPrefixes
    ? new Set([...REQUIREMENT_PREFIXES, ...[...opts.extraRequirementPrefixes].map((p) => String(p).toUpperCase())])
    : REQUIREMENT_PREFIXES;

  const reqs = artifacts.filter((a) =>
    a.wpidCandidates?.some((w) => reqWps.has(w))
  );
  const tests = artifacts.filter((a) =>
    a.wpidCandidates?.some((w) => testWps.has(w))
  );

  const reqIds = new Set(
    reqs.flatMap((a) => a.extractedIds ?? [])
      .filter((id) => isRequirementId(id, allowedPrefixes))
  );
  const covered = new Set();

  for (const id of reqIds) {
    for (const t of tests) {
      if (t.text?.includes(id)) {
        covered.add(id);
        break;
      }
    }
  }

  const uncovered = [...reqIds].filter((id) => !covered.has(id));
  const coveragePercent =
    reqIds.size === 0 ? 0 : Math.round((covered.size / reqIds.size) * 100);

  return {
    totalRequirements: reqIds.size,
    coveredCount: covered.size,
    coveragePercent,
    uncovered,
  };
}
