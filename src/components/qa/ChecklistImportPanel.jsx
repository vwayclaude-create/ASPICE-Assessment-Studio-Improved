import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { processes } from "aspice-harness/spec/all";
import { T, FONTS } from "../../theme";

export const PROCESS_OPTIONS = [...processes.map((p) => ({ id: p.id, name: p.name })), { id: "VWAY.PR", name: "산출물 동료 검토" }];

const STATUSES = ["pending", "drafted", "confirmed", "stale"];
export const STATUS_LABEL = { pending: "대기", drafted: "초안", confirmed: "확정", stale: "재확정 필요" };

const card = {
  background: T.surface,
  border: `1px solid ${T.borderL}`,
  borderRadius: 8,
  padding: "16px 20px",
  marginBottom: 16,
};
const h = { fontSize: 14, fontWeight: 700, color: T.textHi, margin: "0 0 12px" };
const th = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: T.textLo, borderBottom: `1px solid ${T.borderL}` };
const td = { padding: "6px 8px", fontSize: 12, borderBottom: `1px solid ${T.borderL}`, verticalAlign: "top" };

export const confirmRate = (v) => {
  const all = [...v.wpItems, ...v.processItems];
  if (!all.length) return 0;
  return Math.round((all.filter((i) => i.status === "confirmed").length / all.length) * 100);
};

function FileSlot({ label, file, onChange, disabled }) {
  return (
    <label style={{ flex: 1, minWidth: 240, display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <input
        type="file"
        accept=".xlsx"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        style={{ fontSize: 12, fontFamily: FONTS.sans, maxWidth: "100%" }}
      />
      {file && <div style={{ fontSize: 11, color: T.textLo, marginTop: 4 }}>{file.name}</div>}
    </label>
  );
}

function ProcessSelect({ value, onChange }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      style={{ fontSize: 12, fontFamily: FONTS.sans, padding: "3px 6px", borderRadius: 4, border: `1px solid ${T.borderM}` }}
    >
      <option value="">프로세스 선택...</option>
      {PROCESS_OPTIONS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.id} {p.name}
        </option>
      ))}
    </select>
  );
}

function groupCounts(items, keyOf) {
  const m = new Map();
  for (const it of items) {
    const k = keyOf(it);
    if (!m.has(k)) m.set(k, { pending: 0, drafted: 0, confirmed: 0, stale: 0, total: 0 });
    const c = m.get(k);
    c[it.status] = (c[it.status] ?? 0) + 1;
    c.total += 1;
  }
  return [...m.entries()];
}

function ProgressTable({ title, rows }) {
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: "auto", marginBottom: 12 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={th}>{title}</th>
            {STATUSES.map((s) => (
              <th key={s} style={th}>{STATUS_LABEL[s]}</th>
            ))}
            <th style={th}>확정률</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, c]) => (
            <tr key={k}>
              <td style={td}>{k}</td>
              {STATUSES.map((s) => (
                <td key={s} style={td}>{c[s]}</td>
              ))}
              <td style={td}>{Math.round((c.confirmed / c.total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChecklistImportPanel({ qa }) {
  const [wpFile, setWpFile] = useState(null);
  const [processFile, setProcessFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const { active, lastImport } = qa;

  const run = async () => {
    setBusy(true);
    try {
      await qa.importFiles({ wpFile, processFile });
    } finally {
      setBusy(false);
      setWpFile(null);
      setProcessFile(null);
      setInputKey((k) => k + 1);
    }
  };

  const issues = [...(lastImport?.issues ?? [])].sort(
    (a, b) => (a.level === "error" ? 0 : 1) - (b.level === "error" ? 0 : 1)
  );
  const summary = lastImport?.summary;

  const sheetsNeeding = active
    ? [...new Set(active.wpItems.filter((w) => !w.processId).map((w) => w.sheet))]
    : [];
  const namesNeeding = active
    ? [...new Set(active.processItems.filter((p) => !p.processId).map((p) => p.processName))]
    : [];

  return (
    <div>
      <section style={card}>
        <h3 style={h}>체크리스트 가져오기</h3>
        <div key={inputKey} style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <FileSlot label="산출물 체크리스트 (.xlsx)" file={wpFile} onChange={setWpFile} disabled={busy} />
          <FileSlot label="프로세스 체크리스트 (.xlsx)" file={processFile} onChange={setProcessFile} disabled={busy} />
        </div>
        <button
          type="button"
          disabled={busy || (!wpFile && !processFile)}
          onClick={run}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: FONTS.sans,
            background: T.accent,
            color: T.onAccent,
            cursor: busy || (!wpFile && !processFile) ? "not-allowed" : "pointer",
            opacity: busy || (!wpFile && !processFile) ? 0.5 : 1,
          }}
        >
          {busy ? <Loader2 size={14} /> : <Upload size={14} />} 가져오기
        </button>
        <div style={{ fontSize: 11, color: T.textLo, marginTop: 8 }}>
          한 파일만 넣으면 다른 쪽은 활성 버전의 것을 이어받아 새 버전을 만듭니다.
        </div>
      </section>

      {lastImport && (
        <section style={card}>
          <h3 style={h}>가져오기 결과</h3>
          {summary ? (
            <>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                v{active?.version} · 산출물 {active?.wpItems.length ?? 0}건 · 프로세스 {active?.processItems.length ?? 0}건
              </div>
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}></th>
                      <th style={th}>이어받음</th>
                      <th style={th}>변경됨(stale)</th>
                      <th style={th}>신규</th>
                      <th style={th}>삭제됨</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[["산출물", summary.wp], ["프로세스", summary.process]].map(([name, s]) => (
                      <tr key={name}>
                        <td style={td}>{name}</td>
                        <td style={td}>{s?.carried ?? 0}</td>
                        <td style={td}>{s?.stale ?? 0}</td>
                        <td style={td}>{s?.added ?? 0}</td>
                        <td style={td}>{s?.removed ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: T.err, marginBottom: 8 }}>
              가져온 항목이 없어 새 버전을 만들지 않았습니다. 활성 버전은 그대로입니다.
            </div>
          )}
          {issues.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>오류·경고 {issues.length}건</div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={th}>등급</th>
                    <th style={th}>파일</th>
                    <th style={th}>시트</th>
                    <th style={th}>행</th>
                    <th style={th}>메시지</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((i, n) => (
                    <tr key={n}>
                      <td style={{ ...td, color: i.level === "error" ? T.err : T.warm, fontWeight: 700 }}>
                        {i.level === "error" ? "오류" : "경고"}
                      </td>
                      <td style={td}>{i.file}</td>
                      <td style={td}>{i.sheet}</td>
                      <td style={td}>{i.row}</td>
                      <td style={td}>{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {active && (
        <section style={card}>
          <h3 style={h}>진행 현황 · 확정률 {confirmRate(active)}%</h3>
          <ProgressTable title="산출물 시트" rows={groupCounts(active.wpItems, (w) => w.sheet)} />
          <ProgressTable title="프로세스" rows={groupCounts(active.processItems, (p) => p.processId ?? p.processName)} />
        </section>
      )}

      {(sheetsNeeding.length > 0 || namesNeeding.length > 0) && (
        <section style={card}>
          <h3 style={h}>프로세스 지정 필요</h3>
          {sheetsNeeding.map((s) => (
            <div key={`s:${s}`} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700 }}>시트 {s}</span>
              <ProcessSelect value="" onChange={(id) => qa.setSheetProcess(s, id)} />
            </div>
          ))}
          {namesNeeding.map((n) => (
            <div key={`p:${n}`} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6, fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700 }}>프로세스 {n}</span>
              <ProcessSelect value="" onChange={(id) => qa.setProcessNameMapping(n, id)} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
