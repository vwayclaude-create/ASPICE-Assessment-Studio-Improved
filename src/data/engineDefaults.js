// Single source of truth for the default scorer engine(s). Both per-process
// (useAnalysis) and project (useProject / SolutionApp) modes read from here so
// the UI selector and the dispatched request agree. The server normalises any
// unknown value back to "hybrid" so the two modes can never drift apart on
// scorer choice for the same evidence.
//
// The engine field is an array — the user can pick one or many scorers. When
// more than one is selected the server averages each scorer's BP/WP/GP percent
// and merges the evidence/gaps. A single-engine selection behaves identically
// to the legacy string form.
export const ENGINE_IDS = ["rule", "llm", "hybrid", "custom"];
export const DEFAULT_ENGINES = ["hybrid"];

/** Coerce legacy string values or unknown shapes into a non-empty engine array. */
export function normalizeEngines(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (ENGINE_IDS.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length ? out : [...DEFAULT_ENGINES];
}
