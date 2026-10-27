// Browser-safe: no node:* imports. Input is an ArrayBuffer or Uint8Array.
import * as XLSX from "xlsx";

// Row number of rows[i] is `startRow + i` (1-based sheet row; start of !ref).
export function readWorkbook(data) {
  const wb = XLSX.read(data, { type: "array" });
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const startRow = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).s.r + 1 : 1;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: true });
    return { name, rows, startRow };
  });
  return { sheets };
}
