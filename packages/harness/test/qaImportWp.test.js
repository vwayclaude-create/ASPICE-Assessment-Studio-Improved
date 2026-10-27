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
    "applicable", "area", "checkId", "confirmed", "confirmedAt", "confirmedBy",
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

test("blank check id / blank question → error", () => {
  const x = imp(inline("1.프로젝트계획서", [["", "", "정확성", "q1"], ["", "A-2", "정확성", ""]]));
  assert.equal(x.issues.filter((i) => i.level === "error").length, 2);
  assert.equal(x.items.length, 0);
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

test("sheet missing item_id header → sheet error; others still import", () => {
  const b = inline("1.프로젝트계획서", [["", "A-1", "", "q"]]);
  b.sheets.push({ name: "bad", rows: [["a", "b"], ["x", "y"]] });
  const x = imp(b);
  assert.equal(x.items.length, 1);
  assert.ok(x.issues.some((i) => i.sheet === "bad" && i.level === "error"));
});
