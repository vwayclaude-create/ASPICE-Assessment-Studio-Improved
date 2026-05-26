import { Trash2, Upload, Eye, FileDown, Loader2 } from "lucide-react";
import { T, FONTS } from "../theme";
import { countRatings, isCl1Pass } from "../data/ratingMeta";
import { HistoryListShell } from "./HistoryListShell";

const GRID_TEMPLATE = "180px 1fr 1.4fr 110px";
const HISTORY_COLOR = "#A78BFA";
const HEADER_COLUMNS = ["분석일자", "Import 파일", "평가 · 분석 보고서", "Action"];

const HistoryRow = ({ entry, isActive, isLast, onView, onDelete, onExportPdf, exporting }) => {
  const counts = countRatings(entry.results.ratings);
  const fCount = counts.F || 0;
  const lCount = (counts.L || 0) + (counts["L+"] || 0) + (counts["L-"] || 0);
  const pCount = (counts.P || 0) + (counts["P+"] || 0) + (counts["P-"] || 0);
  const nCount = counts.N || 0;
  const pass = isCl1Pass(entry.results.ratings);
  const total = entry.results.ratings.length;
  const dateStr = new Date(entry.date).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });

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
        }} title={entry.fileName}>
          <Upload size={11} style={{ color: T.accent, marginRight: 6, verticalAlign: "middle" }}/>
          {entry.fileName || "—"}
        </div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          color: T.textLo,
          marginTop: 4,
          letterSpacing: "0.05em",
        }}>
          {entry.fileSize ? `${(entry.fileSize/1024).toFixed(1)} KB` : ""}
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
            background: pass ? "#052E1A" : "#2E0A0A",
            borderRadius: 3,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}>
            {pass ? "CONFORMANT" : "GAP"}
          </span>
          <span style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            color: HISTORY_COLOR,
            fontWeight: 700,
          }}>
            {entry.processId}
          </span>
          <span style={{
            fontSize: 12,
            color: T.textMd,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}>
            {entry.processName}
          </span>
        </div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 9,
          color: T.textLo,
          marginTop: 6,
          letterSpacing: "0.05em",
          display: "flex",
          gap: 10,
        }}>
          <span>F:{fCount}</span>
          <span>L:{lCount}</span>
          <span style={{ color: pCount ? T.warm : T.textLo }}>P:{pCount}</span>
          <span style={{ color: nCount ? T.err : T.textLo }}>N:{nCount}</span>
          <span style={{ marginLeft: "auto", color: T.textDim }}>총 {total} BP</span>
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
          title="이 분석 결과를 PDF로 내보내기"
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

export const HistoryCard = ({
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
    sectionLabel="§ 04 · HISTORY"
    title="분석 이력 관리"
    subtitle={`${history.length} ENTRIES · 브라우저에 자동 저장됨`}
    gridTemplate={GRID_TEMPLATE}
    headerColumns={HEADER_COLUMNS}
    entries={history}
    isActiveEntry={(h) => selectedHistoryId === h.id}
    onClearAll={onClearAll}
    emptyPrimary="아직 저장된 분석 이력이 없습니다."
    emptyHint="PDF를 업로드하고 분석을 실행하면 이곳에 자동으로 기록됩니다."
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
