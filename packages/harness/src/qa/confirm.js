// Browser-safe: no node:* imports.
// Confirm conditions (spec 6.2) and status transitions (spec 6.1).
import { isValidBpId } from "./processNameMap.js";

const SEVERITIES = ["상", "중", "하"];

function invalidBps(processes, bps) {
  return (bps ?? []).filter((bp) => !isValidBpId(processes, bp));
}

export function canConfirmWp(item, criteria, processes) {
  const reasons = [];
  const warnings = [];
  const c = criteria ?? {};
  const rules = (c.criteria ?? []).filter((r) => String(r?.text ?? "").trim() !== "");
  if (rules.length === 0) reasons.push("판정 기준을 1개 이상 입력하세요.");
  const bad = invalidBps(processes, c.relatedBPs);
  if (bad.length) reasons.push(`유효하지 않은 BP: ${bad.join(", ")}`);
  if (!SEVERITIES.includes(c.severity)) reasons.push("심각도(상/중/하)를 지정하세요.");
  if (!item?.processId) reasons.push("프로세스를 지정하세요.");
  if (!(c.targetLocations ?? []).some((l) => String(l ?? "").trim() !== "")) {
    warnings.push("대상 위치가 비어 있습니다.");
  }
  return { ok: reasons.length === 0, reasons, warnings };
}

export function canConfirmProcess(item, criteria, { processes, wpCheckIds }) {
  const reasons = [];
  const warnings = [];
  const c = criteria ?? {};
  const linked = c.linkedWpCheckIds ?? [];
  if (linked.length === 0) {
    reasons.push("연결된 산출물 체크 ID를 1개 이상 지정하세요.");
  } else {
    const missing = linked.filter((id) => !wpCheckIds.has(id));
    if (missing.length) reasons.push(`이 버전에 없는 산출물 체크 ID: ${missing.join(", ")}`);
  }
  const bad = invalidBps(processes, c.relatedBPs);
  if (bad.length) reasons.push(`유효하지 않은 BP: ${bad.join(", ")}`);
  if (!item?.processId) reasons.push("프로세스를 지정하세요.");
  return { ok: reasons.length === 0, reasons, warnings };
}

export function confirmItem(item, criteria, { user, now }) {
  return { ...item, confirmed: criteria, status: "confirmed", confirmedBy: user, confirmedAt: now };
}

export function unconfirmItem(item) {
  return { ...item, status: item.draft ? "drafted" : "pending", confirmed: null };
}
