import { useState } from "react";
import { T, FONTS } from "../../theme";
import { useQaChecklist } from "../../hooks/useQaChecklist";
import { ChecklistImportPanel } from "./ChecklistImportPanel";
import { ChecklistVersionList } from "./ChecklistVersionList";

const TABS = [
  { id: "checklist", label: "체크리스트" },
  { id: "rules", label: "커스텀 룰", disabled: true },
  { id: "audit", label: "감사 실행", disabled: true },
  { id: "report", label: "리포트", disabled: true },
];

export function QaAuditView() {
  const [tab, setTab] = useState("checklist");
  const qa = useQaChecklist();

  return (
    <main style={{ fontFamily: FONTS.sans, color: T.textMd }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.disabled}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: FONTS.sans,
              cursor: t.disabled ? "not-allowed" : "pointer",
              opacity: t.disabled ? 0.45 : 1,
              background: tab === t.id ? T.accentSoft : "transparent",
              color: tab === t.id ? T.accent : T.textMd,
              border: `1px solid ${tab === t.id ? T.accent : T.borderL}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {qa.error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 12 }}>{qa.error}</div>}
      {tab === "checklist" && (
        <div style={{ fontSize: 13 }}>
          {qa.loading
            ? "불러오는 중..."
            : qa.active
              ? `활성 버전 v${qa.active.version} · 산출물 ${qa.active.wpItems.length}건 · 프로세스 ${qa.active.processItems.length}건`
              : "가져온 체크리스트가 없습니다."}
          <div style={{ marginTop: 16 }}>
            <ChecklistImportPanel qa={qa} />
            {/* Task 10: ChecklistItemTable */}
            <ChecklistVersionList qa={qa} />
          </div>
        </div>
      )}
    </main>
  );
}
