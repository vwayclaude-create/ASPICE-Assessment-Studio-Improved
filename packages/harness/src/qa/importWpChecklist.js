// Browser-safe: no node:* imports.
import { processIdForSheet, normalizeName } from "./processNameMap.js";

const str = (v) => (v == null ? "" : String(v));
const NOT_APPLICABLE = new Set(["N", "아니오", "미적용"]);

export function importWpChecklist(book, { fileName, sheetOverrides = {} } = {}) {
  const items = [];
  const issues = [];
  const sheetNames = [];
  const seen = new Set();
  const issue = (level, sheet, row, message) =>
    issues.push({ level, file: fileName, sheet, row, message });

  const sheets = book?.sheets ?? [];
  const headers = sheets.map((sh) => {
    const names = (sh.rows?.[0] ?? []).map((c) => str(c).trim());
    return { idCol: names.indexOf("item_id"), qCol: names.indexOf("item_title"), names };
  });

  if (sheets.length === 0 || headers.every((h) => h.idCol < 0 || h.qCol < 0)) {
    issue("error", "", null, "산출물 체크리스트 형식이 아닙니다 (1행에 item_id, item_title 필드명이 있는 시트가 없습니다)");
    return { items, issues, sheetNames };
  }

  sheets.forEach((sh, si) => {
    const { idCol, qCol, names } = headers[si];
    if (idCol < 0 || qCol < 0) {
      issue("error", sh.name, 1, "1행에 item_id 또는 item_title 필드명이 없어 시트를 가져오지 않았습니다");
      return;
    }
    sheetNames.push(sh.name);
    const areaCol = names.indexOf("col06");
    const appCol = names.indexOf("col35");
    const startRow = sh.startRow ?? 1;
    const processId = processIdForSheet(sh.name, sheetOverrides);
    const workProduct = normalizeName(sh.name);
    let count = 0;

    // rows[0]=field names, rows[1]=Korean header, data from rows[2]
    for (let i = 2; i < sh.rows.length; i++) {
      const r = sh.rows[i];
      const checkId = str(r[idCol]).trim();
      const question = str(r[qCol]).trim();
      if (!checkId && !question) continue;
      const row = startRow + i;
      if (!checkId) { issue("error", sh.name, row, "체크 ID가 비어 있습니다"); continue; }
      if (!question) { issue("error", sh.name, row, `검토 항목이 비어 있습니다 (${checkId})`); continue; }
      if (seen.has(checkId)) { issue("error", sh.name, row, `체크 ID가 중복됩니다 (${checkId})`); continue; }
      seen.add(checkId);
      const raw = {};
      names.forEach((n, c) => { if (n) raw[n] = r[c] ?? ""; });
      items.push({
        checkId,
        workProduct,
        sheet: sh.name,
        row,
        processId,
        area: areaCol >= 0 ? str(r[areaCol]).trim() : "",
        question,
        applicable: appCol >= 0 ? !NOT_APPLICABLE.has(str(r[appCol]).trim()) : true,
        raw,
        draft: null,
        confirmed: null,
        status: "pending",
        confirmedBy: null,
        confirmedAt: null,
        customRuleIds: [],
      });
      count++;
    }
    if (count === 0) issue("warning", sh.name, null, "가져올 항목이 없습니다");
    if (processId == null) issue("warning", sh.name, null, "프로세스 지정 필요: 대응표에 없는 시트 이름입니다");
  });

  return { items, issues, sheetNames };
}
