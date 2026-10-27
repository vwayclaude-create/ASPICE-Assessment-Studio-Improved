// Browser-safe: no node:* imports.
import { processIdForSheet, processIdForProcessName, normalizeName } from "./processNameMap.js";
import {
  detectHeader, isSkippedSheet, aspiceIdIn, normHeader, formatErrorMessage, NO_HEADER,
} from "./headerDetect.js";

const str = (v) => (v == null ? "" : String(v));
const NOT_APPLICABLE = new Set(["N", "아니오", "미적용"]);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o ?? {}, k);

// 산출물 목록 sheet (4.1 통합형): normalized sheet name -> { processId, prefix }
function readWorkProductList(sheets) {
  const map = new Map();
  const sh = sheets.find((s) => normHeader(s.name).includes("산출물목록"));
  if (!sh) return map;
  const rows = sh.rows ?? [];
  const h = rows.slice(0, 15).findIndex((r) => r.some((c) => normHeader(c) === "시트"));
  if (h < 0) return map;
  const col = (name) => rows[h].findIndex((c) => normHeader(c) === name);
  const [sheetCol, prefixCol, procCol] = [col("시트"), col("id접두어"), col("관련프로세스")];
  for (const r of rows.slice(h + 1)) {
    const key = normalizeName(str(r[sheetCol]).trim());
    if (!key) continue;
    map.set(key, {
      processId: procCol >= 0 ? aspiceIdIn(r[procCol]) : null,
      prefix: prefixCol >= 0 ? str(r[prefixCol]).trim() : "",
    });
  }
  return map;
}

// "관련 프로세스: HWE.2 | ..." line above the header (4.1 통합형).
function relatedProcessLine(rows, headerIndex) {
  for (const r of rows.slice(0, headerIndex)) {
    for (const c of r) {
      if (normHeader(c).startsWith("관련프로세스")) return aspiceIdIn(c);
    }
  }
  return null;
}

// Only one non-empty cell, outside the process column, and it reads like a title.
function isGroupRow(r, cols) {
  const filled = r.map((c, i) => [i, str(c).trim()]).filter(([, v]) => v);
  return filled.length === 1 && filled[0][0] !== cols.process && /\s/.test(filled[0][1]);
}

export function importWpChecklist(book, { fileName, sheetOverrides = {} } = {}) {
  const items = [];
  const issues = [];
  const sheetNames = [];
  const seen = new Set();
  const issue = (level, sheet, row, message) =>
    issues.push({ level, file: fileName, sheet, row, message });

  const sheets = book?.sheets ?? [];
  // A sheet with a 프로세스 column but no 산출물 column is a process checklist (spec 3.3).
  const headers = sheets.map((sh) => {
    if (isSkippedSheet(sh.name)) return null;
    const h = detectHeader(sh.rows ?? []);
    return h && !(h.cols.process >= 0 && h.cols.workProduct < 0) ? h : null;
  });

  if (headers.every((h) => !h)) {
    issue("error", "", null, formatErrorMessage(
      "산출물 체크리스트 형식이 아닙니다 (검토 항목·체크리스트 ID 머리글이 있는 시트가 없습니다)", sheets));
    return { items, issues, sheetNames };
  }

  const wpList = readWorkProductList(sheets);
  // Real IDs of the whole file, so auto IDs never collide with them.
  const realIds = new Set();
  sheets.forEach((sh, si) => {
    const h = headers[si];
    if (!h || h.cols.id < 0) return;
    for (const r of sh.rows.slice(h.dataStart)) {
      const v = str(r[h.cols.id]).trim();
      if (v) realIds.add(v);
    }
  });
  const counters = {};
  const autoId = (prefix) => {
    let id;
    do {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      id = `${prefix}-${String(counters[prefix]).padStart(3, "0")}`;
    } while (realIds.has(id) || seen.has(id));
    return id;
  };

  sheets.forEach((sh, si) => {
    const h = headers[si];
    if (!h) {
      if (!isSkippedSheet(sh.name)) issue("warning", sh.name, null, NO_HEADER);
      return;
    }
    sheetNames.push(sh.name);
    const { cols, names } = h;
    const cell = (r, c) => (c >= 0 ? str(r[c]).trim() : "");
    const startRow = sh.startRow ?? 1;
    const listed = wpList.get(normalizeName(sh.name));
    const num = /^\s*(\d+)/.exec(sh.name)?.[1];
    const prefix = listed?.prefix || (num ? `CH-${num}` : "CH-WP");

    // Order (spec 3.3): override -> row 프로세스 cell -> 관련 프로세스 line -> 산출물 목록 -> sheet name map
    const override = has(sheetOverrides, sh.name) ? { id: sheetOverrides[sh.name] } : null;
    const sheetLevel = override
      ? override.id
      : relatedProcessLine(sh.rows, h.index) ?? listed?.processId ?? processIdForSheet(sh.name);
    const fromCell = (v) => (v ? aspiceIdIn(v) ?? processIdForProcessName(v) : null);
    const warned = new Set();
    let count = 0;

    for (let i = h.dataStart; i < sh.rows.length; i++) {
      const r = sh.rows[i];
      const rawId = cell(r, cols.id);
      const question = cell(r, cols.question);
      if (!rawId && !question) continue;
      if (!question && isGroupRow(r, cols)) continue;
      const row = startRow + i;
      if (!question) { issue("error", sh.name, row, `검토 항목이 비어 있습니다 (${rawId})`); continue; }
      const checkId = rawId || autoId(prefix);
      if (seen.has(checkId)) { issue("error", sh.name, row, `체크 ID가 중복됩니다 (${checkId})`); continue; }
      seen.add(checkId);

      const procText = cell(r, cols.process);
      const processId = override ? override.id : fromCell(procText) ?? sheetLevel;
      if (processId == null && cols.process >= 0 && procText && !warned.has(procText)) {
        warned.add(procText);
        issue("warning", sh.name, row, `프로세스 지정 필요: 대응표에 없는 프로세스 이름입니다 (${procText})`);
      }
      const raw = {};
      names.forEach((n, c) => { if (n) raw[n] = r[c] ?? ""; });
      items.push({
        checkId,
        workProduct: cell(r, cols.workProduct) || normalizeName(sh.name),
        sheet: sh.name,
        row,
        processId,
        area: cell(r, cols.area),
        question,
        applicable: cols.applicable >= 0 ? !NOT_APPLICABLE.has(cell(r, cols.applicable)) : true,
        basis: cell(r, cols.basis),
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
    // Sheet-level gap: no 프로세스 column, or rows with an empty 프로세스 cell fell back to it.
    const sheetGap = cols.process < 0
      ? sheetLevel == null
      : items.some((it) => it.sheet === sh.name && it.processId == null && !cell(sh.rows[it.row - startRow], cols.process));
    if (sheetGap) issue("warning", sh.name, null, "프로세스 지정 필요: 대응표에 없는 시트 이름입니다");
  });

  return { items, issues, sheetNames };
}
