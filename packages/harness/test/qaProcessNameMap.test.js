import { test } from "node:test";
import assert from "node:assert/strict";
import { loadProcesses } from "../spec/canonical/index.js";
import {
  VWAY_PR, normalizeName, processIdForSheet, processIdForProcessName, bpCatalog, isValidBpId,
} from "../src/qa/index.js";

const P = loadProcesses();

const SHEETS = [
  ["1.프로젝트계획서", "MAN.3"],
  ["2.동료검토 계획서", "VWAY.PR"],
  ["3.형상관리 계획서", "SUP.8"],
  ["4.문제해결관리 계획서", "SUP.9"],
  ["5.품질보증 계획서", "SUP.1"],
  ["6.변경요청 관리 계획서", "SUP.10"],
  ["7.위험관리 계획서", "MAN.5"],
  ["8.시스템 요구사항 명세서", "SYS.2"],
  ["9.시스템 아키텍처 설계서", "SYS.3"],
  ["10.시스템 통합 및 통합 검증 계획서", "SYS.4"],
  ["11. 시스템 통합 테스트 케이스", "SYS.4"],
  ["12.시스템 요구사항 검증 계획서", "SYS.5"],
  ["13. 시스템 요구사항 테스트 케이스", "SYS.5"],
  ["14.소프트웨어 요구사항 명세서", "SWE.1"],
  ["15.소프트웨어 아키텍처 설계서", "SWE.2"],
  ["16.소프트웨어 상세 설계서", "SWE.3"],
  ["17. 소프트웨어 유닛 검증 계획서", "SWE.4"],
  ["18. 소프트웨어 유닛 테스트 케이스", "SWE.4"],
  ["19. 소프트웨어 컴포넌트 검증 및 통합 검증 계획서", "SWE.5"],
  ["19. 소프트웨어 컴포너트 검증 및 통합 검증 계획서", "SWE.5"],
  ["20. 소프트웨어 컴포너트 테스트 및 통합 테스트 케이스", "SWE.5"],
  ["20. 소프트웨어 컴포넌트 테스트 및 통합 테스트 케이스", "SWE.5"],
  ["21. 소프트웨어 요구사항 검증 계획서", "SWE.6"],
  ["22. 소프트웨어 요구사항 테스트 케이스 ", "SWE.6"],
  ["22. 소프트웨어 소스코드", "SWE.3"],
];

test("sheet names map per spec 3.1", () => {
  for (const [name, id] of SHEETS) assert.equal(processIdForSheet(name), id, name);
  assert.equal(processIdForSheet("99. 모르는 시트"), null);
  assert.equal(processIdForSheet("99. 모르는 시트", { "99. 모르는 시트": "SUP.1" }), "SUP.1");
  assert.equal(processIdForSheet("1.프로젝트계획서", { "1.프로젝트계획서": "SUP.1" }), "SUP.1");
});

const NAMES = [
  ["시스템 요구사항 분석", "SYS.2"],
  ["시스템 아키텍처 설계", "SYS.3"],
  ["시스템 통합 및 통합 검증", "SYS.4"],
  ["시스템 요구사항 검증", "SYS.5"],
  ["소프트웨어 요구사항 분석", "SWE.1"],
  ["소프트웨어 아키텍처 설계", "SWE.2"],
  ["소프트웨어 상세 설계 및 구현", "SWE.3"],
  ["소프트웨어 단위 검증", "SWE.4"],
  ["소프트웨어 컴포넌트 검증 및 통합 검증", "SWE.5"],
  ["소프트웨어 요구사항 검증", "SWE.6"],
  ["프로젝트 관리", "MAN.3"],
  ["형상관리", "SUP.8"],
  ["문제해결 관리", "SUP.9"],
  ["변경 요청 관리", "SUP.10"],
  ["산출물 동료 검토", "VWAY.PR"],
];

test("process names map per spec 3.2", () => {
  for (const [name, id] of NAMES) assert.equal(processIdForProcessName(name), id, name);
  assert.equal(processIdForProcessName("변경요청 관리"), "SUP.10");
  assert.equal(processIdForProcessName("없는 프로세스"), null);
  assert.equal(processIdForProcessName("없는 프로세스", { "없는 프로세스": "SUP.1" }), "SUP.1");
});

test("normalizeName strips leading number and whitespace", () => {
  assert.equal(normalizeName(" 22. 소프트웨어  소스코드 "), "소프트웨어소스코드");
  assert.equal(VWAY_PR, "VWAY.PR");
});

test("bpCatalog prefixes ids and handles VWAY.PR", () => {
  assert.equal(bpCatalog(P, "MAN.3")[0].id, "MAN.3.BP1");
  assert.deepEqual(Object.keys(bpCatalog(P, "MAN.3")[0]), ["id", "title", "description"]);
  assert.deepEqual(bpCatalog(P, "VWAY.PR"), []);
  assert.deepEqual(bpCatalog(P, "NOPE.1"), []);
  assert.equal(isValidBpId(P, "MAN.3.BP5"), true);
  assert.equal(isValidBpId(P, "MAN.3.BP99"), false);
  assert.equal(isValidBpId(P, "VWAY.PR.BP1"), false);
});
