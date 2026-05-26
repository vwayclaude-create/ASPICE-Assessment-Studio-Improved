import { useRef, useState } from "react";
import { Upload, Play, RotateCcw, Loader2, AlertCircle, Sparkles, X } from "lucide-react";
import { T, FONTS, SECTION_CONTAINER_STYLE } from "../theme";
import { ACCEPT_ATTR, SUPPORTED_FORMATS, getFormatByName } from "../data/formats";
import { SectionBadge } from "./SectionBadge";

export const ImportCard = ({
  files,
  hasFile,
  autoDetected,
  analyzing,
  phase,
  error,
  showReset,
  engines = [],
  onFilesChange,
  onRemoveFile,
  onAnalyzeClick,
  onCancelClick,
  onSampleClick,
  onResetClick,
}) => {
  const inputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const fileCount = files?.length || 0;
  const totalSize = (files || []).reduce((s, f) => s + (f.sizeBytes || 0), 0);
  const primaryName = fileCount === 0
    ? ""
    : fileCount === 1
      ? files[0].name
      : `${files[0].name} 외 ${fileCount - 1}개`;

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.dataTransfer?.types?.includes("Files")) return;
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const dropped = [...(e.dataTransfer?.files || [])];
    if (!dropped.length) return;
    onFilesChange({ target: { files: dropped } }, inputRef);
  };

  const dropActive = isDragging && !analyzing;
  const borderColor = dropActive ? T.warm : (hasFile ? T.accent : T.borderH);
  const bgColor = dropActive ? "rgba(245,158,11,0.08)" : (hasFile ? T.accentSoft : T.surface2);

  const ENGINE_LABEL = { rule: "Rule", llm: "LLM", hybrid: "Hybrid", custom: "Custom" };
  const ENGINE_HINT = {
    rule: "키워드 매칭 (오프라인)",
    llm: "LLM 단독 평가",
    hybrid: "Rule 0.4 + LLM 0.6",
    custom: "사용자 룰 매칭 (오프라인)",
  };
  const engineList = engines.length ? engines : ["hybrid"];
  const engineLabel = engineList.map((id) => ENGINE_LABEL[id] || id).join(" + ");
  const engineHint = engineList.length > 1
    ? `선택된 ${engineList.length}개 엔진 점수 평균`
    : (ENGINE_HINT[engineList[0]] || "");

  return (
    <section style={SECTION_CONTAINER_STYLE}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <SectionBadge color={T.warm}>§ 02 · IMPORT</SectionBadge>
        <span style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          padding: "4px 10px",
          background: T.accentSoft,
          color: T.accent,
          border: `1px solid ${T.accent}`,
          borderRadius: 3,
          fontWeight: 700,
          letterSpacing: "0.06em",
        }} title={engineHint}>
          엔진: {engineLabel}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center" }}>
        <label
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${borderColor}`,
            borderRadius: 5,
            padding: "30px 26px",
            cursor: "pointer",
            background: bgColor,
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            onChange={(e) => onFilesChange(e, inputRef)}
            style={{ display: "none" }}
          />
          <Upload size={28} style={{ color: dropActive ? T.warm : (hasFile ? T.accent : T.textLo) }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: T.textHi,
              letterSpacing: "-0.005em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {dropActive ? "여기에 놓으면 업로드됩니다" : (primaryName || "증적 문서 업로드 (여러 개 선택 가능)")}
            </div>
            <div style={{
              fontSize: 11,
              color: dropActive ? T.warm : T.textLo,
              marginTop: 4,
              fontFamily: FONTS.mono,
            }}>
              {hasFile && !dropActive
                ? `${fileCount} files · ${(totalSize/1024).toFixed(1)} KB · ready`
                : "클릭하거나 파일을 끌어다 놓으세요 · 다중 선택 지원 · max 30MB/파일"}
            </div>
            {hasFile && autoDetected && (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                padding: "4px 10px",
                background: T.accentSoft,
                border: `1px solid ${T.accent}`,
                borderRadius: 3,
                fontFamily: FONTS.mono,
                fontSize: 10,
                color: T.accent,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}>
                ⚡ 자동 감지 → {autoDetected}
              </div>
            )}
            {!hasFile && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {Object.values(SUPPORTED_FORMATS).map((f) => (
                  <span key={f.label} style={{
                    fontFamily: FONTS.mono,
                    fontSize: 9,
                    padding: "3px 7px",
                    border: `1px solid ${T.borderM}`,
                    color: T.textLo,
                    borderRadius: 3,
                    letterSpacing: "0.1em",
                    fontWeight: 600,
                  }}>{f.label}</span>
                ))}
              </div>
            )}
            {hasFile && fileCount > 0 && (
              <div
                style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                {files.map((f) => (
                  <span key={f.name} style={{
                    background: T.surface2,
                    color: T.textHi,
                    padding: "3px 8px",
                    borderRadius: 3,
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: `1px solid ${T.borderL}`,
                    fontFamily: FONTS.mono,
                  }}>
                    {f.name}
                    <span style={{ color: T.textLo, fontSize: 9 }}>
                      {getFormatByName(f.name)?.label || ""}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveFile?.(f.name); }}
                      style={{
                        background: "transparent",
                        color: T.textLo,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        padding: 0,
                        lineHeight: 1,
                      }}
                      disabled={analyzing}
                      title="이 파일 제거"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onAnalyzeClick}
            disabled={analyzing || !hasFile}
            style={{
              background: analyzing || !hasFile ? T.surface3 : T.accent,
              color: analyzing || !hasFile ? T.textLo : T.onAccent,
              border: "none",
              padding: "14px 28px",
              fontFamily: FONTS.mono,
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: analyzing || !hasFile ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 700,
              borderRadius: 3,
              transition: "all 0.15s",
            }}
          >
            {analyzing ? <Loader2 size={14} className="anim-spin" /> : <Play size={14} />}
            {analyzing ? "Analyzing" : "Run Assessment"}
          </button>
          {analyzing && onCancelClick && (
            <button
              onClick={onCancelClick}
              style={{
                background: "transparent",
                color: T.err,
                border: `1px solid ${T.err}`,
                padding: "8px 28px",
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 3,
                fontWeight: 600,
              }}
              title="진행 중인 분석 취소"
            >
              <X size={11} /> Cancel
            </button>
          )}
          <button
            onClick={onSampleClick}
            style={{
              background: "transparent",
              color: T.warm,
              border: `1px solid ${T.warm}66`,
              padding: "8px 28px",
              fontFamily: FONTS.mono,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 3,
              fontWeight: 600,
            }}
            title="API 호출 없이 샘플 리포트 미리보기"
          >
            <Sparkles size={11} /> Load Sample
          </button>
          {showReset && (
            <button
              onClick={() => { onResetClick(); if (inputRef.current) inputRef.current.value = ""; }}
              style={{
                background: "transparent",
                color: T.textMd,
                border: `1px solid ${T.borderM}`,
                padding: "8px 28px",
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 3,
              }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
      </div>

      {phase && (
        <div style={{
          marginTop: 20,
          padding: "12px 16px",
          background: T.surface3,
          border: `1px solid ${T.borderM}`,
          borderRadius: 3,
          color: T.accent,
          fontFamily: FONTS.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <Loader2 size={12} className="anim-spin" /> {phase}...
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 16,
          padding: "12px 16px",
          background: "#2E0A0A",
          border: `1px solid ${T.err}`,
          borderRadius: 3,
          color: "#FCA5A5",
          fontSize: 13,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}
    </section>
  );
};
