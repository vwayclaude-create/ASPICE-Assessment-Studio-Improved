// Browser-safe: no node:* imports.
// Header detection shared by both checklist importers (spec 3.3).

const str = (v) => (v == null ? "" : String(v).trim());
export const normHeader = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase();

const EXACT = {
  id: ["item_id", "체크리스트id", "체크리트스id", "항목id"],
  question: ["item_title", "검토항목", "검토항목(필수)", "심사항목"],
  area: ["col06", "영역"],
  applicable: ["col35", "적용여부"],
  workProduct: ["산출물"],
  process: ["프로세스"],
};
const PREFIX = { basis: ["근거", "참고"], phase: ["비고"] };
const KEYS = [...Object.keys(EXACT), ...Object.keys(PREFIX)];

function keyOf(cell) {
  const n = normHeader(cell);
  if (!n) return null;
  for (const [k, list] of Object.entries(EXACT)) if (list.includes(n)) return k;
  for (const [k, list] of Object.entries(PREFIX)) if (list.some((p) => n.startsWith(p))) return k;
  return null;
}

// First column per key; -1 when absent.
function columnsOf(row) {
  const cols = Object.fromEntries(KEYS.map((k) => [k, -1]));
  (row ?? []).forEach((c, i) => {
    const k = keyOf(c);
    if (k && cols[k] < 0) cols[k] = i;
  });
  return cols;
}

const isHeader = (cols) => cols.question >= 0 && (cols.id >= 0 || cols.process >= 0 || cols.workProduct >= 0);
const isBlank = (row) => (row ?? []).every((c) => str(c) === "");
// Second line of a merged 평가 header: only 판단/점수/blank cells.
const isSubHeader = (row) =>
  !isBlank(row) && row.every((c) => ["", "판단", "점수"].includes(str(c)));

// Header among the first `scan` non-blank rows, or null.
// dataStart skips a following sub-header row or a second header row (codebeamer field row + Korean row).
export function detectHeader(rows, { scan = 10 } = {}) {
  let seen = 0;
  for (let i = 0; i < (rows?.length ?? 0) && seen < scan; i++) {
    if (isBlank(rows[i])) continue;
    seen++;
    const cols = columnsOf(rows[i]);
    if (!isHeader(cols)) continue;
    // codebeamer field row: the next row is always the Korean header (spec 3.1).
    const fieldRow = rows[i].some((c) => ["item_id", "item_title"].includes(normHeader(c)));
    let dataStart = fieldRow ? i + 2 : i + 1;
    while (dataStart < rows.length && (isSubHeader(rows[dataStart]) || isHeader(columnsOf(rows[dataStart])))) dataStart++;
    return { index: i, dataStart, cols, names: rows[i].map((c) => str(c)) };
  }
  return null;
}

// Cover, history, guide and summary sheets; 전체 통합 duplicates every item; CL2 is the GP matrix.
const SKIP_WORDS = ["표지", "개정이력", "작성 기준", "작성기준", "산출물 목록", "요약", "변경사항", "판정규칙", "전체 통합", "목차"];
export function isSkippedSheet(name) {
  const s = String(name ?? "");
  return SKIP_WORDS.some((w) => s.includes(w)) || /^\s*CL2/i.test(s);
}

export const ASPICE_ID = /\b(?:ACQ|SPL|SYS|SWE|HWE|MLE|VAL|SUP|MAN|PIM|REU)\.\d+\b/;
export function aspiceIdIn(text) {
  const m = ASPICE_ID.exec(String(text ?? ""));
  return m ? m[0] : null;
}

// First non-blank row's first non-empty cells, for format error messages.
export function firstCells(rows, n = 5) {
  const row = (rows ?? []).find((r) => !isBlank(r)) ?? [];
  return row.map((c) => str(c)).filter(Boolean).slice(0, n);
}

// "산출물 체크리스트 형식이 아닙니다 (...). 시트별 첫 행: [A] x · y / [B] ..."
export function formatErrorMessage(lead, sheets) {
  const found = (sheets ?? [])
    .map((sh) => {
      const cells = firstCells(sh.rows).map((c) => (c.length > 30 ? `${c.slice(0, 30)}…` : c));
      return cells.length ? `[${sh.name}] ${cells.join(" · ")}` : null;
    })
    .filter(Boolean);
  return found.length ? `${lead}. 시트별 첫 행: ${found.join(" / ")}` : lead;
}

export const NO_HEADER = "머리글을 찾지 못해 건너뜀";
