import { useMemo, useState } from "react";
import { processes } from "aspice-harness/spec/all";
import { canConfirmWp, canConfirmProcess, missingLinks, bpCatalog, VWAY_PR } from "aspice-harness/qa";
import { T, FONTS } from "../../theme";
import { PROCESS_OPTIONS, STATUS_LABEL } from "./ChecklistImportPanel";

const label = { fontSize: 12, fontWeight: 700, color: T.textHi, margin: "12px 0 4px" };
const input = {
  fontSize: 12,
  fontFamily: FONTS.sans,
  padding: "4px 8px",
  borderRadius: 4,
  border: `1px solid ${T.borderM}`,
  boxSizing: "border-box",
};
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
const linkBtn = { ...btn, border: "none", fontWeight: 400, padding: "2px 4px", textAlign: "left" };
const chip = (bad) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 10,
  marginRight: 6,
  marginBottom: 4,
  background: bad ? "#FEE2E2" : T.surface3,
  color: bad ? T.err : T.textMd,
  border: `1px solid ${bad ? T.err : T.borderL}`,
});
const SEVERITIES = ["상", "중", "하"];

const ALL_BPS = processes.flatMap((p) => bpCatalog(processes, p.id).map((bp) => ({ ...bp, processId: p.id })));
const KNOWN_BPS = new Set(ALL_BPS.map((b) => b.id));

const emptyForm = (kind) =>
  kind === "wp"
    ? { criteria: [], polarity: "positive", targetLocations: [], relatedBPs: [], severity: "중" }
    : { linkedWpCheckIds: [], relatedBPs: [], aggregation: "default" };

const initialForm = (kind, item) => ({
  ...emptyForm(kind),
  ...structuredClone(item.confirmed ?? item.draft ?? {}),
});

function Chip({ text, bad, onRemove }) {
  return (
    <span style={chip(bad)}>
      {text}
      <button
        type="button"
        onClick={onRemove}
        aria-label="제거"
        style={{ border: "none", background: "transparent", cursor: "pointer", color: "inherit", padding: 0, fontSize: 12 }}
      >
        ×
      </button>
    </span>
  );
}

function BpPicker({ processId, value, onChange }) {
  const [q, setQ] = useState("");
  const current = useMemo(() => bpCatalog(processes, processId), [processId]);
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const needle = q.trim().toLowerCase();
  const found = needle
    ? ALL_BPS.filter((b) => !value.includes(b.id) && `${b.id} ${b.title}`.toLowerCase().includes(needle)).slice(0, 12)
    : [];
  // Selected BPs outside the current process list (incl. invalid ones) show as chips.
  const others = value.filter((id) => !current.some((b) => b.id === id));
  return (
    <div>
      {processId === VWAY_PR && (
        <div style={{ fontSize: 11, color: T.textLo }}>VWAY.PR은 관련 BP 없이 확정할 수 있습니다.</div>
      )}
      {current.map((bp) => (
        <label key={bp.id} style={{ display: "block", fontSize: 12, marginBottom: 2 }} title={bp.description}>
          <input type="checkbox" checked={value.includes(bp.id)} onChange={() => toggle(bp.id)} /> {bp.id} {bp.title}
        </label>
      ))}
      <div style={{ marginTop: 6 }}>
        {others.map((id) => (
          <Chip key={id} text={id} bad={!KNOWN_BPS.has(id)} onRemove={() => toggle(id)} />
        ))}
      </div>
      <input
        style={{ ...input, width: "100%", maxWidth: 360 }}
        placeholder="다른 프로세스 BP 검색 (예: SYS.2, 요구사항)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {found.map((b) => (
        <div key={b.id}>
          <button type="button" style={linkBtn} onClick={() => { toggle(b.id); setQ(""); }}>
            + {b.id} {b.title}
          </button>
        </div>
      ))}
    </div>
  );
}

function LinkPicker({ version, item, value, onChange }) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(version.wpItems.map((w) => [w.checkId, w])), [version]);
  const needle = q.trim().toLowerCase();
  const pool = needle
    ? version.wpItems.filter((w) => `${w.checkId} ${w.workProduct} ${w.question}`.toLowerCase().includes(needle))
    : version.wpItems.filter((w) => item.processId && w.processId === item.processId);
  const shown = pool.filter((w) => !value.includes(w.checkId)).slice(0, 15);
  return (
    <div>
      {value.map((id) => {
        const w = byId.get(id);
        return (
          <div key={id} style={{ marginBottom: 4 }}>
            <Chip text={w ? id : `${id} (없는 항목)`} bad={!w} onRemove={() => onChange(value.filter((x) => x !== id))} />
            {w && (
              <span style={{ fontSize: 11, color: T.textLo }}>
                {w.workProduct} · {w.question}
              </span>
            )}
          </div>
        );
      })}
      <input
        style={{ ...input, width: "100%", maxWidth: 360 }}
        placeholder="체크 ID·산출물·문장 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div style={{ fontSize: 11, color: T.textLo, margin: "2px 0" }}>
        {needle ? "검색 결과" : `${item.processId ?? "프로세스 미지정"}의 산출물 항목`} (최대 15건)
      </div>
      <div style={{ maxHeight: 180, overflowY: "auto" }}>
        {shown.map((w) => (
          <div key={w.checkId}>
            <button type="button" style={linkBtn} onClick={() => onChange([...value, w.checkId])}>
              + {w.checkId} <span style={{ color: T.textLo }}>{w.workProduct} · {w.question}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Editable list of strings (one row each, with delete).
function TextRows({ values, onChange, placeholder, multiline }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div>
      {values.map((v, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <Tag
            style={{ ...input, flex: 1 }}
            rows={multiline ? 2 : undefined}
            value={v}
            placeholder={placeholder}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button type="button" style={btn} onClick={() => onChange(values.filter((_, j) => j !== i))}>삭제</button>
        </div>
      ))}
    </div>
  );
}

/**
 * Confirm panel for one item. The form is local state seeded from
 * confirmed ?? draft and is only written back on 확정. `rationale` is grey
 * reference text and never part of what gets confirmed.
 */
export function ChecklistItemEditor({ qa, kind, item, draftRunner }) {
  const version = qa.active;
  const key = kind === "wp" ? item.checkId : item.itemId;
  const [form, setForm] = useState(() => initialForm(kind, item));
  // Re-seed when another item opens or its draft/confirmed content is replaced
  // (state derived from props, adjusted during render).
  const [seed, setSeed] = useState({ key, draft: item.draft, confirmed: item.confirmed });
  if (seed.key !== key || seed.draft !== item.draft || seed.confirmed !== item.confirmed) {
    setSeed({ key, draft: item.draft, confirmed: item.confirmed });
    setForm(initialForm(kind, item));
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const rationale = item.draft?.rationale;
  const wpIds = useMemo(() => new Set(version.wpItems.map((w) => w.checkId)), [version]);
  const check =
    kind === "wp"
      ? canConfirmWp(item, form, processes)
      : canConfirmProcess(item, form, { processes, wpCheckIds: wpIds });
  const missing = kind === "process" ? missingLinks(version, { confirmed: form }) : [];

  const doConfirm = () => {
    const { rationale: _drop, ...rest } = form;    qa.confirm(kind, key, rest);
  };
  const addCriterion = () => {
    const used = new Set(form.criteria.map((c) => c.id));
    let n = form.criteria.length + 1;
    while (used.has(`${key}-${n}`)) n++;
    set({ criteria: [...form.criteria, { id: `${key}-${n}`, text: "" }] });
  };

  return (
    <section style={{ background: T.surface, border: `1px solid ${T.borderL}`, borderRadius: 8, padding: "16px 20px", marginTop: 12 }}>
      <div style={{ background: T.surface2, borderRadius: 6, padding: "10px 12px", fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: T.textHi }}>
          {key} <span style={{ fontWeight: 400, color: T.textLo }}>· {STATUS_LABEL[item.status]}</span>
        </div>
        {kind === "wp" ? (
          <div style={{ color: T.textLo }}>
            {item.workProduct} · 영역: {item.area || "-"} · {item.sheet} {item.row}행
          </div>
        ) : (
          <div style={{ color: T.textLo }}>
            {item.processName} · 단계: {item.phase || "-"} · {item.row}행
          </div>
        )}
        <div style={{ marginTop: 4, color: T.textMd }}>{item.question}</div>
      </div>

      <div style={label}>프로세스</div>
      <select
        value={item.processId ?? ""}
        onChange={(e) => qa.updateItem(kind, key, { processId: e.target.value || null })}
        style={input}
      >
        <option value="">미지정</option>
        {PROCESS_OPTIONS.map((p) => (
          <option key={p.id} value={p.id}>{p.id} {p.name}</option>
        ))}
      </select>

      {kind === "wp" && (
        <>
          <div style={label}>판정 기준</div>
          {form.criteria.map((c, i) => (
            <div key={c.id} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <textarea
                style={{ ...input, flex: 1 }}
                rows={2}
                value={c.text}
                placeholder={`${c.id} · 검증 가능한 문장`}
                onChange={(e) =>
                  set({ criteria: form.criteria.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })
                }
              />
              <button type="button" style={btn} onClick={() => set({ criteria: form.criteria.filter((_, j) => j !== i) })}>
                삭제
              </button>
            </div>
          ))}
          <button type="button" style={btn} onClick={addCriterion}>+ 기준 추가</button>

          <div style={label}>질문 극성</div>
          <label style={{ fontSize: 12, marginRight: 12 }}>
            <input type="radio" checked={form.polarity !== "negative"} onChange={() => set({ polarity: "positive" })} /> 긍정 (예 = Pass)
          </label>
          <label style={{ fontSize: 12 }}>
            <input type="radio" checked={form.polarity === "negative"} onChange={() => set({ polarity: "negative" })} /> 부정 (예 = Fail)
          </label>

          <div style={label}>대상 위치</div>
          <TextRows values={form.targetLocations} placeholder="예: 4. Organization Chart" onChange={(v) => set({ targetLocations: v })} />
          <button type="button" style={btn} onClick={() => set({ targetLocations: [...form.targetLocations, ""] })}>
            + 위치 추가
          </button>

          <div style={label}>심각도</div>
          <select value={form.severity ?? ""} onChange={(e) => set({ severity: e.target.value })} style={input}>
            <option value="">미지정</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>
      )}

      {kind === "process" && (
        <>
          <div style={label}>연결 산출물 체크 ID</div>
          <LinkPicker version={version} item={item} value={form.linkedWpCheckIds ?? []} onChange={(v) => set({ linkedWpCheckIds: v })} />
          {missing.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {missing.map((id) => <span key={id} style={chip(true)}>없는 항목 {id}</span>)}
            </div>
          )}
        </>
      )}

      <div style={label}>관련 BP</div>
      <BpPicker processId={item.processId} value={form.relatedBPs ?? []} onChange={(v) => set({ relatedBPs: v })} />

      {rationale && (
        <div style={{ marginTop: 12, fontSize: 11, color: T.textDim }}>AI 근거(참고): {rationale}</div>
      )}

      {!check.ok && (
        <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 12, color: T.err }}>
          {check.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {check.warnings.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: T.warm }}>
          {check.warnings.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={!check.ok}
          onClick={doConfirm}
          style={{
            ...btn,
            background: check.ok ? T.accent : T.surface3,
            color: check.ok ? T.onAccent : T.textDim,
            border: "none",
            cursor: check.ok ? "pointer" : "not-allowed",
          }}
        >
          확정
        </button>
        <button
          type="button"
          disabled={draftRunner.running || !item.processId}
          onClick={() => draftRunner.run({ kind, scope: { keys: [key] }, includeConfirmed: true })}
          style={btn}
        >
          {draftRunner.running ? "만드는 중..." : "초안 다시 만들기"}
        </button>
        {item.status === "confirmed" && (
          <button type="button" style={btn} onClick={() => qa.unconfirm(kind, key)}>확정 취소</button>
        )}
      </div>
      {draftRunner.failures[key] && (
        <div style={{ marginTop: 8, fontSize: 12, color: T.err }}>초안 실패: {draftRunner.failures[key]}</div>
      )}
    </section>
  );
}
