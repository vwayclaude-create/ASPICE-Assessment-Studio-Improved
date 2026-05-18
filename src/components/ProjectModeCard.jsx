import { useMemo, useRef, useState } from "react";
import { T, FONTS, SECTION_CONTAINER_STYLE } from "../theme";
import { SectionBadge } from "./SectionBadge";
import { PROCESS_GROUPS } from "../data/processGroups";
import { MAX_FILE_SIZE, getFormatByName } from "../data/formats";
import { extractFileContent } from "../utils/fileReaders";

const ENGINE_OPTIONS = [
  { id: "rule",   label: "Rule (오프라인)",     hint: "키워드/WPID 매칭, 무료" },
  { id: "llm",    label: "LLM (OpenAI)",        hint: "BP/WP/GP 각 호출" },
  { id: "hybrid", label: "Hybrid (0.4 rule + 0.6 llm)", hint: "기본 권장" },
];

export function ProjectModeCard({
  artifacts,
  onAddArtifacts,
  onRemoveArtifact,
  onClearArtifacts,
  processIds,
  onToggleProcess,
  onSelectAllProcesses,
  onClearProcesses,
  onToggleGroupProcesses,
  targetLevel,
  onChangeLevel,
  engine,
  onChangeEngine,
  running,
  phase,
  error,
  onRun,
  onCancel,
}) {
  const [fileError, setFileError] = useState("");
  const [selectMode, setSelectMode] = useState("files"); // "files" | "folder"
  const filesInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const openFilePicker = () => {
    setSelectMode("files");
    filesInputRef.current?.click();
  };
  const openFolderPicker = () => {
    setSelectMode("folder");
    folderInputRef.current?.click();
  };

  const handleFilesChange = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setFileError("");
    const accepted = [];
    const skipped = [];
    for (const f of files) {
      const fmt = getFormatByName(f.name);
      if (!fmt) {
        skipped.push(f.name);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`${f.name}: 30MB 초과.`);
        continue;
      }
      const { b64, text } = await extractFileContent(f, fmt.mode);
      accepted.push({
        name: f.webkitRelativePath || f.name,
        sizeBytes: f.size,
        mimeType: fmt.mode === "pdf" ? "application/pdf" : "text/plain",
        base64: b64 || undefined,
        text: text || undefined,
      });
    }
    if (skipped.length && selectMode === "files") {
      setFileError(`${skipped.join(", ")}: 지원 안 됨. PDF/DOC/DOCX/XLSX/MD만 허용.`);
    }
    if (accepted.length) onAddArtifacts(accepted);
    e.target.value = "";
  };

  const totalProcesses = useMemo(
    () => PROCESS_GROUPS.reduce((s, g) => s + g.ids.length, 0),
    []
  );

  return (
    <section style={{ ...SECTION_CONTAINER_STYLE }}>
      <SectionBadge>05 · 프로젝트 모드 (Cross-process)</SectionBadge>
      <h2 style={{ ...H2 }}>프로젝트 평가</h2>
      <p style={{ color: T.textMd, marginTop: 8, marginBottom: 20, fontSize: 13 }}>
        다중 산출물 · 다중 프로세스를 일괄 평가하고 트레이스 매트릭스 ·
        일관성 · 요구사항→테스트 커버리지 · 변경요청 전파를 검증합니다.
      </p>

      {/* Upload */}
      <div style={{ ...FIELD }}>
        <label style={{ ...LABEL }}>증적 파일 ({artifacts.length}개)</label>
        <div style={{ display: "flex", gap: 6, marginTop: 6, marginBottom: 8 }}>
          <button
            type="button"
            onClick={openFilePicker}
            disabled={running}
            style={{ ...SEG_BTN, ...(selectMode === "files" ? SEG_BTN_ON : {}) }}
          >파일 선택</button>
          <button
            type="button"
            onClick={openFolderPicker}
            disabled={running}
            style={{ ...SEG_BTN, ...(selectMode === "folder" ? SEG_BTN_ON : {}) }}
          >폴더 선택</button>
        </div>
        <input
          ref={filesInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xlsx,.md,.txt,.csv"
          onChange={handleFilesChange}
          disabled={running}
          style={{ display: "none" }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          webkitdirectory=""
          directory=""
          onChange={handleFilesChange}
          disabled={running}
          style={{ display: "none" }}
        />
        {selectMode === "folder" && (
          <div style={{ color: T.textLo, fontSize: 11, marginTop: 6 }}>
            폴더 내 지원 형식(PDF/DOC/DOCX/XLSX/MD/TXT/CSV) 파일만 자동으로 선택됩니다.
          </div>
        )}
        {fileError && <div style={{ ...ERR }}>{fileError}</div>}
        {artifacts.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {artifacts.map((a) => (
              <span key={a.name} style={CHIP}>
                {a.name}
                <button
                  type="button"
                  onClick={() => onRemoveArtifact(a.name)}
                  style={CHIP_X}
                  disabled={running}
                >×</button>
              </span>
            ))}
            <button type="button" onClick={onClearArtifacts} style={LINK_BTN} disabled={running}>모두 지우기</button>
          </div>
        )}
      </div>

      {/* Processes */}
      <div style={FIELD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={LABEL}>대상 프로세스 ({processIds.length}/{totalProcesses})</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onSelectAllProcesses} style={LINK_BTN} disabled={running}>전체</button>
            <button type="button" onClick={onClearProcesses} style={LINK_BTN} disabled={running}>해제</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12, marginTop: 10 }}>
          {PROCESS_GROUPS.map((g) => {
            const selectedCount = g.ids.reduce((n, id) => n + (processIds.includes(id) ? 1 : 0), 0);
            const allChecked = selectedCount === g.ids.length;
            const someChecked = selectedCount > 0 && !allChecked;
            return (
              <div key={g.label} style={{ border: `1px solid ${T.borderL}`, borderRadius: 6, padding: 10 }}>
                <label style={{ ...PROC_OPT, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={() => onToggleGroupProcesses(g.ids, !allChecked)}
                    disabled={running}
                  />
                  <span style={{ color: g.color, fontSize: 11, fontWeight: 600 }}>{g.label}</span>
                </label>
                {g.ids.map((id) => (
                  <label key={id} style={PROC_OPT}>
                    <input
                      type="checkbox"
                      checked={processIds.includes(id)}
                      onChange={() => onToggleProcess(id)}
                      disabled={running}
                    />
                    <span style={{ color: T.textHi, fontSize: 12 }}>{id}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Level + Engine */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={FIELD}>
          <label style={LABEL}>목표 Capability Level</label>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChangeLevel(n)}
                disabled={running}
                style={{ ...SEG_BTN, ...(targetLevel === n ? SEG_BTN_ON : {}) }}
              >CL{n}</button>
            ))}
          </div>
        </div>
        <div style={FIELD}>
          <label style={LABEL}>Scorer 엔진</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {ENGINE_OPTIONS.map((e) => (
              <label key={e.id} style={ENG_OPT}>
                <input
                  type="radio"
                  name="engine"
                  value={e.id}
                  checked={engine === e.id}
                  onChange={() => onChangeEngine(e.id)}
                  disabled={running}
                />
                <div>
                  <div style={{ color: T.textHi, fontSize: 13 }}>{e.label}</div>
                  <div style={{ color: T.textLo, fontSize: 11 }}>{e.hint}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Action */}
      <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={onRun}
          disabled={running || !artifacts.length || !processIds.length}
          style={{
            padding: "10px 22px",
            background: running ? T.surface3 : T.accent,
            color: running ? T.textMd : T.onAccent,
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 13,
            cursor: running ? "not-allowed" : "pointer",
          }}
        >
          {running ? "평가 중…" : "프로젝트 평가 실행"}
        </button>
        {running && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 18px",
              background: "transparent",
              color: T.err,
              border: `1px solid ${T.err}`,
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
            title="진행 중인 프로젝트 평가 취소"
          >취소</button>
        )}
        {phase && <span style={{ color: T.textMd, fontSize: 12 }}>{phase}</span>}
      </div>

      {error && <div style={{ ...ERR, marginTop: 12 }}>{error}</div>}
    </section>
  );
}

const H2 = { color: T.textHi, fontFamily: FONTS.sans, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", margin: 0 };
const FIELD = { marginBottom: 18 };
const LABEL = { color: T.textMd, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 };
const ERR = { color: T.err, fontSize: 12, marginTop: 6 };
const CHIP = { background: T.surface2, color: T.textHi, padding: "4px 10px", borderRadius: 4, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${T.borderL}` };
const CHIP_X = { background: "transparent", color: T.textLo, border: "none", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 };
const LINK_BTN = { background: "transparent", border: "none", color: T.accent, fontSize: 11, cursor: "pointer", padding: "2px 6px" };
const PROC_OPT = { display: "flex", alignItems: "center", gap: 6, padding: "3px 2px", cursor: "pointer" };
const SEG_BTN = { padding: "6px 14px", background: T.surface2, border: `1px solid ${T.borderL}`, borderRadius: 4, color: T.textMd, fontSize: 12, cursor: "pointer", fontWeight: 600 };
const SEG_BTN_ON = { background: T.accentSoft, color: T.accent, borderColor: T.accent };
const ENG_OPT = { display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 4px", cursor: "pointer" };
