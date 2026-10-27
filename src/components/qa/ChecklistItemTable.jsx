import { useMemo, useState } from "react";
import { processes } from "aspice-harness/spec/all";
import { canConfirmWp, canConfirmProcess } from "aspice-harness/qa";
import { T, FONTS } from "../../theme";
import { STATUS_LABEL } from "./ChecklistImportPanel";
import { ChecklistItemEditor } from "./ChecklistItemEditor";
import { useQaDraft } from "../../hooks/useQaDraft";

const card = { background: T.surface, border: `1px solid ${T.borderL}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 };
const th = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: T.textLo, borderBottom: `1px solid ${T.borderL}` };
const td = { padding: "6px 8px", fontSize: 12, borderBottom: `1px solid ${T.borderL}`, verticalAlign: "top" };
const btn = {
  padding: "5px 12px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 700,
  fontFamily: FONTS.sans,
  border: `1px solid ${T.borderM}`,
  background: T.surface,
  color: T.textMd,
  cursor: "pointer",
};
const STATUS_COLOR = { pending: T.textLo, drafted: T.accent, confirmed: T.ok, stale: T.warm };

const keyOf = (kind, it) => (kind === "wp" ? it.checkId : it.itemId);

function Tree({ version, sel, onSelect }) {
  const sheets = useMemo(() => {
    const m = new Map();
    for (const it of version.wpItems) m.set(it.sheet, (m.get(it.sheet) ?? 0) + 1);
    return [...m.entries()];
  }, [version]);
  const procs = useMemo(() => {
    const m = new Map();
    for (const it of version.processItems) {
      const k = it.processId ?? null;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [version]);
  const row = (active, text, onClick, k) => (
    <button
      key={k}
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "4px 8px",
        fontSize: 12,
        fontFamily: FONTS.sans,
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        background: active ? T.accentSoft : "transparent",
        color: active ? T.accent : T.textMd,
        fontWeight: active ? 700 : 400,
      }}
    >
      {text}
    </button>
  );
  const is = (kind, f) => sel.kind === kind && (f ? f(sel) : true);
  return (
    <div style={{ minWidth: 200, maxWidth: 240, maxHeight: 520, overflowY: "auto", borderRight: `1px solid ${T.borderL}`, paddingRight: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textHi, margin: "0 0 4px" }}>산출물 ({version.wpItems.length})</div>
      {row(is("wp", (s) => s.sheet === undefined), "전체", () => onSelect({ kind: "wp" }), "wp-all")}
      {sheets.map(([name, n]) =>
        row(is("wp", (s) => s.sheet === name), `${name} (${n})`, () => onSelect({ kind: "wp", sheet: name }), `s-${name}`)
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textHi, margin: "12px 0 4px" }}>프로세스 ({version.processItems.length})</div>
      {row(is("process", (s) => s.processId === undefined), "전체", () => onSelect({ kind: "process" }), "p-all")}
      {procs.map(([pid, n]) =>
        row(
          is("process", (s) => s.processId === pid),
          `${pid ?? "미지정"} (${n})`,
          () => onSelect({ kind: "process", processId: pid }),
          `p-${pid}`
        )
      )}
    </div>
  );
}

/**
 * Item list section: tree + table + confirm panel + AI draft runner.
 * Owns selection / filter / checkbox state; edits go through the qa hook.
 */
export function ChecklistItemTable({ qa }) {
  const version = qa.active;
  const draftRunner = useQaDraft(qa);
  const [sel, setSel] = useState({ kind: "wp" });
  const [statusFilter, setStatusFilter] = useState("all");
  const [checked, setChecked] = useState(() => new Set());
  const [openKey, setOpenKey] = useState(null);
  const [notice, setNotice] = useState("");

  const { kind } = sel;
  const items = useMemo(() => {
    if (!version) return [];
    const all = kind === "wp" ? version.wpItems : version.processItems;
    return all.filter((it) => {
      if (kind === "wp" && sel.sheet !== undefined && it.sheet !== sel.sheet) return false;
      if (kind === "process" && sel.processId !== undefined && (it.processId ?? null) !== sel.processId) return false;
      return statusFilter === "all" || it.status === statusFilter;
    });
  }, [version, kind, sel, statusFilter]);

  if (!version) return null;

  const opened = openKey
    ? (kind === "wp" ? version.wpItems : version.processItems).find((it) => keyOf(kind, it) === openKey)
    : null;
  const failures = draftRunner.failures;
  const failEntries = Object.entries(failures);
  const keysChecked = items.map((it) => keyOf(kind, it)).filter((k) => checked.has(k));

  const select = (s) => {
    setSel(s);
    setChecked(new Set());
    setOpenKey(null);
    setNotice("");
  };
  const toggle = (k) =>
    setChecked((c) => {
      const n = new Set(c);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const allChecked = items.length > 0 && keysChecked.length === items.length;

  const runDraft = (scopeKind, scope, includeConfirmed) => {
    setNotice("");
    draftRunner.run({ kind: scopeKind, scope, includeConfirmed });
  };
  const currentScope =
    kind === "wp"
      ? sel.sheet !== undefined ? { sheet: sel.sheet } : "all"
      : sel.processId !== undefined ? { processId: sel.processId } : "all";

  const batchConfirm = async () => {
    const wpIds = new Set(version.wpItems.map((w) => w.checkId));
    let done = 0;
    let skipped = 0;
    let staleSkipped = 0;
    for (const it of items) {
      const k = keyOf(kind, it);
      if (!checked.has(k)) continue;
      // Stale items need a person to look again; never overwrite them with the draft.
      if (it.status === "stale") { staleSkipped++; continue; }
      const d = it.draft;
      if (!d || it.status === "confirmed") { skipped++; continue; }
      const { rationale: _drop, ...criteria } = d;      const res = kind === "wp"
        ? canConfirmWp(it, criteria, processes)
        : canConfirmProcess(it, criteria, { processes, wpCheckIds: wpIds });
      if (!res.ok) { skipped++; continue; }
      if (await qa.confirm(kind, k, criteria)) done++;
      else skipped++;
    }
    setNotice(
      `${done}건 확정, ${skipped}건 제외 (초안이 없거나 확정 조건 미충족, 이미 확정된 항목)` +
        (staleSkipped ? `, ${staleSkipped}건은 재확인 필요라 건너뜀` : "")
    );
    setChecked(new Set());
  };

  const { running, progress } = draftRunner;
  return (
    <section style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textHi, margin: 0, marginRight: 8 }}>항목 목록</h3>
        <button type="button" style={btn} disabled={running} onClick={() => runDraft("both", "all", false)}>
          AI 초안 만들기 (전체)
        </button>
        <button type="button" style={btn} disabled={running} onClick={() => runDraft(kind, currentScope, false)}>
          AI 초안 만들기 (현재 {kind === "wp" ? "시트" : "프로세스"})
        </button>
        <button
          type="button"
          style={btn}
          disabled={running || keysChecked.length === 0}
          onClick={() => runDraft(kind, { keys: keysChecked }, false)}
        >
          선택 항목 AI 초안 만들기
        </button>
        <button type="button" style={btn} disabled={keysChecked.length === 0} onClick={batchConfirm}>
          초안 그대로 일괄 확정
        </button>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...btn, fontWeight: 400 }}>
          <option value="all">상태: 전체</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {(running || progress.total > 0) && (
        <div style={{ fontSize: 12, marginBottom: 8, color: T.textMd }}>
          {running ? "AI 초안 생성 중" : "AI 초안 생성 완료"}: {progress.done} / {progress.total}건
          {failEntries.length > 0 && <span style={{ color: T.err }}> · 실패 {failEntries.length}건</span>}
        </div>
      )}
      {notice && <div style={{ fontSize: 12, marginBottom: 8, color: T.textMd }}>{notice}</div>}
      {failEntries.length > 0 && !running && (
        <details style={{ fontSize: 12, marginBottom: 8, color: T.err }}>
          <summary style={{ cursor: "pointer" }}>실패 목록 ({failEntries.length}건)</summary>
          <ul style={{ margin: "4px 0", paddingLeft: 18, maxHeight: 160, overflowY: "auto" }}>
            {failEntries.map(([k, m]) => <li key={k}>{k}: {m}</li>)}
          </ul>
        </details>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Tree version={version} sel={sel} onSelect={select} />
        <div style={{ flex: 1, minWidth: 320, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>
                  <input
                    type="checkbox"
                    aria-label="전체 선택"
                    checked={allChecked}
                    onChange={() => setChecked(allChecked ? new Set() : new Set(items.map((it) => keyOf(kind, it))))}
                  />
                </th>
                <th style={th}>ID</th>
                <th style={th}>{kind === "wp" ? "영역" : "단계"}</th>
                <th style={th}>검토 항목</th>
                <th style={th}>상태</th>
                <th style={th}>심각도</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const k = keyOf(kind, it);
                const sev = kind === "wp" ? (it.confirmed ?? it.draft)?.severity : null;
                return (
                  <tr
                    key={k}
                    onClick={() => setOpenKey(k)}
                    style={{ cursor: "pointer", background: k === openKey ? T.accentSoft : "transparent" }}
                  >
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`${k} 선택`} checked={checked.has(k)} onChange={() => toggle(k)} />
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{k}</td>
                    <td style={td}>{(kind === "wp" ? it.area : it.phase) || "-"}</td>
                    <td style={td}>{it.question}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: STATUS_COLOR[it.status], fontWeight: 700 }}>
                      {STATUS_LABEL[it.status]}
                      {failures[k] && <span style={{ color: T.err }} title={failures[k]}> !</span>}
                    </td>
                    <td style={td}>{sev ?? "-"}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td style={td} colSpan={6}>표시할 항목이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {opened && <ChecklistItemEditor qa={qa} kind={kind} item={opened} draftRunner={draftRunner} />}
    </section>
  );
}
