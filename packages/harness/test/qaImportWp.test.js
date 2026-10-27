import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readWorkbook } from "../src/qa/readWorkbook.js";
import { importWpChecklist } from "../src/qa/importWpChecklist.js";

const fx = (n) => fileURLToPath(new URL(`./fixtures/qa/${n}`, import.meta.url));
const book = readWorkbook(readFileSync(fx("wp_checklist.xlsx")));
const r = importWpChecklist(book, { fileName: "wp_checklist.xlsx" });

const HEAD = ["seq_no", "item_id", "col06", "item_title", "col35"];
const inline = (name, data) => ({
  sheets: [{ name, rows: [[...HEAD], ["No.", "ID", "영역", "항목"], ...data] }],
});
const imp = (b) => importWpChecklist(b, { fileName: "x.xlsx" });

test("reads items by codebeamer field row, skips blank rows", () => {
  const pp = r.items.filter((i) => i.sheet === "1.프로젝트계획서");
  assert.equal(pp.length, 6);
  assert.deepEqual(Object.keys(pp[0]).sort(), [
    "applicable", "area", "basis", "checkId", "confirmed", "confirmedAt", "confirmedBy",
    "customRuleIds", "draft", "processId", "question", "raw", "row", "sheet",
    "status", "workProduct",
  ].sort());
  assert.equal(pp[0].processId, "MAN.3");
  assert.equal(pp[0].workProduct, "프로젝트계획서");
  assert.equal(pp[0].status, "pending");
  assert.equal(pp[0].row, 3);
  assert.deepEqual(pp[0].customRuleIds, []);
  assert.equal(pp[0].draft, null);
  assert.equal(pp[0].applicable, true);
  assert.equal(pp[0].basis, "");
});

test("trims area", () => assert.ok(r.items.some((i) => i.area === "준수성")));

test("two '22.' sheets map to different processes", () => {
  assert.ok(r.items.some((i) => i.sheet.startsWith("22. 소프트웨어 요구사항") && i.processId === "SWE.6"));
  assert.ok(r.items.some((i) => i.sheet === "22. 소프트웨어 소스코드" && i.processId === "SWE.3"));
});

test("header-only sheet → warning, no items", () => {
  assert.ok(r.issues.some((x) => x.sheet === "99. 헤더만" && x.level === "warning"));
  assert.ok(!r.items.some((i) => i.sheet === "99. 헤더만"));
  assert.equal(r.sheetNames.length, 4);
});

test("process checklist in wp slot → single format error, no items", () => {
  const bad = importWpChecklist(readWorkbook(readFileSync(fx("process_checklist.xlsx"))), { fileName: "p.xlsx" });
  assert.equal(bad.items.length, 0);
  assert.equal(bad.issues.length, 1);
  assert.ok(bad.issues.some((x) => x.level === "error" && /형식/.test(x.message)));
});

test("duplicate check id → error on second row", () => {
  const x = imp(inline("1.프로젝트계획서", [["", "A-1", "정확성", "q1"], ["", "A-1", "정확성", "q2"]]));
  const errs = x.issues.filter((i) => i.level === "error");
  assert.equal(errs.length, 1);
  assert.equal(errs[0].row, 4);
  assert.equal(x.items.length, 1);
});

test("blank question → error; blank check id with a question → auto id (CH-<sheet no.>-NNN)", () => {
  const x = imp(inline("1.프로젝트계획서", [["", "", "정확성", "q1"], ["", "A-2", "정확성", ""]]));
  assert.equal(x.issues.filter((i) => i.level === "error").length, 1);
  assert.deepEqual(x.items.map((i) => i.checkId), ["CH-1-001"]);
});

test("unknown sheet → warning and processId null", () => {
  const x = imp(inline("77.없는 산출물", [["", "A-3", "", "q"]]));
  assert.equal(x.items[0].processId, null);
  assert.ok(x.issues.some((i) => i.level === "warning" && /프로세스 지정 필요/.test(i.message)));
});

test("sheetOverrides applies", () => {
  const x = importWpChecklist(inline("77.없는 산출물", [["", "A-3", "", "q"]]),
    { fileName: "x", sheetOverrides: { "77.없는 산출물": "SYS.2" } });
  assert.equal(x.items[0].processId, "SYS.2");
  assert.ok(!x.issues.some((i) => /프로세스 지정 필요/.test(i.message)));
});

test("col35 N → applicable false", () => {
  const y = imp(inline("1.프로젝트계획서", [["", "A-4", "", "q", "N"], ["", "A-5", "", "q", "아니오"], ["", "A-6", "", "q", ""]]));
  assert.deepEqual(y.items.map((i) => i.applicable), [false, false, true]);
});

test("sheet without a header → one warning; others still import", () => {
  const b = inline("1.프로젝트계획서", [["", "A-1", "", "q"]]);
  b.sheets.push({ name: "bad", rows: [["a", "b"], ["x", "y"]] });
  const x = imp(b);
  assert.equal(x.items.length, 1);
  const bad = x.issues.filter((i) => i.sheet === "bad");
  assert.equal(bad.length, 1);
  assert.equal(bad[0].level, "warning");
  assert.match(bad[0].message, /머리글을 찾지 못해 건너뜀/);
});

// ---- VWAY variants (spec 3.3) ----
const load = (n) => importWpChecklist(readWorkbook(readFileSync(fx(n))), { fileName: n });
const NEED = /프로세스 지정 필요/;

test("B 4.0: Korean header under a title row, sheet-name process map", () => {
  const x = load("wp_b40.xlsx");
  assert.equal(x.items.length, 5);
  assert.deepEqual(x.issues, []);
  const pp = x.items[0];
  assert.equal(pp.checkId, "CH-PP-001");
  assert.equal(pp.row, 5);
  assert.equal(pp.area, "준수성");
  assert.equal(pp.workProduct, "프로젝트계획서");
  assert.equal(pp.processId, "MAN.3");
  assert.equal(pp.basis, "");
  assert.ok(x.items.filter((i) => i.sheet === "3. 형상관리 계획서").every((i) => i.processId === "SUP.8"));
});

test("B 4.1: 관련 프로세스 line, 산출물 목록 mapping + ID prefix, skipped sheets silent", () => {
  const x = load("wp_b41.xlsx");
  assert.deepEqual(x.sheetNames, ["27. 하드웨어 아키텍처 설계서", "39. 공급자 관리 계획서"]);
  assert.equal(x.items.length, 6);
  assert.deepEqual(x.issues, []);
  const hw = x.items.filter((i) => i.sheet.startsWith("27."));
  assert.ok(hw.every((i) => i.processId === "HWE.2"));
  assert.equal(hw[0].basis, "GP 2.2.1 / 17-05");
  const spm = x.items.filter((i) => i.sheet.startsWith("39."));
  assert.ok(spm.every((i) => i.processId === "ACQ.4"));
  assert.deepEqual(spm.map((i) => i.checkId), ["CH-SPM-001", "CH-SPM-002", "CH-SPM-003"]);
  assert.ok(!x.items.some((i) => i.sheet === "전체 통합" || i.sheet === "표지"));
});

test("B no-ID: every row gets CH-<sheet no.>-NNN", () => {
  const x = load("wp_noid.xlsx");
  assert.deepEqual(x.items.map((i) => i.checkId), ["CH-1-001", "CH-1-002", "CH-1-003"]);
  assert.ok(x.items.every((i) => i.processId === "MAN.3"));
  assert.ok(!x.issues.some((i) => i.level === "error"));
});

test("D single sheet: 산출물 column, row 프로세스 cell, one warning per unmapped process value", () => {
  const x = load("wp_single.xlsx");
  assert.equal(x.items.length, 4);
  assert.deepEqual(x.items.map((i) => i.checkId), ["QA-WCK-001", "CH-WP-001", "CH-WP-002", "CH-WP-003"]);
  assert.deepEqual(x.items.map((i) => i.workProduct), ["산출물 공통", "산출물 공통", "문제 해결 관리 계획서", "프로젝트 단계 보고서"]);
  assert.deepEqual(x.items.map((i) => i.processId), [null, null, null, "MAN.3"]);
  const need = x.issues.filter((i) => NEED.test(i.message));
  assert.equal(need.length, 2);
  assert.ok(need.every((i) => i.level === "warning"));
  assert.ok(need.some((i) => i.message.includes("공통")) && need.some((i) => i.message.includes("문제 해결 및 관리")));
  assert.ok(!x.issues.some((i) => i.level === "error"));
});

test("row 프로세스 cell: ASPICE id wins over sheet name; sheetOverrides win over both", () => {
  const b = { sheets: [{ name: "1.프로젝트계획서", rows: [
    ["항목 ID", "프로세스", "산출물", "심사 항목"],
    ["X-1", "공급자 모니터링 (ACQ.4)", "w", "q1"],
    ["X-2", "", "w", "q2"],
  ] }] };
  assert.deepEqual(imp(b).items.map((i) => i.processId), ["ACQ.4", "MAN.3"]);
  const o = importWpChecklist(b, { fileName: "x", sheetOverrides: { "1.프로젝트계획서": "SYS.2" } });
  assert.deepEqual(o.items.map((i) => i.processId), ["SYS.2", "SYS.2"]);
});

test("auto ids skip real ids already used in the file", () => {
  const x = imp(inline("5.품질보증 계획서", [["", "", "", "q1"], ["", "CH-5-001", "", "q2"], ["", "", "", "q3"]]));
  assert.deepEqual(x.items.map((i) => i.checkId), ["CH-5-002", "CH-5-001", "CH-5-003"]);
  const y = imp(inline("품질", [["", "", "", "q1"]]));
  assert.equal(y.items[0].checkId, "CH-WP-001");
});

test("group title rows (one text cell, no question) are skipped silently", () => {
  const x = imp(inline("1.프로젝트계획서", [["", "1. 계획 수립 그룹"], ["", "A-1", "", "q"]]));
  assert.equal(x.items.length, 1);
  assert.deepEqual(x.issues, []);
});

test("non-checklist workbook → one format error listing what was found", () => {
  const x = imp({ sheets: [
    { name: "Data", rows: [[""], ["이름", "나이", "주소"], ["a", 1, "b"]] },
    { name: "표지", rows: [["로고", "", "제목"]] },
  ] });
  assert.equal(x.items.length, 0);
  assert.equal(x.issues.length, 1);
  assert.equal(x.issues[0].level, "error");
  assert.match(x.issues[0].message, /형식/);
  assert.ok(x.issues[0].message.includes("Data") && x.issues[0].message.includes("이름") && x.issues[0].message.includes("주소"));
});
