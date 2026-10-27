import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readWorkbook } from "../src/qa/readWorkbook.js";
import { importProcessChecklist } from "../src/qa/importProcessChecklist.js";

const fx = (n) => fileURLToPath(new URL(`./fixtures/qa/${n}`, import.meta.url));
const book = readWorkbook(readFileSync(fx("process_checklist.xlsx")));
const r = importProcessChecklist(book, { fileName: "process_checklist.xlsx" });

const inline = (data) => ({
  sheets: [{ name: "양식", rows: [["항목 ID", "프로세스", "심사 항목"], ["", "", "", "평가"], ...data] }],
});
const imp = (b, o = {}) => importProcessChecklist(b, { fileName: "x.xlsx", ...o });

test("reads 양식 only, skips header/blank/total rows", () => {
  assert.equal(r.items.length, 6 + 3 + 2 + 1);
  assert.deepEqual(r.sheetNames, ["양식"]);
  assert.ok(!r.items.some((i) => /준수율/.test(i.question)));
});

test("auto ids per process, placeholder ignored", () => {
  const sys2 = r.items.filter((i) => i.processId === "SYS.2");
  assert.equal(sys2.length, 6);
  assert.deepEqual(sys2.map((i) => i.itemId).slice(0, 2), ["QA-SYS.2-001", "QA-SYS.2-002"]);
  assert.equal(sys2[0].excelId, null);
  assert.equal(sys2[0].row, 5);
});

test("phase from 비고, judgement/score columns not imported", () => {
  assert.equal(r.items[0].phase, "분석");
  assert.ok(!("score" in r.items[0]) && !("judgement" in r.items[0]));
  assert.equal(r.items[0].status, "pending");
  assert.equal(r.items[0].draft, null);
  assert.equal(r.items[0].confirmedBy, null);
});

test("unknown process name → error, processId null", () => {
  assert.ok(r.issues.some((x) => x.level === "error" && /없는 프로세스/.test(x.message)));
  assert.equal(r.items.find((i) => i.processName === "없는 프로세스").processId, null);
});

test("VWAY.PR mapped", () => assert.ok(r.items.some((i) => i.processId === "VWAY.PR")));

test("real excel id kept as itemId and excelId; duplicate id is error", () => {
  const out = imp(inline([
    ["QA-A-1", "프로젝트 관리", "q1"],
    ["QA-A-1", "프로젝트 관리", "q2"],
  ]));
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].itemId, "QA-A-1");
  assert.equal(out.items[0].excelId, "QA-A-1");
  assert.ok(out.issues.some((x) => x.level === "error" && /중복/.test(x.message) && x.row === 4));
});

test("processNameOverrides map unknown names, no error", () => {
  const out = imp(inline([["", "없는 프로세스", "q"]]), { processNameOverrides: { "없는 프로세스": "SWE.1" } });
  assert.equal(out.items[0].processId, "SWE.1");
  assert.equal(out.items[0].itemId, "QA-SWE.1-001");
  assert.equal(out.issues.length, 0);
});

test("missing question or process name → row error", () => {
  const out = imp(inline([["", "프로젝트 관리", ""], ["", "", "q"]]));
  assert.equal(out.items.length, 0);
  assert.equal(out.issues.filter((x) => x.level === "error").length, 2);
});

test("wp checklist in process slot → single format error", () => {
  const wp = readWorkbook(readFileSync(fx("wp_checklist.xlsx")));
  const out = importProcessChecklist(wp, { fileName: "wp_checklist.xlsx" });
  assert.equal(out.items.length, 0);
  assert.equal(out.issues.length, 1);
  assert.equal(out.issues[0].level, "error");
  assert.match(out.issues[0].message, /형식/);
});

test("two distinct unknown process names both import with distinct ids", () => {
  const out = imp(inline([["", "가 프로세스", "q1"], ["", "나 프로세스", "q2"]]));
  assert.deepEqual(out.items.map((i) => i.itemId), ["QA-UNMAPPED-001", "QA-UNMAPPED-002"]);
  assert.ok(!out.issues.some((x) => /중복/.test(x.message)));
});

// ---- VWAY variants (spec 3.3) ----
test("4.1 process sheet: real ids, (ACQ.4) parens, group/total rows and CL2/요약 skipped silently", () => {
  const out = importProcessChecklist(readWorkbook(readFileSync(fx("process_41.xlsx"))), { fileName: "process_41.xlsx" });
  assert.deepEqual(out.sheetNames, ["통합 프로세스 감사"]);
  assert.deepEqual(out.issues, []);
  assert.deepEqual(out.items.map((i) => i.itemId), ["QA-ACQ4-001", "QA-ACQ4-002", "QA-SPL2-001", "QA-SPL2-002"]);
  assert.deepEqual(out.items.map((i) => i.processId), ["ACQ.4", "ACQ.4", "SPL.2", "SPL.2"]);
  const a = out.items[0];
  assert.equal(a.excelId, "QA-ACQ4-001");
  assert.equal(a.processName, "공급자 모니터링 (ACQ.4)");
  assert.equal(a.phase, "계획");
  assert.match(a.basis, /^ACQ\.4\.BP1: /);
  assert.equal(a.row, 5);
});

test("basis from 참고 column ('' when absent)", () => {
  assert.equal(r.items[0].basis, "");
  const out = imp({ sheets: [{ name: "양식", rows: [["항목 ID", "프로세스", "심사 항목", "참고"], ["", "프로젝트 관리", "q", "MAN.3.BP1"]] }] });
  assert.equal(out.items[0].basis, "MAN.3.BP1");
});

test("non-checklist workbook → one format error listing what was found", () => {
  const out = imp({ sheets: [{ name: "Data", rows: [["이름", "나이"], ["a", 1]] }] });
  assert.equal(out.issues.length, 1);
  assert.equal(out.issues[0].level, "error");
  assert.match(out.issues[0].message, /형식/);
  assert.ok(out.issues[0].message.includes("Data") && out.issues[0].message.includes("이름"));
});

test("extra header-less sheet → one warning; name override beats parens", () => {
  const b = inline([["", "공급자 모니터링 (ACQ.4)", "q"]]);
  b.sheets.push({ name: "메모", rows: [["아무", "내용"]] });
  const out = imp(b, { processNameOverrides: { "공급자 모니터링 (ACQ.4)": "SPL.2" } });
  assert.equal(out.items[0].processId, "SPL.2");
  const w = out.issues.filter((x) => x.sheet === "메모");
  assert.equal(w.length, 1);
  assert.equal(w[0].level, "warning");
  assert.match(w[0].message, /머리글을 찾지 못해 건너뜀/);
});
