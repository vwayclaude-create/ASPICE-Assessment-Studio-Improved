import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcesses } from "../spec/canonical/index.js";
import {
  wpCandidatesFor, buildWpDraftPrompt, buildProcessDraftPrompt,
  sanitizeWpDraft, sanitizeProcessDraft, generateDrafts, bpCatalog,
} from "../src/qa/index.js";

const P = loadProcesses();

const rawWp = (over = {}) => ({
  id: "CH-PP-003", criteria: ["조직도가 있다", "역할이 표로 정리되어 있다"], polarity: "positive",
  targetLocations: ["4. Organization Chart"], relatedBPs: ["MAN.3.BP5"], severity: "상",
  rationale: "근거", ...over,
});

test("sanitizeWp: 목록 밖 BP 제거, 심각도 보정, 기준 id 재부여", () => {
  const r = sanitizeWpDraft(rawWp({ relatedBPs: ["MAN.3.BP5", "XYZ.1.BP1"], severity: "높음", polarity: "weird" }), { processes: P });
  assert.deepEqual(r.relatedBPs, ["MAN.3.BP5"]);
  assert.equal(r.severity, "중");
  assert.equal(r.polarity, "positive");
  assert.deepEqual(r.criteria.map((c) => c.id), ["CH-PP-003-1", "CH-PP-003-2"]);
  assert.equal(r.criteria[0].text, "조직도가 있다");
  assert.equal(r.rationale, "근거");
  assert.equal(sanitizeWpDraft(rawWp({ polarity: "negative" }), { processes: P }).polarity, "negative");
});

test("sanitizeWp: 기준이 비면 null", () => {
  assert.equal(sanitizeWpDraft(rawWp({ criteria: [] }), { processes: P }), null);
  assert.equal(sanitizeWpDraft(rawWp({ criteria: ["  ", ""] }), { processes: P }), null);
  assert.equal(sanitizeWpDraft(null, { processes: P }), null);
});

test("sanitizeProcess: 후보 밖 연결 제거, aggregation 고정", () => {
  const r = sanitizeProcessDraft(
    { id: "QA-MAN.3-001", linkedWpCheckIds: ["CH-A", "CH-X"], relatedBPs: ["MAN.3.BP1", "NOPE.9.BP1"], aggregation: "any", rationale: "r" },
    { processes: P, candidateIds: new Set(["CH-A"]) });
  assert.deepEqual(r.linkedWpCheckIds, ["CH-A"]);
  assert.deepEqual(r.relatedBPs, ["MAN.3.BP1"]);
  assert.equal(r.aggregation, "default");
});

test("프롬프트: BP id/title, 항목 id/question, 부정형 지시", () => {
  const bps = bpCatalog(P, "MAN.3");
  const items = [{ id: "CH-PP-003", question: "오타가 존재하는가?" }];
  const p = buildWpDraftPrompt({ workProduct: "프로젝트계획서", processId: "MAN.3", bps, items });
  assert.ok(p.context.includes(bps[0].id) && p.context.includes(bps[0].title));
  assert.ok(p.task.includes("CH-PP-003") && p.task.includes("오타가 존재하는가?"));
  assert.ok(p.system.includes("'예'가 위반을 뜻하면 polarity=negative"));
  const q = buildProcessDraftPrompt({ processId: "MAN.3", bps, items: [{ id: "QA-MAN.3-001", question: "계획 수립?" }],
    candidates: [{ checkId: "CH-PP-003", workProduct: "프로젝트계획서", question: "역할?" }] });
  assert.ok(q.task.includes("QA-MAN.3-001") && q.task.includes("계획 수립?"));
  assert.ok(q.context.includes("CH-PP-003") && q.context.includes(bps[0].id));
});

const mkGroups = (n) => Array.from({ length: n }, (_, i) => ({
  key: `CH-${i}`, workProduct: "프로젝트계획서", processId: "MAN.3", question: `q${i}`,
}));
const okItem = (id) => ({ id, criteria: ["c"], polarity: "positive", targetLocations: [], relatedBPs: [], severity: "하", rationale: "" });
function fakeClient(plan) {
  const calls = [];
  return {
    calls,
    async generateJson({ task }) {
      const n = calls.length; calls.push(task);
      const step = plan[n];
      if (step instanceof Error) throw step;
      const ids = [...task.matchAll(/CH-\d+/g)].map((m) => m[0]);
      return { parsed: { items: ids.filter((v, i) => ids.indexOf(v) === i).map(okItem) } };
    },
  };
}

test("generateDrafts: 45개 -> 3회 호출(20/20/5)", async () => {
  const client = fakeClient([]);
  const r = await generateDrafts({ client, kind: "wp", groups: mkGroups(45), processes: P });
  assert.equal(client.calls.length, 3);
  assert.equal(Object.keys(r.results).length, 45);
  assert.deepEqual(r.failures, {});
});

test("generateDrafts: 두 번째 배치만 throw", async () => {
  const client = fakeClient([null, new Error("boom"), null]);
  const r = await generateDrafts({ client, kind: "wp", groups: mkGroups(45), processes: P });
  assert.equal(Object.keys(r.results).length, 25);
  assert.equal(Object.keys(r.failures).length, 20);
  assert.ok(r.failures["CH-20"].includes("boom"));
  assert.ok(r.results["CH-0"] && r.results["CH-44"] && !r.results["CH-20"]);
});

test("generateDrafts: 응답에 없는 id는 실패", async () => {
  const client = { async generateJson() { return { parsed: { items: [okItem("CH-0")] } }; } };
  const r = await generateDrafts({ client, kind: "wp", groups: mkGroups(2), processes: P });
  assert.ok(r.results["CH-0"]);
  assert.ok(r.failures["CH-1"].includes("응답 없음"));
});

test("generateDrafts: 기준 0개 응답은 실패, 프로세스 종류는 후보로 정제", async () => {
  const client = { async generateJson() { return { parsed: { items: [{ ...okItem("CH-0"), criteria: [] }] } }; } };
  const r = await generateDrafts({ client, kind: "wp", groups: mkGroups(1), processes: P });
  assert.ok(r.failures["CH-0"]);
  const pc = { async generateJson() { return { parsed: { items: [{ id: "QA-1", linkedWpCheckIds: ["CH-A", "CH-Z"], relatedBPs: [], rationale: "" }] } }; } };
  const r2 = await generateDrafts({ client: pc, kind: "process", processes: P,
    groups: [{ key: "QA-1", processId: "MAN.3", question: "q", candidates: [{ checkId: "CH-A", workProduct: "w", question: "q" }] }] });
  assert.deepEqual(r2.results["QA-1"].linkedWpCheckIds, ["CH-A"]);
});

test("wpCandidatesFor: 같은 processId 전부 + 다른 processId의 확정+관련BP", () => {
  const wp = (checkId, processId, over = {}) => ({ checkId, workProduct: "w" + checkId, processId, question: "q", status: "pending", confirmed: null, ...over });
  const version = { wpItems: [
    wp("A", "MAN.3"), wp("B", "MAN.5", { status: "confirmed", confirmed: { relatedBPs: ["MAN.3.BP2"] } }),
    wp("C", "MAN.5", { status: "pending", confirmed: null }),
    wp("D", "MAN.5", { status: "confirmed", confirmed: { relatedBPs: ["MAN.5.BP1"] } }),
  ] };
  const ids = wpCandidatesFor(version, "MAN.3", P).map((c) => c.checkId);
  assert.deepEqual(ids.sort(), ["A", "B"]);
  assert.deepEqual(Object.keys(wpCandidatesFor(version, "MAN.3", P)[0]).sort(), ["checkId", "question", "workProduct"]);
});

test("generateDrafts: 배치 프로세스 BP 목록 밖 relatedBPs 제거 (wp/process 모두)", async () => {
  const client = { async generateJson() {
    return { parsed: { items: [{ ...okItem("CH-0"), relatedBPs: ["MAN.3.BP1", "SYS.2.BP1"] }] } };
  } };
  const r = await generateDrafts({ client, kind: "wp", groups: mkGroups(1), processes: P });
  assert.deepEqual(r.results["CH-0"].relatedBPs, ["MAN.3.BP1"]);
  const pc = { async generateJson() {
    return { parsed: { items: [{ id: "QA-1", linkedWpCheckIds: [], relatedBPs: ["SYS.2.BP1", "MAN.3.BP2"], rationale: "" }] } };
  } };
  const r2 = await generateDrafts({ client: pc, kind: "process", processes: P,
    groups: [{ key: "QA-1", processId: "MAN.3", question: "q", candidates: [] }] });
  assert.deepEqual(r2.results["QA-1"].relatedBPs, ["MAN.3.BP2"]);
});

test("sanitize: processId를 주면 그 프로세스 BP만 남김", () => {
  assert.deepEqual(sanitizeWpDraft(rawWp({ relatedBPs: ["MAN.3.BP5", "SYS.2.BP1"] }), { processes: P, processId: "MAN.3" }).relatedBPs, ["MAN.3.BP5"]);
  assert.deepEqual(sanitizeProcessDraft({ relatedBPs: ["SYS.2.BP1"] }, { processes: P, candidateIds: new Set(), processId: "MAN.3" }).relatedBPs, []);
});
