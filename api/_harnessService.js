// Shared harness orchestration used by both /api/analyze (per-process) and
// /api/project (multi-file, cross-process). Keeps response shapes stable
// between Vercel serverless functions and the Vite dev middleware.
//
// Helpers split into focused modules to keep this file scoped to "wire harness
// + scope artifacts per process":
//   _textExtractor.js   — PDF/DOCX/text extraction with page tracking
//   _artifactBuilder.js — payload → harness-ready artifact[]
//   _evidencePages.js   — annotate BP evidence with source-page numbers
//   _legacyAdapter.js   — ProcessVerdict → legacy UI shape + Koreanization

import { Harness, loadProcess, loadProcesses, loadWorkProducts } from "aspice-harness";
import { ruleScorer, createLlmScorer, createHybridScorer } from "aspice-harness/evaluators";
import { createLlmClient } from "aspice-harness/llm";
import { indexArtifacts } from "aspice-harness/io";
import { loadProcessGraph } from "aspice-harness/spec";
import {
  buildProcessGraph,
  checkTraceability,
  checkConsistency,
  computeCoverage,
  analyzeChangePropagation,
} from "aspice-harness/crossProcess";

import { buildArtifacts } from "./_artifactBuilder.js";
import { annotateEvidenceWithPages } from "./_evidencePages.js";
import { toLegacyShape } from "./_legacyAdapter.js";

// Force hybrid as the contract for both modes. The legacy `engine` field is
// still accepted for backwards-compat but normalised here so the two modes
// cannot diverge on scorer choice.
function resolveEngine(requested) {
  return requested === "rule" || requested === "llm" ? requested : "hybrid";
}

// In-process cache of generateJson results, keyed by the full prompt content.
// gpt-4o's `seed`+`temperature=0` is best-effort, so the same prompt can
// produce slightly different scores across calls — which surfaces as the same
// document earning different BP grades in process mode vs project mode. The
// cache pins one verdict per prompt so the two modes converge on identical
// scores for identical evidence within a server lifetime.
const llmResponseCache = new Map();

function memoizeLlmClient(client) {
  return {
    ...client,
    async generateJson(prompt) {
      const key = JSON.stringify([prompt.system, prompt.context, prompt.task]);
      if (llmResponseCache.has(key)) {
        return llmResponseCache.get(key);
      }
      const result = await client.generateJson(prompt);
      llmResponseCache.set(key, result);
      return result;
    },
  };
}

function buildScorer(engine, apiKey) {
  if (engine === "rule") return ruleScorer;
  if (!apiKey) {
    throw new Error(`engine=${engine} requires OPENAI_API_KEY in server env.`);
  }
  const rawClient = createLlmClient({ provider: "openai", apiKey, model: "gpt-4o" });
  const client = memoizeLlmClient(rawClient);
  const llm = createLlmScorer({ client });
  if (engine === "llm") return llm;
  if (engine === "hybrid") return createHybridScorer({ rule: ruleScorer, llm });
  throw new Error(`Unknown engine: ${engine}`);
}

// Per-process artifact scoping. The BP/WP/GP scorers see only artifacts that
// look relevant to the process being evaluated, so project-mode evaluation of
// a single process yields the same BP scores as a stand-alone process-mode
// run with the same evidence file. Relevance heuristic:
//   - artifact tagged with one of the process's input/output WP IDs, OR
//   - artifact filename contains the process ID ("SYS.2", "SYS2", "swe.1"…)
// If nothing matches we fall back to ALL artifacts so that ad-hoc uploads
// (e.g. "requirements.pdf" with no WP tag) are still scored.
function filterArtifactsForProcess(processSpec, artifacts) {
  const expectedWp = new Set([
    ...((processSpec.inputWorkProducts ?? []).map((w) => w.id)),
    ...((processSpec.outputWorkProducts ?? []).map((w) => w.id)),
  ]);
  const idLow = (processSpec.id || "").toLowerCase();
  const idCompact = idLow.replace(/\./g, "");
  const filtered = artifacts.filter((a) => {
    if ((a.wpidCandidates ?? []).some((id) => expectedWp.has(id))) return true;
    const nameLow = (a.name || "").toLowerCase();
    return nameLow.includes(idLow) || (idCompact && nameLow.includes(idCompact));
  });
  return filtered.length ? filtered : artifacts;
}

// Common per-process evaluation. Both /api/analyze (one process) and
// /api/project (many processes) drive the harness through this helper, which
// applies the same artifact scoping in both modes — that is what guarantees
// that a process scored standalone vs inside a project produces the *same*
// BP percentages for the same evidence file.
async function evaluateOneProcess(harness, processSpec, indexedArtifacts) {
  const scoped = filterArtifactsForProcess(processSpec, indexedArtifacts);
  return harness.evaluateProcess({ processId: processSpec.id, artifacts: scoped });
}

function rejectIfNoArtifacts(arts, skipped) {
  if (arts.length) return;
  const detail = skipped.length
    ? `Every uploaded file failed to parse: ${skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}`
    : "No artifacts were provided.";
  throw new Error(detail);
}

/**
 * Per-process evaluation. Request body:
 *   { processId, artifact: {name, text|base64, mimeType}, targetLevel, engine }
 *   OR legacy: { processId, artifacts: [...], targetLevel, engine }
 * Response: legacy-shape adapter + harness ProcessVerdict.
 */
export async function handleEvaluate({ processId, artifact, artifacts, targetLevel = 1, engine = "hybrid" }, env) {
  const inputs = artifacts ?? (artifact ? [artifact] : []);
  const { artifacts: arts, skipped } = await buildArtifacts(inputs);
  rejectIfNoArtifacts(arts, skipped);

  const processSpec = loadProcess(processId);
  if (!processSpec) throw new Error(`Unknown process: ${processId}`);

  const resolved = resolveEngine(engine);
  const scorer = buildScorer(resolved, env.OPENAI_API_KEY);
  const harness = new Harness({ scorer, targetLevel: Number(targetLevel) });

  // Index once up-front so the per-process filter sees wpidCandidates.
  const indexed = indexArtifacts(arts, { wpCatalog: loadWorkProducts() });
  const verdict = await evaluateOneProcess(harness, processSpec, indexed);
  verdict.meta = { ...(verdict.meta || {}), skippedArtifacts: skipped, engine: resolved };
  annotateEvidenceWithPages(verdict, indexed);
  return { legacy: toLegacyShape(verdict, skipped), verdict };
}

/**
 * Multi-process / project evaluation. Request body:
 *   { processIds, artifacts: [...], targetLevel, engine }
 */
export async function handleProject({ processIds, artifacts, targetLevel = 1, engine = "hybrid" }, env) {
  const { artifacts: arts, skipped } = await buildArtifacts(artifacts || []);
  rejectIfNoArtifacts(arts, skipped);

  const resolved = resolveEngine(engine);
  const scorer = buildScorer(resolved, env.OPENAI_API_KEY);
  const harness = new Harness({ scorer, targetLevel: Number(targetLevel) });

  const all = loadProcesses();
  const inScope = processIds?.length ? all.filter((p) => processIds.includes(p.id)) : all;

  const indexed = indexArtifacts(arts, { wpCatalog: loadWorkProducts() });

  // Evaluate each process with the same per-process artifact scoping that
  // /api/analyze uses. This is what makes project-mode BP percentages match
  // a per-process run on the same evidence.
  const processVerdicts = await Promise.all(
    inScope.map((proc) => evaluateOneProcess(harness, proc, indexed))
  );

  // Cross-process checks still see the FULL artifact set — they need the
  // global view to detect missing traces / inconsistent IDs / coverage gaps.
  const seed = loadProcessGraph();
  const graph = buildProcessGraph(inScope, { seedEdges: seed.edges });
  const procById = new Map(inScope.map((p) => [p.id, p]));
  // The traceability matrix is scoped to the development area only — system /
  // software / hardware / ML engineering. Management (MAN), support (SUP),
  // acquisition (ACQ), supply (SPL), validation (VAL) and reuse (REU) edges
  // are excluded from the matrix. Mirrors Harness#evaluateProject.
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
      if (matrix.sourceIds.length === 0 && matrix.targetIds.length === 0) continue;
      traceMatrices.push(matrix);
    }
  }
  const consistency = checkConsistency(indexed);
  const coverage = computeCoverage(indexed);
  const changes = analyzeChangePropagation(indexed, { graph });

  const verdict = {
    processes: processVerdicts,
    crossProcess: { graph, traceMatrices, consistency, coverage, changes },
    meta: {
      targetLevel: Number(targetLevel),
      artifactCount: indexed.length,
      graphSource: graph.source,
      skippedArtifacts: skipped,
      engine: resolved,
    },
  };
  annotateEvidenceWithPages(verdict, indexed);
  return { verdict };
}
