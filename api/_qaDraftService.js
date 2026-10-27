// QA Audit mode — AI criteria draft generation (checklist import phase 1).
//
// Self-contained LLM setup: the scoring path in _harnessService.js uses
// OpenAI (OPENAI_API_KEY, gpt-4o), so this service follows the same default
// and reads the explicitly-passed `env` object (Vercel serverless and the Vite
// dev middleware each hand us their own).
import { loadProcesses } from "aspice-harness";
import { createLlmClient } from "aspice-harness/llm";
import { generateDrafts } from "aspice-harness/qa";

export const MAX_DRAFT_ITEMS = 200;

const DEFAULT_MODELS = { openai: "gpt-4o", anthropic: "claude-sonnet-4-6" };

function badRequest(message) {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
}

// Provider precedence:
//   1. ASPICE_LLM_PROVIDER ("openai" | "anthropic") pins the provider
//   2. otherwise OpenAI when OPENAI_API_KEY is set (same as the scoring path)
//   3. otherwise Anthropic when ANTHROPIC_API_KEY is set
// Returns null when no usable key is configured.
function resolveQaLlmConfig(env = {}) {
  const pinned = env.ASPICE_LLM_PROVIDER;
  const provider =
    pinned === "openai" || pinned === "anthropic"
      ? pinned
      : env.OPENAI_API_KEY
        ? "openai"
        : env.ANTHROPIC_API_KEY
          ? "anthropic"
          : null;
  if (!provider) return null;
  const apiKey = provider === "anthropic" ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = env.ASPICE_LLM_MODEL || DEFAULT_MODELS[provider];
  const concurrency = parseConcurrency(env.ASPICE_LLM_CONCURRENCY, 5);
  return { provider, apiKey, model, concurrency };
}

function parseConcurrency(raw, fallback) {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Bound the number of in-flight generateJson calls so a large checklist does
// not open dozens of API calls at once and hit rate limits.
function limitConcurrency(client, max) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < max && queue.length) {
      const { prompt, resolve, reject } = queue.shift();
      active++;
      Promise.resolve()
        .then(() => client.generateJson(prompt))
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  return {
    ...client,
    generateJson(prompt) {
      return new Promise((resolve, reject) => {
        queue.push({ prompt, resolve, reject });
        pump();
      });
    },
  };
}

export async function handleQaDraft({ kind, groups } = {}, env) {
  if (kind !== "wp" && kind !== "process") throw badRequest("kind must be 'wp' or 'process'");
  if (!Array.isArray(groups) || groups.length === 0) throw badRequest("groups must be a non-empty array");
  if (groups.length > MAX_DRAFT_ITEMS) {
    throw badRequest(`groups exceeds ${MAX_DRAFT_ITEMS} items per request`);
  }

  const cfg = resolveQaLlmConfig(env);
  if (!cfg) {
    throw new Error("QA 초안 생성에는 LLM API 키(ANTHROPIC_API_KEY 또는 OPENAI_API_KEY)가 필요합니다.");
  }
  const { provider, apiKey, model, concurrency } = cfg;
  const client = limitConcurrency(createLlmClient({ provider, apiKey, model }), concurrency);
  const { results, failures } = await generateDrafts({
    client,
    kind,
    groups,
    processes: loadProcesses(),
  });
  return { results, failures, model };
}
