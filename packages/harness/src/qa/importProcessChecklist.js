// Browser-safe: no node:* imports.
import { processIdForProcessName } from "./processNameMap.js";
import { detectHeader, isSkippedSheet, formatErrorMessage, NO_HEADER } from "./headerDetect.js";

const str = (v) => (v == null ? "" : String(v).trim());
const PLACEHOLDER = /X{2,}/i;
const TOTAL = "프로세스 준수율";
// "공급자 모니터링 (ACQ.4)" (4.1 통합형)
const PAREN_ID = /\(\s*((?:ACQ|SPL|SYS|SWE|HWE|MLE|VAL|SUP|MAN|PIM|REU)\.\d+)\s*\)/;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o ?? {}, k);

// Columns come from the header row (spec 3.2, 3.3): 항목 ID, 프로세스, 심사 항목, 참고, 비고.
export function importProcessChecklist(book, { fileName, processNameOverrides = {} } = {}) {
  const items = [];
  const issues = [];
  const sheetNames = [];
  const issue = (level, sheet, row, message) =>
    issues.push({ level, file: fileName, sheet, row, message });

  const sheets = book?.sheets ?? [];
  // Needs 프로세스 + 심사 항목; a 산출물 column means a work-product checklist.
  const headers = sheets.map((sh) => {
    if (isSkippedSheet(sh.name)) return null;
    const h = detectHeader(sh.rows ?? []);
    return h && h.cols.process >= 0 && h.cols.workProduct < 0 ? h : null;
  });
  // Prefer sheets that also carry an ID column.
  if (headers.some((h) => h && h.cols.id >= 0)) {
    headers.forEach((h, i) => { if (h && h.cols.id < 0) headers[i] = null; });
  }
  if (headers.every((h) => !h)) {
    issue("error", "", null, formatErrorMessage(
      "프로세스 체크리스트 형식이 아닙니다 (프로세스·심사 항목 머리글이 있는 시트가 없습니다)", sheets));
    return { items, issues, sheetNames };
  }

  const seen = new Set();
  const counters = {};
  const warnedNames = new Set();
  const realIds = new Set();
  sheets.forEach((sh, si) => {
    const h = headers[si];
    if (!h || h.cols.id < 0) return;
    for (const r of sh.rows.slice(h.dataStart)) {
      const v = str(r[h.cols.id]);
      if (v && !PLACEHOLDER.test(v)) realIds.add(v);
    }
  });

  sheets.forEach((sh, si) => {
    const h = headers[si];
    if (!h) {
      if (!isSkippedSheet(sh.name)) issue("warning", sh.name, null, NO_HEADER);
      return;
    }
    sheetNames.push(sh.name);
    const { cols } = h;
    const cell = (r, c) => (c >= 0 ? str(r[c]) : "");
    const rows = sh.rows;
    const startRow = sh.startRow ?? 1;

    for (let i = h.dataStart; i < rows.length; i++) {
      const r = rows[i];
      const processName = cell(r, cols.process);
      const question = cell(r, cols.question);
      if (r.some((c) => str(c) === TOTAL)) continue;
      // Also covers group title rows such as "ACQ.4 공급자 모니터링 ..." in the ID column.
      if (!processName && !question) continue;
      const row = startRow + i;
      if (!processName) { issue("error", sh.name, row, "프로세스 이름이 비어 있습니다"); continue; }
      if (!question) { issue("error", sh.name, row, `심사 항목이 비어 있습니다 (${processName})`); continue; }

      const processId = has(processNameOverrides, processName)
        ? processNameOverrides[processName]
        : PAREN_ID.exec(processName)?.[1] ?? processIdForProcessName(processName);
      if (processId == null && !warnedNames.has(processName)) {
        warnedNames.add(processName);
        issue("error", sh.name, row, `대응표에 없는 프로세스 이름입니다: ${processName} (QA가 프로세스를 지정해야 합니다)`);
      }

      const rawId = cell(r, cols.id);
      const excelId = rawId && !PLACEHOLDER.test(rawId) ? rawId : null;
      // Counter advances on every row (as before); auto IDs skip real IDs of the file.
      const key = processId ?? "UNMAPPED";
      const next = () => `QA-${key}-${String((counters[key] = (counters[key] ?? 0) + 1)).padStart(3, "0")}`;
      let itemId = next();
      if (excelId) itemId = excelId;
      else while (realIds.has(itemId)) itemId = next();
      if (seen.has(itemId)) { issue("error", sh.name, row, `항목 ID가 중복됩니다 (${itemId})`); continue; }
      seen.add(itemId);

      items.push({
        itemId,
        excelId,
        processName,
        processId,
        question,
        phase: cell(r, cols.phase),
        basis: cell(r, cols.basis),
        row,
        draft: null,
        confirmed: null,
        status: "pending",
        confirmedBy: null,
        confirmedAt: null,
      });
    }
  });
  if (items.length === 0) issue("warning", sheetNames[0] ?? "", null, "가져올 항목이 없습니다");
  return { items, issues, sheetNames };
}
