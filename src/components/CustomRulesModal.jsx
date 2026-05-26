import { useRef, useState } from "react";
import { X, Plus, Pencil, Trash2, Check, Download, Upload, RotateCcw } from "lucide-react";
import { T, FONTS } from "../theme";
import { PROCESS_GROUPS } from "../data/processGroups";
import { makeRule, makeCustomBP } from "../data/customRuleDefaults";

const APPLIES_TO_LABEL = {
  any: "전체 (BP·WP·GP)",
  bp: "Base Practice",
  wp: "Work Product",
  gp: "Generic Practice",
};

const APPLIES_TO_OPTIONS = [
  { value: "any", label: "전체 (BP·WP·GP)" },
  { value: "bp", label: "Base Practice" },
  { value: "wp", label: "Work Product" },
  { value: "gp", label: "Generic Practice" },
];

/**
 * Rule-book editor for the "Custom" scorer engine. Lets the user add, edit,
 * toggle (= exclude), and delete keyword/WPID rules, plus import/export the
 * whole book as JSON. State lives in `useCustomRules`; this is the view.
 */
export function CustomRulesModal({
  ruleBook,
  onClose,
  addRule,
  updateRule,
  toggleRule,
  deleteRule,
  setUseAutoFallback,
  replaceRuleBook,
  resetToDefaults,
  addCustomBP,
  updateCustomBP,
  deleteCustomBP,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingBpId, setEditingBpId] = useState(null);
  const [tab, setTab] = useState("rules"); // "rules" | "bps"
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);

  const rules = ruleBook.rules || [];
  const customBPs = ruleBook.customBPs || [];
  const enabledCount = rules.filter((r) => r.enabled).length;

  const handleAdd = () => {
    const rule = makeRule({ label: "새 룰" });
    addRule(rule);
    setEditingId(rule.id);
  };

  const handleAddBP = () => {
    const bp = makeCustomBP({ title: "새 사용자 BP" });
    addCustomBP?.(bp);
    setEditingBpId(bp.id);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(ruleBook, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aspice-custom-rules.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.rules)) {
        throw new Error("rules 배열이 없습니다.");
      }
      replaceRuleBook(parsed);
      setEditingId(null);
    } catch (err) {
      setImportError(`불러오기 실패 — ${err.message}`);
    }
  };

  return (
    <div onClick={onClose} style={OVERLAY}>
      <div onClick={(e) => e.stopPropagation()} style={PANEL}>
        {/* Header */}
        <div style={HEADER}>
          <div>
            <div style={EYEBROW}>Custom Scorer · 사용자 룰</div>
            <div style={TITLE}>
              평가 룰 · 사용자 BP 편집{" "}
              <span style={{ color: T.textLo, fontWeight: 400, fontSize: 14 }}>
                (룰 {enabledCount}/{rules.length} · BP {customBPs.length}개)
              </span>
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={ICON_BTN}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={TAB_ROW}>
          <button
            type="button"
            onClick={() => setTab("rules")}
            style={{ ...TAB_BTN, ...(tab === "rules" ? TAB_BTN_ON : {}) }}
          >
            키워드 룰 ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("bps")}
            style={{ ...TAB_BTN, ...(tab === "bps" ? TAB_BTN_ON : {}) }}
          >
            사용자 정의 BP ({customBPs.length})
          </button>
        </div>

        {/* Body */}
        <div style={BODY}>
          {tab === "rules" && (
            <>
              <p style={{ fontSize: 12.5, color: T.textMd, lineHeight: 1.7, margin: "4px 0 14px" }}>
                각 룰은 <strong style={{ color: T.textHi }}>키워드/WPID 매칭</strong> 규칙입니다. 룰이 적용되는
                평가 단위(BP·WP·GP)와 프로세스를 정하고, 산출물에서 키워드가 발견되면 룰이 충족됩니다.
                점수는 <strong style={{ color: T.textHi }}>충족된 룰의 가중치 비율</strong>로 산정됩니다.
                체크를 해제하면 해당 룰은 평가에서 제외됩니다.
              </p>

              {/* Auto-fallback toggle */}
              <label style={FALLBACK_ROW}>
                <input
                  type="checkbox"
                  checked={ruleBook.useAutoFallback !== false}
                  onChange={(e) => setUseAutoFallback(e.target.checked)}
                />
                <span>
                  <span style={{ color: T.textHi, fontSize: 12.5, fontWeight: 600 }}>
                    자동 키워드 폴백 사용
                  </span>
                  <span style={{ color: T.textLo, fontSize: 11.5, display: "block", marginTop: 2 }}>
                    적용되는 사용자 룰이 없는 BP/WP/GP는 오프라인 룰 엔진(PAM 자동 키워드)으로 평가합니다.
                    해제하면 룰이 없는 항목은 0점 처리됩니다.
                  </span>
                </span>
              </label>

              {/* Rule list */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {rules.length === 0 && (
                  <div style={EMPTY}>아직 룰이 없습니다. 아래 "룰 추가"로 시작하세요.</div>
                )}
                {rules.map((rule) =>
                  editingId === rule.id ? (
                    <RuleEditor
                      key={rule.id}
                      rule={rule}
                      onSave={(patch) => {
                        updateRule(rule.id, patch);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      onToggle={() => toggleRule(rule.id)}
                      onEdit={() => setEditingId(rule.id)}
                      onDelete={() => {
                        if (confirm(`룰 "${rule.label}"을(를) 삭제하시겠습니까?`)) {
                          deleteRule(rule.id);
                        }
                      }}
                    />
                  )
                )}
              </div>

              <button type="button" onClick={handleAdd} style={ADD_BTN}>
                <Plus size={14} /> 룰 추가
              </button>
            </>
          )}

          {tab === "bps" && (
            <>
              <p style={{ fontSize: 12.5, color: T.textMd, lineHeight: 1.7, margin: "4px 0 14px" }}>
                <strong style={{ color: T.textHi }}>사용자 정의 BP</strong>는 PAM에 없는 추가 Base Practice를
                직접 만들어 평가에 포함시킵니다. 선택한 프로세스의 BP 목록 끝에 추가되어
                PA 1.1 평균에 반영됩니다. <strong style={{ color: T.textHi }}>Custom 엔진</strong>이 선택된
                경우에만 활성화되며, BP에 정의한 키워드/매칭 조건으로 점수가 산정됩니다.
              </p>

              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
                {customBPs.length === 0 && (
                  <div style={EMPTY}>
                    아직 사용자 정의 BP가 없습니다. 아래 "BP 추가"로 시작하세요.
                  </div>
                )}
                {customBPs.map((bp) =>
                  editingBpId === bp.id ? (
                    <CustomBPEditor
                      key={bp.id}
                      bp={bp}
                      onSave={(patch) => {
                        updateCustomBP?.(bp.id, patch);
                        setEditingBpId(null);
                      }}
                      onCancel={() => setEditingBpId(null)}
                    />
                  ) : (
                    <CustomBPRow
                      key={bp.id}
                      bp={bp}
                      onEdit={() => setEditingBpId(bp.id)}
                      onDelete={() => {
                        if (confirm(`사용자 BP "${bp.title}"을(를) 삭제하시겠습니까?`)) {
                          deleteCustomBP?.(bp.id);
                        }
                      }}
                    />
                  )
                )}
              </div>

              <button type="button" onClick={handleAddBP} style={ADD_BTN}>
                <Plus size={14} /> BP 추가
              </button>
            </>
          )}

          {importError && (
            <div style={{ color: T.err, fontSize: 12, marginTop: 10 }}>{importError}</div>
          )}
        </div>

        {/* Footer */}
        <div style={FOOTER}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={handleExport} style={GHOST_BTN}>
              <Download size={13} /> 내보내기
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} style={GHOST_BTN}>
              <Upload size={13} /> 불러오기
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("모든 룰을 기본값으로 되돌리시겠습니까?")) {
                  resetToDefaults();
                  setEditingId(null);
                }
              }}
              style={GHOST_BTN}
            >
              <RotateCcw size={13} /> 기본값 복원
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              style={{ display: "none" }}
            />
          </div>
          <button type="button" onClick={onClose} style={PRIMARY_BTN}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact read-only row for one rule. */
function RuleRow({ rule, onToggle, onEdit, onDelete }) {
  const scope =
    rule.process === "*" ? "모든 프로세스" : rule.process;
  return (
    <div style={{ ...ROW, opacity: rule.enabled ? 1 : 0.55 }}>
      <input
        type="checkbox"
        checked={rule.enabled}
        onChange={onToggle}
        title={rule.enabled ? "평가에 포함됨 — 해제하면 제외" : "평가에서 제외됨"}
        style={{ marginTop: 3 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: T.textHi, fontSize: 13, fontWeight: 600 }}>{rule.label}</span>
          <span style={SCOPE_BADGE}>{APPLIES_TO_LABEL[rule.appliesTo] || rule.appliesTo}</span>
          <span style={SCOPE_BADGE}>{scope}</span>
          <span style={{ ...SCOPE_BADGE, background: "transparent", color: T.textLo }}>
            {rule.match === "all" ? "전부 일치" : "1개라도"} · ×{rule.weight}
          </span>
        </div>
        <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {rule.keywords.map((k) => (
            <span key={k} style={KW_CHIP}>{k}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button type="button" onClick={onEdit} style={MINI_BTN} title="편집">
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{ ...MINI_BTN, color: T.err }}
          title="삭제"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/** Inline editor for one rule. Holds a local draft; commits on 저장. */
function RuleEditor({ rule, onSave, onCancel }) {
  const [label, setLabel] = useState(rule.label);
  const [appliesTo, setAppliesTo] = useState(rule.appliesTo);
  const [process, setProcess] = useState(rule.process);
  const [match, setMatch] = useState(rule.match);
  const [weight, setWeight] = useState(rule.weight);
  const [keywordText, setKeywordText] = useState(rule.keywords.join(", "));

  const parsedKeywords = keywordText
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const save = () => {
    if (!parsedKeywords.length) {
      alert("키워드를 1개 이상 입력하세요.");
      return;
    }
    const w = Number(weight);
    onSave({
      label: label.trim() || "이름 없는 룰",
      appliesTo,
      process,
      match,
      keywords: parsedKeywords,
      weight: Number.isFinite(w) ? Math.max(0.1, Math.min(5, w)) : 1,
    });
  };

  return (
    <div style={EDITOR}>
      <div style={EDITOR_GRID}>
        <Field label="룰 이름">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 요구사항 추적성"
            style={INPUT}
          />
        </Field>
        <Field label="가중치 (0.1 – 5)">
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            style={INPUT}
          />
        </Field>
        <Field label="적용 단위">
          <select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} style={INPUT}>
            {APPLIES_TO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="대상 프로세스">
          <select value={process} onChange={(e) => setProcess(e.target.value)} style={INPUT}>
            <option value="*">모든 프로세스</option>
            {PROCESS_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.ids.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>

      <Field label="키워드 / WPID (쉼표로 구분)">
        <input
          value={keywordText}
          onChange={(e) => setKeywordText(e.target.value)}
          placeholder="traceability, 추적성, 17-50"
          style={INPUT}
        />
      </Field>
      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
        {parsedKeywords.map((k) => (
          <span key={k} style={KW_CHIP}>{k}</span>
        ))}
      </div>

      <Field label="충족 조건">
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setMatch("any")}
            style={{ ...SEG, ...(match === "any" ? SEG_ON : {}) }}
          >
            키워드 1개라도 발견
          </button>
          <button
            type="button"
            onClick={() => setMatch("all")}
            style={{ ...SEG, ...(match === "all" ? SEG_ON : {}) }}
          >
            모든 키워드 발견
          </button>
        </div>
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onCancel} style={GHOST_BTN}>취소</button>
        <button type="button" onClick={save} style={PRIMARY_BTN}>
          <Check size={13} /> 저장
        </button>
      </div>
    </div>
  );
}

/** Compact read-only row for one user-defined BP. */
function CustomBPRow({ bp, onEdit, onDelete }) {
  return (
    <div style={ROW}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={SCOPE_BADGE}>{bp.processId}</span>
          <span style={{ color: T.textHi, fontSize: 13, fontWeight: 600 }}>{bp.title}</span>
          <span style={{ ...SCOPE_BADGE, background: "transparent", color: T.textLo }}>
            {bp.match === "all" ? "전부 일치" : "1개라도"} · ×{bp.weight}
          </span>
        </div>
        {bp.intent && (
          <div style={{ marginTop: 4, color: T.textLo, fontSize: 11.5 }}>{bp.intent}</div>
        )}
        <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {bp.keywords.map((k) => (
            <span key={k} style={KW_CHIP}>{k}</span>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button type="button" onClick={onEdit} style={MINI_BTN} title="편집">
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{ ...MINI_BTN, color: T.err }}
          title="삭제"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

/** Inline editor for one user-defined BP. Mirrors RuleEditor but stores BP fields. */
function CustomBPEditor({ bp, onSave, onCancel }) {
  const [title, setTitle] = useState(bp.title);
  const [processId, setProcessId] = useState(bp.processId);
  const [intent, setIntent] = useState(bp.intent || "");
  const [match, setMatch] = useState(bp.match);
  const [weight, setWeight] = useState(bp.weight);
  const [keywordText, setKeywordText] = useState(bp.keywords.join(", "));

  const parsedKeywords = keywordText
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  const save = () => {
    if (!parsedKeywords.length) {
      alert("키워드를 1개 이상 입력하세요.");
      return;
    }
    const w = Number(weight);
    onSave({
      title: title.trim() || "사용자 정의 BP",
      processId,
      intent: intent.trim(),
      match,
      keywords: parsedKeywords,
      weight: Number.isFinite(w) ? Math.max(0.1, Math.min(5, w)) : 1,
    });
  };

  return (
    <div style={EDITOR}>
      <div style={EDITOR_GRID}>
        <Field label="BP 이름">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 검토 회의록 작성"
            style={INPUT}
          />
        </Field>
        <Field label="가중치 (0.1 – 5)">
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            style={INPUT}
          />
        </Field>
        <Field label="대상 프로세스">
          <select value={processId} onChange={(e) => setProcessId(e.target.value)} style={INPUT}>
            {PROCESS_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.ids.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="충족 조건">
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setMatch("any")}
              style={{ ...SEG, ...(match === "any" ? SEG_ON : {}) }}
            >
              1개라도
            </button>
            <button
              type="button"
              onClick={() => setMatch("all")}
              style={{ ...SEG, ...(match === "all" ? SEG_ON : {}) }}
            >
              모두
            </button>
          </div>
        </Field>
      </div>

      <Field label="의도 / 설명 (선택)">
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="이 BP가 무엇을 평가하는지 한 줄 설명"
          style={INPUT}
        />
      </Field>

      <Field label="키워드 / WPID (쉼표로 구분)">
        <input
          value={keywordText}
          onChange={(e) => setKeywordText(e.target.value)}
          placeholder="review minutes, 회의록, MOM"
          style={INPUT}
        />
      </Field>
      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
        {parsedKeywords.map((k) => (
          <span key={k} style={KW_CHIP}>{k}</span>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onCancel} style={GHOST_BTN}>취소</button>
        <button type="button" onClick={save} style={PRIMARY_BTN}>
          <Check size={13} /> 저장
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginTop: 10 }}>
      <span style={FIELD_LABEL}>{label}</span>
      {children}
    </label>
  );
}

// ── styles ────────────────────────────────────────────────────────────────
const OVERLAY = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: T.overlay,
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
const PANEL = {
  background: T.surface,
  border: `1px solid ${T.borderM}`,
  borderRadius: 10,
  width: "100%",
  maxWidth: 680,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  animation: "fadeIn 0.18s ease",
  boxShadow: T.shadowLg,
};
const HEADER = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "20px 26px",
  borderBottom: `1px solid ${T.borderL}`,
};
const EYEBROW = {
  fontFamily: FONTS.mono,
  fontSize: 10,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: T.accent,
  marginBottom: 6,
  fontWeight: 500,
};
const TITLE = {
  fontFamily: FONTS.sans,
  fontSize: 19,
  fontWeight: 700,
  color: T.textHi,
  letterSpacing: "-0.02em",
};
const TAB_ROW = {
  display: "flex",
  gap: 4,
  padding: "0 26px",
  borderBottom: `1px solid ${T.borderL}`,
};
const TAB_BTN = {
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: "10px 14px",
  color: T.textMd,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: -1,
};
const TAB_BTN_ON = {
  color: T.accent,
  borderBottomColor: T.accent,
};
const BODY = { padding: "16px 26px 22px", overflowY: "auto" };
const FOOTER = {
  padding: "14px 26px",
  borderTop: `1px solid ${T.borderL}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};
const ICON_BTN = {
  background: "transparent",
  border: `1px solid ${T.borderM}`,
  color: T.textMd,
  width: 32,
  height: 32,
  borderRadius: 6,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const FALLBACK_ROW = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "10px 12px",
  background: T.surface2,
  border: `1px solid ${T.borderL}`,
  borderRadius: 6,
  cursor: "pointer",
};
const ROW = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 12px",
  border: `1px solid ${T.borderL}`,
  borderRadius: 6,
  background: T.surface2,
};
const SCOPE_BADGE = {
  fontFamily: FONTS.mono,
  fontSize: 10,
  color: T.accent,
  background: T.accentSoft,
  borderRadius: 3,
  padding: "2px 6px",
};
const KW_CHIP = {
  fontSize: 11,
  color: T.textMd,
  background: T.surface,
  border: `1px solid ${T.borderL}`,
  borderRadius: 3,
  padding: "2px 7px",
};
const MINI_BTN = {
  background: "transparent",
  border: `1px solid ${T.borderL}`,
  color: T.textMd,
  width: 28,
  height: 28,
  borderRadius: 5,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const EMPTY = {
  padding: "20px 12px",
  textAlign: "center",
  color: T.textLo,
  fontSize: 12.5,
  border: `1px dashed ${T.borderM}`,
  borderRadius: 6,
};
const ADD_BTN = {
  marginTop: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  background: T.accentSoft,
  color: T.accent,
  border: `1px solid ${T.accent}`,
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const EDITOR = {
  border: `1px solid ${T.accent}`,
  borderRadius: 6,
  padding: "12px 14px",
  background: T.surface,
};
const EDITOR_GRID = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0 14px",
};
const FIELD_LABEL = {
  display: "block",
  color: T.textMd,
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
  marginBottom: 4,
};
const INPUT = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 9px",
  background: T.surface2,
  border: `1px solid ${T.borderM}`,
  borderRadius: 5,
  color: T.textHi,
  fontSize: 12.5,
  fontFamily: FONTS.sans,
};
const SEG = {
  flex: 1,
  padding: "7px 10px",
  background: T.surface2,
  border: `1px solid ${T.borderL}`,
  borderRadius: 5,
  color: T.textMd,
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};
const SEG_ON = { background: T.accentSoft, color: T.accent, borderColor: T.accent };
const GHOST_BTN = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "8px 12px",
  background: "transparent",
  border: `1px solid ${T.borderM}`,
  borderRadius: 6,
  color: T.textMd,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const PRIMARY_BTN = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "8px 18px",
  background: T.accent,
  color: T.onAccent,
  border: "none",
  borderRadius: 6,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};
