// Browser-safe: no node:* imports.
import { processIdForProcessName } from "./processNameMap.js";

const str = (v) => (v == null ? "" : String(v).trim());
const PLACEHOLDER = /X{2,}/i;
const SHEET = "양식";
// Columns of the 양식 sheet (spec 3.2): A id, B process, C question, F ref, G phase
const COL = { id: 0, process: 1, question: 2, ref: 5, phase: 6 };

export function importProcessChecklist(book, { fileName, processNameOverrides = {} } = {}) {
  const items = [];
  const issues = [];
  const sheetNames = [];
  const issue = (level, row, message) =>
    issues.push({ level, file: fileName, sheet: SHEET, row, message });

  const sh = (book?.sheets ?? []).find((s) => s.name === SHEET);
  const rows = sh?.rows ?? [];
  const headerIdx = rows.findIndex((r) => str(r[COL.process]) === "프로세스");
  if (!sh || headerIdx < 0) {
    issues.push({
      level: "error", file: fileName, sheet: "", row: null,
      message: "프로세스 체크리스트 형식이 아닙니다 (양식 시트에 '프로세스' 헤더가 없습니다)",
    });
    return { items, issues, sheetNames };
  }
  sheetNames.push(SHEET);

  const startRow = sh.startRow ?? 1;
  const seen = new Set();
  const counters = {};
  const warnedNames = new Set();

  // two merged header rows, data from headerIdx + 2
  for (let i = headerIdx + 2; i < rows.length; i++) {
    const r = rows[i];
    const processName = str(r[COL.process]);
    const question = str(r[COL.question]);
    if (str(r[COL.ref]) === "프로세스 준수율") continue;
    if (!processName && !question) continue;
    const row = startRow + i;
    if (!processName) { issue("error", row, "프로세스 이름이 비어 있습니다"); continue; }
    if (!question) { issue("error", row, `심사 항목이 비어 있습니다 (${processName})`); continue; }

    const processId = processIdForProcessName(processName, processNameOverrides);
    if (processId == null && !warnedNames.has(processName)) {
      warnedNames.add(processName);
      issue("error", row, `대응표에 없는 프로세스 이름입니다: ${processName} (QA가 프로세스를 지정해야 합니다)`);
    }

    const rawId = str(r[COL.id]);
    const excelId = rawId && !PLACEHOLDER.test(rawId) ? rawId : null;
    const key = processId ?? `?${processName}`;
    counters[key] = (counters[key] ?? 0) + 1;
    const itemId = excelId ?? `QA-${processId ?? "UNMAPPED"}-${String(counters[key]).padStart(3, "0")}`;
    if (seen.has(itemId)) { issue("error", row, `항목 ID가 중복됩니다 (${itemId})`); continue; }
    seen.add(itemId);

    items.push({
      itemId,
      excelId,
      processName,
      processId,
      question,
      phase: str(r[COL.phase]),
      row,
      draft: null,
      confirmed: null,
      status: "pending",
      confirmedBy: null,
      confirmedAt: null,
    });
  }
  if (items.length === 0) issue("warning", null, "가져올 항목이 없습니다");
  return { items, issues, sheetNames };
}
