import { test } from "node:test";
import assert from "node:assert/strict";
import { detectHeader, isSkippedSheet, aspiceIdIn, firstCells } from "../src/qa/index.js";

test("detectHeader: codebeamer field row, Korean second header row skipped", () => {
  const h = detectHeader([
    ["seq_no", "item_id", "col06", "item_title", "col35"],
    ["No.", "체크리트스 ID", "영역", "검토 항목 (필수)", "적용 여부"],
    ["", "CH-1", "정확성", "q"],
  ]);
  assert.equal(h.index, 0);
  assert.equal(h.dataStart, 2);
  assert.deepEqual([h.cols.id, h.cols.question, h.cols.area, h.cols.applicable], [1, 3, 2, 4]);
});

test("detectHeader: title row above, Korean header, basis/phase prefixes, workProduct with leading space", () => {
  const h = detectHeader([
    ["", "", ""],
    ["프로젝트 계획서 체크리스트"],
    ["관련 프로세스: MAN.3"],
    ["No.", "체크리스트 ID", "영역", "검토항목", "적용여부", "근거 (ASPICE 4.1 BP/OII·Guideline)", " 산출물", "비고 (단계)"],
    [1, "CH-PP-001", "준수성", "q"],
  ]);
  assert.equal(h.index, 3);
  assert.equal(h.dataStart, 4);
  assert.deepEqual(h.cols, { id: 1, question: 3, area: 2, applicable: 4, basis: 5, workProduct: 6, process: -1, phase: 7 });
});

test("detectHeader: 판단/점수 sub-header skipped; needs question + (id|process|workProduct)", () => {
  const h = detectHeader([
    ["항목 ID", "프로세스", "심사 항목", "평가", "", "참고"],
    ["", "", "", "판단", "점수", ""],
    ["QA-1", "프로젝트 관리", "q"],
  ]);
  assert.equal(h.dataStart, 2);
  assert.equal(h.cols.process, 1);
  assert.equal(h.cols.basis, 5);
  assert.equal(detectHeader([["No.", "검토항목", "영역"], ["1", "q", "a"]]), null);
  assert.equal(detectHeader([["이름", "나이"]]), null);
});

test("detectHeader: only the first 10 non-blank rows are scanned", () => {
  const filler = Array.from({ length: 10 }, (_, i) => [`t${i}`]);
  assert.equal(detectHeader([...filler, ["체크리스트 ID", "검토항목"]]), null);
  assert.ok(detectHeader([[""], [""], ...filler.slice(1), ["체크리스트 ID", "검토항목"]]));
});

test("isSkippedSheet: skip words and CL2 prefix", () => {
  for (const n of ["표지", "개정이력", "작성 기준", "산출물 목록", "요약", "ASPICE 4.1 변경사항", "가이드라인 판정규칙", "전체 통합", "목차", "CL2 공통(GP)"]) {
    assert.equal(isSkippedSheet(n), true, n);
  }
  for (const n of ["1. 프로젝트 계획서 ", "양식", "통합 프로세스 감사", "45. 변경 요청서"]) assert.equal(isSkippedSheet(n), false, n);
});

test("aspiceIdIn / firstCells", () => {
  assert.equal(aspiceIdIn("공급자 모니터링 (ACQ.4)"), "ACQ.4");
  assert.equal(aspiceIdIn("관련 프로세스: SUP.1.BP3, GP 2.2.1"), "SUP.1");
  assert.equal(aspiceIdIn("QA-ACQ4-001"), null);
  assert.deepEqual(firstCells([["", ""], ["", "a", "", "b", "c", "d", "e", "f"]]), ["a", "b", "c", "d", "e"]);
});
