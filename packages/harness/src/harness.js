import {
  loadProcesses,
  loadProcess,
  loadProcessAttributes,
  loadWorkProducts,
  loadProcessGraph,
} from "../spec/canonical/index.js";
import { indexArtifacts } from "./io/artifactIndex.js";
import { computeProjectFingerprint } from "./io/projectContext.js";
import { evaluateBPs } from "./evaluators/bpEvaluator.js";
import { evaluateWPs } from "./evaluators/wpEvaluator.js";
import { evaluatePAs } from "./evaluators/paEvaluator.js";
import { computeCapabilityLevel } from "./evaluators/capabilityLevel.js";
import { buildProcessGraph } from "./crossProcess/traceGraph.js";
import { checkTraceability } from "./crossProcess/traceability.js";
import { checkConsistency } from "./crossProcess/consistency.js";
import { computeCoverage } from "./crossProcess/coverage.js";
import { analyzeChangePropagation } from "./crossProcess/changePropagation.js";

/**
 * Harness runtime. Data-driven: reads canonical specs from spec/canonical/,
 * applies evaluators against artifacts with a configured Scorer, and runs
 * cross-process consistency / traceability / change-propagation checks.
 */
export class Harness {
  /** @param {{scorer: import("./evaluators/scorer.js").Scorer, targetLevel?: 1|2|3}} opts */
  constructor(opts) {
    if (!opts?.scorer) throw new Error("Harness requires a `scorer` implementation.");
    this.scorer = opts.scorer;
    this.targetLevel = opts.targetLevel ?? 1;
    this.paSpecs = loadProcessAttributes();
    this.wpCatalog = loadWorkProducts();
  }

  async evaluateProcess({ processId, artifacts, projectFingerprint, extraBPs = [] }) {
    const processSpec = loadProcess(processId);
    if (!processSpec) throw new Error(`Unknown process: ${processId}`);
    const indexed = this.#indexOnce(artifacts);
    // Use the caller-supplied fingerprint (project mode computes it once over
    // the full batch) so per-process verdicts are judged against the *project*
    // context, not just the per-process subset. Falls back to the indexed set
    // for stand-alone process-mode runs.
    const fingerprint = projectFingerprint ?? computeProjectFingerprint(indexed);

    // Merge user-defined custom BPs into the process spec so they flow through
    // the standard BP evaluator and PA 1.1 average.
    const effectiveSpec = extraBPs.length
      ? { ...processSpec, basePractices: [...processSpec.basePractices, ...extraBPs] }
      : processSpec;

    const bps = await evaluateBPs(effectiveSpec, indexed, this.scorer, { projectFingerprint: fingerprint });
    const wps = await evaluateWPs(effectiveSpec, indexed, this.scorer, { projectFingerprint: fingerprint });
    const pas = await evaluatePAs(
      effectiveSpec,
      this.paSpecs,
      bps,
      wps,
      indexed,
      this.scorer,
      { level: this.targetLevel, projectFingerprint: fingerprint }
    );
    const cl = computeCapabilityLevel(pas);

    return {
      processId,
      processName: processSpec.name,
      bps,
      wps,
      pas,
      capabilityLevel: cl.level,
      capabilityLevelReason: cl.reason,
      projectFingerprint: fingerprint,
      meta: { targetLevel: this.targetLevel, pamSection: processSpec.pamSection },
    };
  }

  /** Evaluate a whole project: every in-scope process + cross-process checks. */
  async evaluateProject({ artifacts, processIds } = {}) {
    const all = loadProcesses();
    const inScope = processIds?.length
      ? all.filter((p) => processIds.includes(p.id))
      : all;

    const indexed = this.#indexOnce(artifacts);
    // One fingerprint per project run, shared by every per-process call so
    // every BP/WP/GP is judged against the same project-wide context baseline.
    const projectFingerprint = computeProjectFingerprint(indexed);

    // Parallel per-process evaluation — sequential `for await` would stack
    // ~15–20s per process under hybrid/llm scorers and exceed serverless
    // function timeouts on a 6-process project run.
    const processVerdicts = await Promise.all(
      inScope.map((proc) =>
        this.evaluateProcess({ processId: proc.id, artifacts: indexed, projectFingerprint })
      )
    );

    // Canonical graph — authoritative V-model seed edges.
    const seed = loadProcessGraph();
    const graph = buildProcessGraph(inScope, { seedEdges: seed.edges });

    const procById = new Map(inScope.map((p) => [p.id, p]));
    // The traceability matrix is scoped to the development area only — system
    // / software / hardware / ML engineering. Management (MAN), support (SUP),
    // acquisition (ACQ), supply (SPL), validation (VAL) and reuse (REU) edges
    // feed development work but are not part of the development trace chain,
    // so they are excluded from the matrix.
    const DEV_AREA_CATEGORIES = new Set(["SYS", "SWE", "HWE", "MLE"]);
    const traceMatrices = [];
    for (const edge of graph.edges) {
      const tgt = procById.get(edge.to);
      const src = procById.get(edge.from);
      if (!tgt || !src) continue;
      if (
        !DEV_AREA_CATEGORIES.has(src.category) ||
        !DEV_AREA_CATEGORIES.has(tgt.category)
      ) {
        continue;
      }
      const targetWps = (tgt.outputWorkProducts ?? []).map((w) => w.id);
      if (!targetWps.length) continue;
      for (const via of edge.via) {
        const matrix = checkTraceability(indexed, {
          sourceProcess: edge.from,
          targetProcess: edge.to,
          sourceWp: via,
          targetWps,
        });
        // Skip edges where no artifacts are present for either side
        if (matrix.sourceIds.length === 0 && matrix.targetIds.length === 0) continue;
        traceMatrices.push(matrix);
      }
    }

    const consistency = checkConsistency(indexed);
    const coverage = computeCoverage(indexed);
    const changes = analyzeChangePropagation(indexed, { graph });

    return {
      processes: processVerdicts,
      crossProcess: { graph, traceMatrices, consistency, coverage, changes },
      projectFingerprint,
      meta: {
        targetLevel: this.targetLevel,
        artifactCount: indexed.length,
        graphSource: graph.source,
      },
    };
  }

  #indexOnce(artifacts) {
    const needsIndex = artifacts.some(
      (a) => a.wpidCandidates === undefined || a.projectTerms === undefined
    );
    return needsIndex ? indexArtifacts(artifacts, { wpCatalog: this.wpCatalog }) : artifacts;
  }
}
