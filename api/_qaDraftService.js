// QA Audit mode — AI criteria draft generation (checklist import phase 1).
import { loadProcesses } from "aspice-harness";
import { createLlmClient } from "aspice-harness/llm";
import { generateDrafts } from "aspice-harness/qa";
import { resolveLlmConfig, limitConcurrency } from "./_harnessService.js";

export const MAX_DRAFT_ITEMS = 200;

function badRequest(message) {
  const err = new Error(message);
  err.code = "BAD_REQUEST";
  return err;
}

export async function handleQaDraft({ kind, groups } = {}, env) {
  if (kind !== "wp" && kind !== "process") throw badRequest("kind must be 'wp' or 'process'");
  if (!Array.isArray(groups) || groups.length === 0) throw badRequest("groups must be a non-empty array");
  if (groups.length > MAX_DRAFT_ITEMS) {
    throw badRequest(`groups exceeds ${MAX_DRAFT_ITEMS} items per request`);
  }

  const cfg = resolveLlmConfig(env);
  if (!cfg) {
    throw new Error("QA 초안 생성에는 LLM API 키(ANTHROPIC_API_KEY 또는 OPENAI_API_KEY)가 필요합니다.");
  }
  const client = limitConcurrency(createLlmClient(cfg), cfg.concurrency);
  const { results, failures } = await generateDrafts({
    client,
    kind,
    groups,
    processes: loadProcesses(),
  });
  return { results, failures, model: cfg.model };
}
