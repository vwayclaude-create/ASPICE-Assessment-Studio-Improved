import { T, FONTS } from "../theme";

export const MODE_PER_PROCESS = "per-process";
export const MODE_PROJECT = "project";
export const MODE_QA_AUDIT = "qa-audit";

export function ModeToggle({ mode, onChange }) {
  const btn = (id, label, hint) => (
    <button
      type="button"
      key={id}
      onClick={() => onChange(id)}
      style={{
        flex: 1,
        padding: "12px 18px",
        background: mode === id ? T.accentSoft : "transparent",
        color: mode === id ? T.accent : T.textMd,
        border: mode === id ? `1px solid ${T.accent}` : `1px solid ${T.borderL}`,
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: FONTS.sans,
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: T.textLo, marginTop: 2 }}>{hint}</div>
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 12, margin: "8px 0 22px" }}>
      {btn(MODE_PER_PROCESS, "프로세스 모드", "단일 증적 · 단일 프로세스 평가 (기존)")}
      {btn(MODE_PROJECT, "프로젝트 모드", "다중 증적 · 다중 프로세스 · Cross-process 검증")}
      {btn(MODE_QA_AUDIT, "QA Audit 모드", "체크리스트 기반 산출물·프로세스 감사")}
    </div>
  );
}
