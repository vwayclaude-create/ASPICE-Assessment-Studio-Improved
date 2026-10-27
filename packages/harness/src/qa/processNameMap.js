// Browser-safe: no node:* imports.
export const VWAY_PR = "VWAY.PR";

export function normalizeName(s) {
  return String(s ?? "").replace(/^\s*\d+\.\s*/, "").replace(/\s+/g, "");
}

const fromPairs = (pairs) =>
  Object.fromEntries(pairs.map(([name, id]) => [normalizeName(name), id]));

// Spec 3.1: sheet (deliverable) name -> process ID
const SHEET_MAP = fromPairs([
  ["프로젝트계획서", "MAN.3"],
  ["동료검토 계획서", VWAY_PR],
  ["형상관리 계획서", "SUP.8"],
  ["문제해결관리 계획서", "SUP.9"],
  ["품질보증 계획서", "SUP.1"],
  ["변경요청 관리 계획서", "SUP.10"],
  ["위험관리 계획서", "MAN.5"],
  ["시스템 요구사항 명세서", "SYS.2"],
  ["시스템 아키텍처 설계서", "SYS.3"],
  ["시스템 통합 및 통합 검증 계획서", "SYS.4"],
  ["시스템 통합 테스트 케이스", "SYS.4"],
  ["시스템 요구사항 검증 계획서", "SYS.5"],
  ["시스템 요구사항 테스트 케이스", "SYS.5"],
  ["소프트웨어 요구사항 명세서", "SWE.1"],
  ["소프트웨어 아키텍처 설계서", "SWE.2"],
  ["소프트웨어 상세 설계서", "SWE.3"],
  ["소프트웨어 소스코드", "SWE.3"],
  ["소프트웨어 유닛 검증 계획서", "SWE.4"],
  ["소프트웨어 유닛 테스트 케이스", "SWE.4"],
  ["소프트웨어 컴포넌트 검증 및 통합 검증 계획서", "SWE.5"],
  ["소프트웨어 컴포너트 검증 및 통합 검증 계획서", "SWE.5"],
  ["소프트웨어 컴포넌트 테스트 및 통합 테스트 케이스", "SWE.5"],
  ["소프트웨어 컴포너트 테스트 및 통합 테스트 케이스", "SWE.5"],
  ["소프트웨어 요구사항 검증 계획서", "SWE.6"],
  ["소프트웨어 요구사항 테스트 케이스", "SWE.6"],
]);

// Spec 3.2: Korean process name -> process ID
const PROCESS_MAP = fromPairs([
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
  ["산출물 동료 검토", VWAY_PR],
]);

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function processIdForSheet(sheetName, overrides = {}) {
  if (overrides && has(overrides, sheetName)) return overrides[sheetName];
  const key = normalizeName(sheetName);
  return has(SHEET_MAP, key) ? SHEET_MAP[key] : null;
}

export function processIdForProcessName(name, overrides = {}) {
  if (overrides && has(overrides, name)) return overrides[name];
  const key = normalizeName(name);
  return has(PROCESS_MAP, key) ? PROCESS_MAP[key] : null;
}

export function bpCatalog(processes, processId) {
  const proc = (processes ?? []).find((p) => p.id === processId);
  if (!proc) return [];
  return (proc.basePractices ?? []).map((bp) => ({
    id: `${processId}.${bp.id}`,
    title: bp.title,
    description: bp.description,
  }));
}

export function isValidBpId(processes, bpId) {
  const m = /^(.+)\.(BP\d+)$/.exec(String(bpId ?? ""));
  if (!m) return false;
  return bpCatalog(processes, m[1]).some((bp) => bp.id === bpId);
}
