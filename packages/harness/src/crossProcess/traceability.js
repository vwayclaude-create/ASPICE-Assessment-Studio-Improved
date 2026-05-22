import { isRequirementId, TRACE_ID_PREFIXES } from "./coverage.js";

/**
 * Bidirectional traceability check for one process-to-process edge.
 *
 * Semantics of a trace link in ASPICE:
 *   - Source WP (e.g. 17-00 system requirements) carries internal IDs
 *     (REQ-SYS-001, ...) produced by the source process.
 *   - Target process produces its own WPs (e.g. 17-11 software requirements,
 *     04-04 software architecture) that must reference those source IDs to
 *     demonstrate forward trace.
 *   - Backward trace: each target ID claims to derive from a source ID.
 *
 * Both source and target IDs are scoped to TRACE_ID_PREFIXES — generic
 * requirement plus functional / non-functional / interface prefixes. Domain
 * (SYS/SW/HW/ML) and document (SRS/…) IDs are excluded so the matrix links
 * 기능 / 비기능 / 인터페이스 requirements, not arbitrary identifiers.
 *
 * We compute:
 *   - coveragePercent : fraction of source IDs referenced by any target artifact.
 *   - orphansSource   : source IDs no target artifact references.
 *   - orphansTarget   : target IDs that do not cite any source ID.
 *   - links           : explicit (src → tgt) pairs detected.
 *
 * @param {import("../model/evidence.js").Artifact[]} artifacts
 * @param {{
 *   sourceProcess: string, targetProcess: string,
 *   sourceWp: string, targetWps: string[]
 * }} spec
 * @returns {import("../model/trace.js").TraceMatrix}
 */
export function checkTraceability(artifacts, spec) {
  const sourceArtifacts = artifacts.filter((a) =>
    a.wpidCandidates?.includes(spec.sourceWp)
  );
  const targetWpSet = new Set(spec.targetWps ?? []);
  const targetArtifacts = artifacts.filter((a) =>
    a.wpidCandidates?.some((w) => targetWpSet.has(w))
  );

  // Restrict the matrix to requirement-shaped IDs only — generic requirement
  // plus functional / non-functional / interface prefixes. Domain (SYS/SW/HW
  // /ML) and document (SRS/…) IDs are dropped from both ends of the edge.
  const traceIds = (a) =>
    (a.extractedIds ?? []).filter((id) => isRequirementId(id, TRACE_ID_PREFIXES));

  const sourceIds = new Set(sourceArtifacts.flatMap(traceIds));
  const targetIds = new Set(targetArtifacts.flatMap(traceIds));

  const links = [];
  const linkedSource = new Set();
  const linkedTarget = new Set();

  for (const tgt of targetArtifacts) {
    const body = tgt.text ?? "";
    const tgtIds = traceIds(tgt);
    for (const srcId of sourceIds) {
      if (body.includes(srcId)) {
        linkedSource.add(srcId);
        for (const tgtId of tgtIds) {
          linkedTarget.add(tgtId);
          links.push({
            fromId: srcId,
            toId: tgtId,
            fromProcess: spec.sourceProcess,
            toProcess: spec.targetProcess,
            fromWp: spec.sourceWp,
            toWp: tgt.wpidCandidates?.find((w) => targetWpSet.has(w)) ?? "",
            direction: "forward",
          });
        }
      }
    }
  }

  const orphansSource = [...sourceIds].filter((id) => !linkedSource.has(id));
  const orphansTarget = [...targetIds].filter((id) => !linkedTarget.has(id));
  const coveragePercent =
    sourceIds.size === 0
      ? null
      : Math.round((linkedSource.size / sourceIds.size) * 100);

  return {
    sourceProcess: spec.sourceProcess,
    targetProcess: spec.targetProcess,
    sourceWp: spec.sourceWp,
    targetWps: [...targetWpSet],
    sourceIds: [...sourceIds],
    targetIds: [...targetIds],
    links,
    coveragePercent,
    orphansSource,
    orphansTarget,
  };
}
