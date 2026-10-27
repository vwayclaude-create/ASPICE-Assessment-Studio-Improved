import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcesses } from "../spec/canonical/index.js";
import { canConfirmWp, canConfirmProcess, confirmItem, unconfirmItem } from "../src/qa/index.js";

const P = loadProcesses();

const wpItem = (over = {}) => ({
  checkId: "CH-PP-003", workProduct: "프로젝트계획서", sheet: "1.프로젝트계획서", row: 5,
  processId: "MAN.3", area: "조직", question: "역할이 정의되어 있는가?", applicable: true,
  raw: {}, draft: null, confirmed: null, status: "pending", confirmedBy: null, confirmedAt: null,
  customRuleIds: [], ...over,
});
const wpCrit = (over = {}) => ({
  criteria: [{ id: "CH-PP-003-1", text: "조직도가 있다" }],
  polarity: "positive", targetLocations: ["4. Organization Chart"],
  relatedBPs: ["MAN.3.BP5"], severity: "상", ...over,
});
const procItem = (over = {}) => ({
  itemId: "QA-SYS.2-001", excelId: null, processName: "시스템 요구사항 분석", processId: "SYS.2",
  question: "요구사항이 분석되었는가?", phase: "설계", row: 3,
  draft: null, confirmed: null, status: "pending", confirmedBy: null, confirmedAt: null, ...over,
});
const procCrit = (over = {}) => ({
  linkedWpCheckIds: ["CH-SR-004"], relatedBPs: ["SYS.2.BP2"], aggregation: "default", ...over,
});
const ctx = { processes: P, wpCheckIds: new Set(["CH-SR-004"]) };

test("wp: 정상 기준은 확정 가능", () => {
  const r = canConfirmWp(wpItem(), wpCrit(), P);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
  assert.deepEqual(r.warnings, []);
});

test("wp: 기준 0개는 불가", () => {
  const r = canConfirmWp(wpItem(), wpCrit({ criteria: [] }), P);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("판정 기준")));
});

test("wp: 공백만 있는 기준은 0개로 취급", () => {
  const r = canConfirmWp(wpItem(), wpCrit({ criteria: [{ id: "a", text: "   " }] }), P);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("판정 기준")));
});

test("wp: 다른 프로세스의 유효한 BP는 허용", () => {
  assert.equal(canConfirmWp(wpItem(), wpCrit({ relatedBPs: ["SYS.2.BP1"] }), P).ok, true);
});

test("wp: 존재하지 않는 BP는 불가", () => {
  const r = canConfirmWp(wpItem(), wpCrit({ relatedBPs: ["MAN.3.BP99"] }), P);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("MAN.3.BP99")));
});

test("wp: 잘못된 심각도는 불가", () => {
  const r = canConfirmWp(wpItem(), wpCrit({ severity: "높음" }), P);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("심각도")));
});

test("wp: processId null은 불가", () => {
  const r = canConfirmWp(wpItem({ processId: null }), wpCrit(), P);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("프로세스")));
});

test("wp: 대상 위치가 비어도 확정 가능, 경고 1개", () => {
  const r = canConfirmWp(wpItem(), wpCrit({ targetLocations: [] }), P);
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
});

test("wp: VWAY.PR + BP 0개는 확정 가능", () => {
  assert.equal(canConfirmWp(wpItem({ processId: "VWAY.PR" }), wpCrit({ relatedBPs: [] }), P).ok, true);
});

test("process: 정상 연결은 확정 가능", () => {
  const r = canConfirmProcess(procItem(), procCrit(), ctx);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reasons, []);
});

test("process: 연결 0개는 불가", () => {
  const r = canConfirmProcess(procItem(), procCrit({ linkedWpCheckIds: [] }), ctx);
  assert.equal(r.ok, false);
});

test("process: 없는 연결 ID는 불가, 이유에 ID 포함", () => {
  const r = canConfirmProcess(procItem(), procCrit({ linkedWpCheckIds: ["CH-SR-004", "CH-XX-999"] }), ctx);
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes("CH-XX-999")));
});

test("process: 연결된 산출물 항목이 미확정이어도 확정 가능", () => {
  // wpCheckIds는 존재 여부만 본다(확정 여부 무관)
  assert.equal(canConfirmProcess(procItem(), procCrit(), ctx).ok, true);
});

test("process: 잘못된 BP, processId null은 불가; VWAY.PR + BP 0개는 가능", () => {
  assert.equal(canConfirmProcess(procItem(), procCrit({ relatedBPs: ["SYS.2.BP99"] }), ctx).ok, false);
  assert.equal(canConfirmProcess(procItem({ processId: null }), procCrit(), ctx).ok, false);
  assert.equal(canConfirmProcess(procItem({ processId: "VWAY.PR" }), procCrit({ relatedBPs: [] }), ctx).ok, true);
});

test("confirmItem: 새 객체, 상태·확정자 기록, 원문 불변", () => {
  const item = wpItem({ draft: wpCrit() });
  const crit = wpCrit({ severity: "중" });
  const out = confirmItem(item, crit, { user: "홍길동", now: "2026-10-27T00:00:00Z" });
  assert.notEqual(out, item);
  assert.equal(item.status, "pending");
  assert.equal(out.status, "confirmed");
  assert.deepEqual(out.confirmed, crit);
  assert.equal(out.confirmedBy, "홍길동");
  assert.equal(out.confirmedAt, "2026-10-27T00:00:00Z");
  assert.equal(out.question, item.question);
  assert.equal(out.checkId, item.checkId);
  assert.equal(out.area, item.area);
  assert.deepEqual(out.draft, item.draft);
});

test("unconfirmItem: draft 있으면 drafted, 없으면 pending", () => {
  const base = { user: "u", now: "t" };
  const a = unconfirmItem(confirmItem(wpItem({ draft: wpCrit() }), wpCrit(), base));
  assert.equal(a.status, "drafted");
  assert.equal(a.confirmed, null);
  const b = unconfirmItem(confirmItem(wpItem(), wpCrit(), base));
  assert.equal(b.status, "pending");
  assert.equal(b.confirmed, null);
});
