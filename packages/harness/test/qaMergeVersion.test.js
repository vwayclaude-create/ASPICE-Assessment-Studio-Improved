import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVersion, relinkCheck, missingLinks } from "../src/qa/index.js";

const wpItem = (over = {}) => ({
  checkId: "CH-PP-001", workProduct: "프로젝트계획서", sheet: "1.프로젝트계획서", row: 2,
  processId: "MAN.3", area: "조직", question: "역할이 정의되어 있는가?", applicable: true,
  raw: {}, draft: null, confirmed: null, status: "pending", confirmedBy: null, confirmedAt: null,
  customRuleIds: [], ...over,
});
const wpCrit = { criteria: [{ id: "CH-PP-001-1", text: "있다" }], polarity: "positive", targetLocations: [], relatedBPs: [], severity: "중" };
const procItem = (over = {}) => ({
  itemId: "QA-SYS.2-001", excelId: null, processName: "시스템 요구사항 분석", processId: "SYS.2",
  question: "요구사항이 분석되었는가?", phase: "설계", row: 3,
  draft: null, confirmed: null, status: "pending", confirmedBy: null, confirmedAt: null, ...over,
});
const procCrit = (ids) => ({ linkedWpCheckIds: ids, relatedBPs: [], aggregation: "default" });
const imp = (items, extra = {}) => ({ items, issues: [], sheetNames: ["S"], fileName: "f.xlsx", ...extra });
const ctx = { now: "2026-10-27T00:00:00Z", user: "qa" };
const confirmedWp = (over = {}) => wpItem({ confirmed: wpCrit, status: "confirmed", confirmedBy: "qa", confirmedAt: "t0", ...over });

test("wp: 같은 질문은 이어받고 바뀐 질문은 stale, 새 ID는 pending, 사라진 ID는 removed", () => {
  const { version: prev } = buildVersion({
    ...ctx, wp: imp([confirmedWp(), confirmedWp({ checkId: "CH-PP-002" }), confirmedWp({ checkId: "CH-PP-003" })]),
  });
  const { version, summary } = buildVersion({
    ...ctx, prev,
    wp: imp([
      wpItem({ row: 9 }),
      wpItem({ checkId: "CH-PP-002", question: "바뀐 질문?" }),
      wpItem({ checkId: "CH-PP-004" }),
    ]),
  });
  assert.deepEqual(summary.wp, { carried: 1, stale: 1, added: 1, removed: 1 });
  const by = Object.fromEntries(version.wpItems.map((i) => [i.checkId, i]));
  assert.equal(by["CH-PP-001"].status, "confirmed");
  assert.deepEqual(by["CH-PP-001"].confirmed, wpCrit);
  assert.equal(by["CH-PP-001"].row, 9); // new Excel fields
  assert.equal(by["CH-PP-002"].status, "stale");
  assert.deepEqual(by["CH-PP-002"].confirmed, wpCrit);
  assert.equal(by["CH-PP-002"].question, "바뀐 질문?");
  assert.equal(by["CH-PP-004"].status, "pending");
  assert.equal(version.version, 2);
  assert.notEqual(version.id, prev.id);
});

test("process: (processId, question) 일치는 carried", () => {
  const { version: prev } = buildVersion({ ...ctx, process: imp([procItem({ status: "drafted", draft: procCrit(["X"]) })]) });
  const { version, summary } = buildVersion({ ...ctx, prev, process: imp([procItem({ row: 8 })]) });
  assert.deepEqual(summary.process, { carried: 1, stale: 0, added: 0, removed: 0 });
  assert.equal(version.processItems[0].status, "drafted");
  assert.equal(version.processItems[0].row, 8);
});

test("process: 문장이 바뀌어도 excelId가 같으면 stale", () => {
  const { version: prev } = buildVersion({
    ...ctx, process: imp([procItem({ itemId: "E-1", excelId: "E-1", confirmed: procCrit([]), status: "confirmed" })]),
  });
  const { version, summary } = buildVersion({
    ...ctx, prev, process: imp([procItem({ itemId: "E-1", excelId: "E-1", question: "다른 문장" })]),
  });
  assert.deepEqual(summary.process, { carried: 0, stale: 1, added: 0, removed: 0 });
  assert.equal(version.processItems[0].status, "stale");
  assert.deepEqual(version.processItems[0].confirmed, procCrit([]));
});

test("process: excelId 없으면 같은 processId 안 순번으로 stale, 범위 밖은 added/removed", () => {
  const { version: prev } = buildVersion({
    ...ctx, process: imp([
      procItem({ itemId: "QA-SYS.2-001", question: "a", status: "drafted" }),
      procItem({ itemId: "QA-SYS.2-002", question: "b", status: "drafted" }),
    ]),
  });
  const { version, summary } = buildVersion({
    ...ctx, prev, process: imp([
      procItem({ itemId: "QA-SYS.2-001", question: "a2" }),
      procItem({ itemId: "QA-SYS.2-002", question: "b" }),
      procItem({ itemId: "QA-SYS.2-003", question: "c" }),
    ]),
  });
  // a2 -> order index 0 (prev a) stale; b exact; c has no prev at index 2 -> added
  assert.deepEqual(summary.process, { carried: 1, stale: 1, added: 1, removed: 0 });
  assert.equal(version.processItems[0].status, "stale");
  assert.equal(version.processItems[0].itemId, "QA-SYS.2-001");
  assert.equal(version.processItems[2].status, "pending");

  const r = buildVersion({ ...ctx, prev: version, process: imp([procItem({ question: "z" })]) });
  assert.deepEqual(r.summary.process, { carried: 0, stale: 1, added: 0, removed: 2 });
});

test("연결 재검사: 사라진 ID 연결은 stale, 연결 배열 유지, missingLinks 반환", () => {
  const { version: prev } = buildVersion({
    ...ctx, wp: imp([confirmedWp({ checkId: "CH-PP-099" })]),
    process: imp([procItem({ status: "confirmed", confirmed: procCrit(["CH-PP-099"]) })]),
  });
  assert.equal(prev.processItems[0].status, "confirmed");
  const { version, summary } = buildVersion({ ...ctx, prev, wp: imp([wpItem()]) });
  const p = version.processItems[0];
  assert.equal(p.status, "stale");
  assert.deepEqual(p.confirmed.linkedWpCheckIds, ["CH-PP-099"]);
  assert.deepEqual(missingLinks(version, p), ["CH-PP-099"]);
  assert.deepEqual(summary.process, { carried: 0, stale: 1, added: 0, removed: 0 });
});

test("연결 재검사: 연결된 산출물 항목이 stale이면 프로세스 항목도 stale", () => {
  const v = relinkCheck({
    wpItems: [wpItem({ status: "stale" })],
    processItems: [procItem({ status: "confirmed", confirmed: procCrit(["CH-PP-001"]) })],
  });
  assert.equal(v.processItems[0].status, "stale");
  assert.deepEqual(v.processItems[0].confirmed.linkedWpCheckIds, ["CH-PP-001"]);
});

test("한 파일만: process null이면 프로세스 항목은 prev와 같고 sources는 복사", () => {
  const { version: prev } = buildVersion({
    ...ctx, wp: imp([confirmedWp()], { fileName: "wp.xlsx" }),
    process: imp([procItem({ status: "drafted", draft: procCrit(["CH-PP-001"]) })], { fileName: "pr.xlsx" }),
  });
  const { version } = buildVersion({ ...ctx, prev, wp: imp([confirmedWp()], { fileName: "wp2.xlsx" }), process: null });
  assert.deepEqual(version.processItems, prev.processItems);
  assert.equal(version.sources.find((s) => s.kind === "wp").fileName, "wp2.xlsx");
  assert.deepEqual(version.sources.find((s) => s.kind === "process"), prev.sources.find((s) => s.kind === "process"));
  assert.deepEqual(version.importIssues, []);
});

test("둘 다 null이면 throw", () => {
  assert.throws(() => buildVersion({ ...ctx, prev: null, wp: null, process: null }));
});

test("멱등: 같은 import로 두 번 병합해도 carried만 늘고 status 동일", () => {
  const wp = imp([confirmedWp(), wpItem({ checkId: "CH-PP-002" })]);
  const pr = imp([procItem({ status: "confirmed", confirmed: procCrit(["CH-PP-001"]) })]);
  const v1 = buildVersion({ ...ctx, wp, process: pr }).version;
  const { version: v2, summary } = buildVersion({ ...ctx, prev: v1, wp, process: pr });
  assert.deepEqual(summary.wp, { carried: 2, stale: 0, added: 0, removed: 0 });
  assert.deepEqual(summary.process, { carried: 1, stale: 0, added: 0, removed: 0 });
  assert.deepEqual(v2.wpItems.map((i) => i.status), v1.wpItems.map((i) => i.status));
  assert.deepEqual(v2.processItems.map((i) => i.status), v1.processItems.map((i) => i.status));
});

test("이어받기: 확정/stale 항목의 processId가 바뀌면 stale, 미확정은 상태 유지", () => {
  const { version: prev } = buildVersion({
    ...ctx,
    wp: imp([
      confirmedWp(),
      confirmedWp({ checkId: "CH-PP-002", status: "stale" }),
      wpItem({ checkId: "CH-PP-003", status: "drafted", draft: wpCrit }),
      confirmedWp({ checkId: "CH-PP-004" }),
    ]),
    process: imp([procItem({ status: "confirmed", confirmed: procCrit([]) })]),
  });
  const { version, summary } = buildVersion({
    ...ctx, prev,
    wp: imp([
      wpItem({ processId: "MAN.5" }),
      wpItem({ checkId: "CH-PP-002", processId: "MAN.5" }),
      wpItem({ checkId: "CH-PP-003", processId: "MAN.5" }),
      wpItem({ checkId: "CH-PP-004" }),
    ]),
  });
  const by = Object.fromEntries(version.wpItems.map((i) => [i.checkId, i]));
  assert.equal(by["CH-PP-001"].status, "stale");
  assert.deepEqual(by["CH-PP-001"].confirmed, wpCrit);
  assert.equal(by["CH-PP-001"].processId, "MAN.5");
  assert.equal(by["CH-PP-002"].status, "stale");
  assert.equal(by["CH-PP-003"].status, "drafted");
  assert.equal(by["CH-PP-004"].status, "confirmed");
  assert.deepEqual(summary.wp, { carried: 3, stale: 1, added: 0, removed: 0 });

  // Process side: excelId match across a processId change also goes stale.
  const { version: pv } = buildVersion({
    ...ctx, process: imp([procItem({ itemId: "E-1", excelId: "E-1", status: "confirmed", confirmed: procCrit([]) })]),
  });
  const r = buildVersion({ ...ctx, prev: pv, process: imp([procItem({ itemId: "E-1", excelId: "E-1", processId: "SYS.3" })]) });
  assert.equal(r.version.processItems[0].status, "stale");
});

test("버전 id: crypto.randomUUID가 없어도 만들어진다", () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true, writable: true });
  try {
    const a = buildVersion({ ...ctx, wp: imp([wpItem()]) }).version;
    const b = buildVersion({ ...ctx, wp: imp([wpItem()]) }).version;
    assert.equal(typeof a.id, "string");
    assert.ok(a.id.length > 0);
    assert.notEqual(a.id, b.id);
  } finally {
    Object.defineProperty(globalThis, "crypto", desc);
  }
});
