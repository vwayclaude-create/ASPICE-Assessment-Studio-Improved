import { Trash2, FolderOpen, Eye, Layers, FileDown, Loader2 } from "lucide-react";
import { T, FONTS } from "../theme";
import { HistoryListShell } from "./HistoryListShell";

const GRID_TEMPLATE = "180px 1fr 1.6fr 110px";
const HISTORY_COLOR = "#A78BFA";
const HEADER_COLUMNS = ["분석일자", "증적 / 엔진", "프로젝트 평가 결과", "Action"];

const summarize = (entry) => {
  const v = entry.verdict || {};
  const processes = v.processes || [];
  const targetLevel = entry.targetLevel ?? v.meta?.targetLevel ?? 1;
  const meets = processes.filter((p) => (p.capabilityLevel ?? 0) >= targetLevel).length;
  const total = processes.length;
  const pass = total > 0 && meets === total;
  const consistencyErrors = (v.crossProcess?.consistency || []).filter((c) => c.severity === "error").length;
  const coverage = v.crossProcess?.coverage?.coveragePercent;
  return { processes, total, meets, pass, targetLevel, consistencyErrors, coverage };
};

const HistoryRow = ({ entry, isActive, isLast, onView, onDelete, onExportPdf, exporting }) => {
  const { total, meets, pass, targetLevel, consistencyErrors, coverage } = summarize(entry);
  const dateStr = new Date(entry.date).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const firstFiles = entry.artifactNames?.slice(0, 2).join(", ") || "—";
  const moreCount = (entry.artifactNames?.length || 0) - 2;
  const procPreview = (entry.processIds || []).slice(0, 4).join(", ");
  const procMore = (entry.processIds?.length || 0) - 4;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: GRID_TEMPLATE,
      borderBottom: isLast ? "none" : `1px solid ${T.borderL}`,
      background: isActive ? T.accentSoft : "transparent",
      transition: "background 0.15s",
      alignItems: "center",
    }}>
      <div style={{
        padding: "14px 16px",
        borderRight: `1px solid ${T.borderL}`,
        fontFamily: FONTS.mono,
        fontSize: 11,
        color: isActive ? T.textHi : T.textMd,
        lineHeight: 1.5,
      }}>
        {dateStr}
        {entry.isSample && (
          <div style={{ fontSize: 9, color: T.warm, marginTop: 3, letterSpacing: "0.1em" }}>SAMPLE</div>
        )}
      </div>
      <div style={{ padding: "14px 16px", borderRight: `1px solid ${T.borderL}`, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          color: T.textHi,
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }} title={entry.artifactNames?.join("\n")}>
          <FolderOpen size={11} style={{ color: T.accent, marginRight: 6, verticalAlign: "middle" }}/>
          {entry.artifactCount}개 산출물
        </div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          color: T.textLo,
          marginTop: 4,
          letterSpacing: "0.05em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }} title={entry.artifactNames?.join("\n")}>
          {firstFiles}{moreCount > 0 ? ` 외 ${moreCount}` : ""}
        </div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          color: T.textDim,
          marginTop: 3,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          엔진: {Array.isArray(entry.engines) && entry.engines.length
            ? entry.engines.join(" + ")
            : (entry.engine || "rule")}
        </div>
      </div>
      <div style={{ padding: "14px 16px", borderRight: `1px solid ${T.borderL}`, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            padding: "3px 8px",
            border: `1px solid ${pass ? T.ok : T.err}`,
            color: pass ? T.ok : T.err,
            background: pass ? "#E6F7EF" : "#FDECEC",
            borderRadius: 3,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}>
            {pass ? "TARGET MET" : "GAP"}
          </span>
          <span style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: HISTORY_COLOR,
            fontWeight: 700,
          }}>
            <Layers size={10} style={{ verticalAlign: "middle", marginRight: 4 }}/>
            CL{targetLevel} 목표
          </span>
          <span style={{
            fontSize: 12,
            color: T.textMd,
          }}>
            {meets}/{total} 프로세스 충족
          </span>
        </div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          color: T.textLo,
          marginTop: 6,
          letterSpacing: "0.05em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }} title={(entry.processIds || []).join(", ")}>
          {procPreview}{procMore > 0 ? ` 외 ${procMore}` : ""}
        </div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          color: T.textLo,
          marginTop: 4,
          letterSpacing: "0.05em",
          display: "flex",
          gap: 12,
        }}>
          {coverage != null && (
            <span>
              커버리지 <span style={{
                color: coverage >= 85 ? T.ok : coverage >= 50 ? T.warm : T.err,
                fontWeight: 700,
              }}>{coverage}%</span>
            </span>
          )}
          <span style={{ color: consistencyErrors ? T.err : T.textLo }}>
            일관성 ERR {consistencyErrors}
          </span>
        </div>
      </div>
      <div style={{
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "stretch",
      }}>
        <button
          onClick={onView}
          style={{
            background: isActive ? T.accent : "transparent",
            color: isActive ? T.onAccent : T.accent,
            border: `1px solid ${T.accent}`,
            padding: "6px 10px",
            fontFamily: FONTS.mono,
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            borderRadius: 3,
            fontWeight: 700,
          }}
        >
          <Eye size={11}/> {isActive ? "닫기" : "보기"}
        </button>
        <button
          onClick={onExportPdf}
          disabled={exporting}
          title="이 분석 결과를 가로 PDF로 내보내기"
          style={{
            background: exporting ? T.borderL : "transparent",
            color: T.textHi,
            border: `1px solid ${T.borderM}`,
            padding: "5px 10px",
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: exporting ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            borderRadius: 3,
            fontWeight: 600,
            opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting ? <Loader2 size={9} className="anim-spin" /> : <FileDown size={9} />}
          {exporting ? "생성 중" : "PDF"}
        </button>
        <button
          onClick={onDelete}
          style={{
            background: "transparent",
            color: T.textLo,
            border: `1px solid ${T.borderM}`,
            padding: "5px 10px",
            fontFamily: FONTS.mono,
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            borderRadius: 3,
          }}
        >
          <Trash2 size={9}/> Del
        </button>
      </div>
    </div>
  );
};

export const ProjectHistoryCard = ({
  history,
  selectedHistoryId,
  onToggleView,
  onDeleteEntry,
  onClearAll,
  onExportEntryPdf,
  exportingEntryId,
}) => (
  <HistoryListShell
    accentColor={HISTORY_COLOR}
    sectionLabel="§ 07 · PROJECT HISTORY"
    title="프로젝트 평가 이력 관리"
    subtitle={`${history.length} ENTRIES · 브라우저에 자동 저장됨`}
    gridTemplate={GRID_TEMPLATE}
    headerColumns={HEADER_COLUMNS}
    entries={history}
    isActiveEntry={(h) => selectedHistoryId === h.id}
    onClearAll={onClearAll}
    emptyPrimary="아직 저장된 프로젝트 평가 이력이 없습니다."
    emptyHint="산출물을 업로드하고 프로젝트 평가를 실행하면 이곳에 자동 기록됩니다."
    renderRow={(h, { isLast, isActive }) => (
      <HistoryRow
        key={h.id}
        entry={h}
        isActive={isActive}
        isLast={isLast}
        onView={() => onToggleView(h.id)}
        onDelete={() => onDeleteEntry(h.id)}
        onExportPdf={() => onExportEntryPdf?.(h)}
        exporting={exportingEntryId === h.id}
      />
    )}
  />
);
