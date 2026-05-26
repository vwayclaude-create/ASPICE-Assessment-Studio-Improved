import { X, FileDown, Loader2 } from "lucide-react";
import { T, FONTS, SECTION_CONTAINER_STYLE } from "../theme";
import { SectionBadge } from "./SectionBadge";
import { RATING_META } from "../data/ratingMeta";
import { condenseGap as condenseGapShared } from "../utils/gapText";

export function ProjectReportCard({ verdict, onClose, onExportPdf, exporting = false }) {
  if (!verdict) return null;
  const { processes = [], crossProcess = {}, meta = {} } = verdict;
  const { traceMatrices = [], consistency = [], coverage, changes, graph } = crossProcess;
  const skipped = meta.skippedArtifacts || [];

  return (
    <section style={{ ...SECTION_CONTAINER_STYLE, position: "relative" }}>
      <SectionBadge>06 · 프로젝트 리포트</SectionBadge>
      {(onClose || onExportPdf) && (
        <div style={{
          position: "absolute",
          top: 14,
          right: 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={exporting}
              aria-label="이 리포트를 PDF로 내보내기"
              title="이 리포트를 PDF로 내보내기"
              style={{
                background: exporting ? T.borderL : "transparent",
                color: T.textHi,
                border: `1px solid ${T.borderM}`,
                padding: "6px 10px",
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: exporting ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 3,
                fontWeight: 600,
                opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? <Loader2 size={11} className="anim-spin" /> : <FileDown size={11} />}
              {exporting ? "생성 중" : "PDF 출력하기"}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="리포트 닫기"
              title="리포트 닫기"
              style={{
                background: "transparent",
                color: T.textMd,
                border: `1px solid ${T.borderM}`,
                padding: "6px 10px",
                fontFamily: FONTS.mono,
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              <X size={11} /> 닫기
            </button>
          )}
        </div>
      )}
      <h2 style={H2}>ASPICE 프로젝트 평가</h2>
      <div style={{ color: T.textLo, fontSize: 11, marginBottom: 20 }}>
        목표 CL{meta.targetLevel} · 산출물 {meta.artifactCount}개 · 그래프 소스: {meta.graphSource}
      </div>

      {skipped.length > 0 && (
        <div style={{
          background: `${T.warm}14`,
          border: `1px solid ${T.warm}66`,
          borderLeft: `3px solid ${T.warm}`,
          borderRadius: 5,
          padding: "10px 14px",
          color: T.textHi,
          fontSize: 12,
          marginBottom: 16,
        }}>
          <strong>파싱 실패로 스킵된 파일 ({skipped.length}):</strong>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            {skipped.map((s, i) => (
              <li key={i}>
                <span style={{ fontFamily: FONTS.mono }}>{s.name}</span>
                <span style={{ color: T.textMd }}> — {s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PA 1.1 rationale from BP evaluation (CL1) */}
      <Pa11Rationale processes={processes} />

      {/* PA 2.1/2.2/3.1/3.2 rationale from GP evaluation (CL2 / CL3 targets).
          Each renders nothing when the PA was not evaluated (target level below it). */}
      <PaGpRationale processes={processes} paId="PA 2.1" />
      <PaGpRationale processes={processes} paId="PA 2.2" />
      <PaGpRationale processes={processes} paId="PA 3.1" />
      <PaGpRationale processes={processes} paId="PA 3.2" />

      {/* Capability summary */}
      <SubHeading>능력 수준 요약 (Capability Summary)</SubHeading>
      <div style={{ overflowX: "auto" }}>
        <table style={TBL}>
          <thead>
            <tr>
              <th style={TH}>프로세스</th>
              <th style={TH}>CL</th>
              {["PA 1.1", "PA 2.1", "PA 2.2", "PA 3.1", "PA 3.2"].map((pa) => (
                <th key={pa} style={TH}>{pa}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => (
              <tr key={p.processId}>
                <td style={TD}><strong>{p.processId}</strong> <span style={{ color: T.textLo }}>{p.processName}</span></td>
                <td style={{ ...TD, textAlign: "center", fontWeight: 700 }}>CL{p.capabilityLevel}</td>
                {["PA 1.1", "PA 2.1", "PA 2.2", "PA 3.1", "PA 3.2"].map((pa) => {
                  const hit = p.pas?.find((x) => x.paId === pa);
                  return (
                    <td key={pa} style={{ ...TD, textAlign: "center" }}>
                      {hit ? <RatingPill code={hit.rating} /> : <span style={{ color: T.textDim }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trace matrix */}
      {traceMatrices.length > 0 && (
        <>
          <SubHeading>추적성 매트릭스 (Traceability Matrix)</SubHeading>
          <div style={{ overflowX: "auto" }}>
            <table style={TBL}>
              <thead>
                <tr>
                  <th style={TH}>출발 → 도착</th>
                  <th style={TH}>WP</th>
                  <th style={TH}>출발 ID 수</th>
                  <th style={TH}>도착 ID 수</th>
                  <th style={TH}>커버리지</th>
                  <th style={TH}>고아 (출발/도착)</th>
                </tr>
              </thead>
              <tbody>
                {traceMatrices.map((m, i) => (
                  <tr key={i}>
                    <td style={TD}>{m.sourceProcess} → {m.targetProcess}</td>
                    <td style={{ ...TD, fontFamily: FONTS.mono }}>{m.sourceWp}</td>
                    <td style={{ ...TD, textAlign: "center" }}>{m.sourceIds.length}</td>
                    <td style={{ ...TD, textAlign: "center" }}>{m.targetIds.length}</td>
                    <td style={{ ...TD, textAlign: "center" }}>{m.coveragePercent == null ? "—" : `${m.coveragePercent}%`}</td>
                    <td style={{ ...TD, textAlign: "center", color: (m.orphansSource.length || m.orphansTarget.length) ? T.warm : T.textLo }}>
                      {(m.orphansSource.length || m.orphansTarget.length) ? (
                        <details>
                          <summary style={{ cursor: "pointer" }}>
                            {m.orphansSource.length} / {m.orphansTarget.length}
                          </summary>
                          <div style={{ textAlign: "left", fontFamily: FONTS.mono, fontSize: 11, color: T.textMd, marginTop: 6, whiteSpace: "normal", wordBreak: "break-all" }}>
                            {m.orphansSource.length > 0 && (
                              <div style={{ marginBottom: m.orphansTarget.length > 0 ? 4 : 0 }}>
                                <span style={{ color: T.textLo }}>출발 누락({m.orphansSource.length}): </span>
                                {m.orphansSource.join(", ")}
                              </div>
                            )}
                            {m.orphansTarget.length > 0 && (
                              <div>
                                <span style={{ color: T.textLo }}>도착 누락({m.orphansTarget.length}): </span>
                                {m.orphansTarget.join(", ")}
                              </div>
                            )}
                          </div>
                        </details>
                      ) : (
                        `${m.orphansSource.length} / ${m.orphansTarget.length}`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Consistency */}
      {consistency.length > 0 && (
        <>
          <SubHeading>일관성 점검 결과 (Consistency Findings)</SubHeading>
          <ul style={LIST}>
            {consistency.map((f, i) => (
              <li key={i} style={{ color: T.textHi, fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: f.severity === "error" ? T.err : f.severity === "warning" ? T.warm : T.textLo, fontSize: 11, textTransform: "uppercase", marginRight: 8 }}>
                  [{f.severity}] {f.kind}
                </span>
                {f.description}
                <div style={{ color: T.textLo, fontSize: 11 }}>아티팩트: {f.relatedArtifacts.join(", ")}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Coverage */}
      {coverage && coverage.totalRequirements > 0 && (
        <>
          <SubHeading>요구사항 → 테스트 커버리지 (Coverage)</SubHeading>
          <div style={{ color: T.textHi, fontSize: 13 }}>
            커버된 요구사항 {coverage.coveredCount} / {coverage.totalRequirements}
            <span style={{ marginLeft: 10, fontWeight: 700, color: coverage.coveragePercent >= 85 ? T.ok : coverage.coveragePercent >= 50 ? T.warm : T.err }}>
              {coverage.coveragePercent}%
            </span>
          </div>
          {coverage.uncovered.length > 0 && (
            <div style={{ color: T.textMd, fontSize: 12, marginTop: 6 }}>
              미커버: <span style={{ fontFamily: FONTS.mono }}>{coverage.uncovered.slice(0, 20).join(", ")}</span>
              {coverage.uncovered.length > 20 && ` (외 ${coverage.uncovered.length - 20}건)`}
            </div>
          )}
        </>
      )}

      {/* Change propagation */}
      {changes && changes.summary?.total > 0 && (
        <>
          <SubHeading>변경 전파 (SUP.10 Change Propagation)</SubHeading>
          <div style={{ color: T.textMd, fontSize: 12, marginBottom: 8 }}>
            총 {changes.summary.total}건 · 전파됨 {changes.summary.propagated} · 검증만 {changes.summary.verificationOnly} · 미해결 {changes.summary.unresolved}
          </div>
          <ul style={LIST}>
            {changes.report.map((r) => (
              <li key={r.crId} style={{ color: T.textHi, fontSize: 13, marginBottom: 4 }}>
                <strong style={{ fontFamily: FONTS.mono }}>{r.crId}</strong>
                <StatusBadge status={r.status} />
                <span style={{ color: T.textLo }}> — 영향받은 산출물 {r.impactedArtifactCount}개: {r.artifacts.join(", ") || "—"}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Graph edge count */}
      {graph?.edges?.length > 0 && (
        <div style={{ marginTop: 16, color: T.textLo, fontSize: 11 }}>
          프로세스 그래프: 노드 {graph.nodes.length} · 엣지 {graph.edges.length} (소스: {graph.source})
        </div>
      )}
    </section>
  );
}

function Pa11Rationale({ processes }) {
  const rows = (processes || [])
    .map((p) => ({ proc: p, pa: p.pas?.find((x) => x.paId === "PA 1.1") }))
    .filter((r) => r.pa);
  if (!rows.length) return null;

  return (
    <>
      <SubHeading>PA 1.1 약점 요약 (BP 평가 기준)</SubHeading>
      <div style={{ color: T.textLo, fontSize: 11, marginBottom: 10 }}>
        PA 1.1(Process Performance)은 각 프로세스 BP의 평균으로 산출됩니다. 아래 표는 프로세스별 PA 1.1 등급과 BP별 개선 필요 항목을 정리한 것입니다.
      </div>
      {rows.map(({ proc, pa }) => {
        const bps = proc.bps || [];
        const avg = bps.length ? Math.round(bps.reduce((s, b) => s + (b.scorePercent || 0), 0) / bps.length) : 0;
        const weak = bps.filter((b) => ["P+", "P-", "N"].includes(b.rating));
        return (
          <div key={proc.processId} style={{
            border: `1px solid ${T.borderL}`,
            borderRadius: 5,
            padding: "10px 12px",
            marginBottom: 10,
            background: T.surfaceL || "transparent",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <strong style={{ color: T.textHi, fontSize: 13 }}>{proc.processId}</strong>
              <span style={{ color: T.textLo, fontSize: 12 }}>{proc.processName}</span>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: T.textLo, fontSize: 11 }}>PA 1.1</span>
                <RatingPill code={pa.rating} />
                <span style={{ color: T.textLo, fontSize: 11, fontFamily: FONTS.mono }}>BP 평균 {avg}%</span>
              </span>
            </div>
            <table style={TBL}>
              <thead>
                <tr>
                  <th style={TH}>BP</th>
                  <th style={TH}>제목</th>
                  <th style={{ ...TH, textAlign: "center" }}>등급</th>
                  <th style={{ ...TH, textAlign: "center" }}>점수</th>
                  <th style={TH}>약점 (개선 필요)</th>
                </tr>
              </thead>
              <tbody>
                {bps.map((b) => (
                  <tr key={b.id}>
                    <td style={{ ...TD, fontFamily: FONTS.mono, whiteSpace: "nowrap" }}>{b.id}</td>
                    <td style={TD}>{b.title}</td>
                    <td style={{ ...TD, textAlign: "center" }}><RatingPill code={b.rating} /></td>
                    <td style={{ ...TD, textAlign: "center", fontFamily: FONTS.mono }}>{Math.round(b.scorePercent || 0)}%</td>
                    <td style={{ ...TD, color: T.textMd, fontSize: 11 }}>{summarizeBp(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {weak.length > 0 && (
              <div style={{ marginTop: 8, color: T.warm, fontSize: 11 }}>
                약점 BP({weak.length}건): {weak.map((b) => `${b.id}(${b.rating})`).join(", ")} — PA 1.1이 L-에 머무르는 주된 원인.
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function summarizeBp(b) {
  const gaps = (b.gaps || [])
    .map((g) => condenseGapShared(g, { maxLen: 70 }))
    .filter(Boolean);
  if (gaps.length) return `개선 필요 — ${gaps.slice(0, 2).join(" / ")}`;
  if (["F", "L+", "L-"].includes(b.rating)) return "특이 약점 없음";
  return "개선 필요 — 평가 근거 미확보";
}

// PA 2.1 ~ PA 3.2 are evaluated GP-by-GP (unlike PA 1.1 which is anchored on
// BP results). When the target CL is 1 these PAs are not evaluated and the
// section is skipped entirely.
const PA_GP_META = {
  "PA 2.1": {
    subtitle: "프로세스 수행 관리 (Process Performance Management)",
    intro:
      "PA 2.1은 프로세스 수행이 계획·모니터링·조정되는지를 일반 실무(GP) 단위로 평가합니다. 아래 표는 프로세스별 PA 2.1 등급과 GP별 개선 필요 항목입니다.",
  },
  "PA 2.2": {
    subtitle: "작업산출물 관리 (Work Product Management)",
    intro:
      "PA 2.2는 작업산출물의 정의·관리·검토가 적절한지를 일반 실무(GP) 단위로 평가합니다. 아래 표는 프로세스별 PA 2.2 등급과 GP별 개선 필요 항목입니다.",
  },
  "PA 3.1": {
    subtitle: "프로세스 정의 (Process Definition)",
    intro:
      "PA 3.1은 표준 프로세스가 정의·유지되는지를 일반 실무(GP) 단위로 평가합니다. 아래 표는 프로세스별 PA 3.1 등급과 GP별 개선 필요 항목입니다.",
  },
  "PA 3.2": {
    subtitle: "프로세스 배포 (Process Deployment)",
    intro:
      "PA 3.2는 정의된 표준 프로세스가 실제로 배포·운영되는지를 일반 실무(GP) 단위로 평가합니다. 아래 표는 프로세스별 PA 3.2 등급과 GP별 개선 필요 항목입니다.",
  },
};

function PaGpRationale({ processes, paId }) {
  const meta = PA_GP_META[paId];
  if (!meta) return null;
  const rows = (processes || [])
    .map((p) => ({ proc: p, pa: p.pas?.find((x) => x.paId === paId) }))
    .filter((r) => r.pa && (r.pa.gps?.length ?? 0) > 0);
  if (!rows.length) return null;

  return (
    <>
      <SubHeading>{paId} {meta.subtitle} — GP 평가</SubHeading>
      <div style={{ color: T.textLo, fontSize: 11, marginBottom: 10 }}>{meta.intro}</div>
      {rows.map(({ proc, pa }) => {
        const gps = pa.gps || [];
        const avg = gps.length
          ? Math.round(gps.reduce((s, g) => s + (g.scorePercent || 0), 0) / gps.length)
          : 0;
        const weak = gps.filter((g) => ["P+", "P-", "N"].includes(g.rating));
        return (
          <div key={proc.processId} style={{
            border: `1px solid ${T.borderL}`,
            borderRadius: 5,
            padding: "10px 12px",
            marginBottom: 10,
            background: T.surfaceL || "transparent",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <strong style={{ color: T.textHi, fontSize: 13 }}>{proc.processId}</strong>
              <span style={{ color: T.textLo, fontSize: 12 }}>{proc.processName}</span>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: T.textLo, fontSize: 11 }}>{paId}</span>
                <RatingPill code={pa.rating} />
                <span style={{ color: T.textLo, fontSize: 11, fontFamily: FONTS.mono }}>GP 평균 {avg}%</span>
              </span>
            </div>
            <table style={TBL}>
              <thead>
                <tr>
                  <th style={TH}>GP</th>
                  <th style={TH}>제목</th>
                  <th style={{ ...TH, textAlign: "center" }}>등급</th>
                  <th style={{ ...TH, textAlign: "center" }}>점수</th>
                  <th style={TH}>약점 (개선 필요)</th>
                </tr>
              </thead>
              <tbody>
                {gps.map((g) => (
                  <tr key={g.id}>
                    <td style={{ ...TD, fontFamily: FONTS.mono, whiteSpace: "nowrap" }}>{g.id}</td>
                    <td style={TD}>{g.title}</td>
                    <td style={{ ...TD, textAlign: "center" }}><RatingPill code={g.rating} /></td>
                    <td style={{ ...TD, textAlign: "center", fontFamily: FONTS.mono }}>{Math.round(g.scorePercent || 0)}%</td>
                    <td style={{ ...TD, color: T.textMd, fontSize: 11 }}>{summarizeGp(g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {weak.length > 0 && (
              <div style={{ marginTop: 8, color: T.warm, fontSize: 11 }}>
                약점 GP({weak.length}건): {weak.map((g) => `${g.id}(${g.rating})`).join(", ")} — {paId} 등급을 끌어내리는 주된 원인.
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function summarizeGp(g) {
  const gaps = (g.gaps || [])
    .map((x) => condenseGapShared(x, { maxLen: 70 }))
    .filter(Boolean);
  if (gaps.length) return `개선 필요 — ${gaps.slice(0, 2).join(" / ")}`;
  if (["F", "L+", "L-"].includes(g.rating)) return "특이 약점 없음";
  return "개선 필요 — 평가 근거 미확보";
}

function RatingPill({ code }) {
  const meta = RATING_META[code];
  if (!meta) return <span style={{ color: T.textDim }}>{code}</span>;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 3,
      background: meta.bg,
      color: meta.fg,
      fontSize: 11,
      fontFamily: FONTS.mono,
      fontWeight: 700,
    }}>{code}</span>
  );
}

function StatusBadge({ status }) {
  const color = status === "propagated" ? T.ok : status === "verification-only" ? T.warm : T.err;
  return (
    <span style={{
      marginLeft: 6, padding: "1px 6px", fontSize: 10, fontFamily: FONTS.mono,
      borderRadius: 3, background: `${color}22`, color, textTransform: "uppercase",
    }}>{status}</span>
  );
}

function SubHeading({ children }) {
  return (
    <h3 style={{
      color: T.textHi, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em",
      fontWeight: 700, marginTop: 22, marginBottom: 10, paddingBottom: 4,
      borderBottom: `1px solid ${T.borderL}`,
    }}>{children}</h3>
  );
}

const H2 = { color: T.textHi, fontFamily: FONTS.sans, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", margin: 0, marginBottom: 4 };
const TBL = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const TH = { textAlign: "left", padding: "6px 10px", color: T.textMd, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${T.borderL}` };
const TD = { padding: "6px 10px", color: T.textHi, borderBottom: `1px solid ${T.borderL}` };
const LIST = { margin: 0, padding: 0, listStyle: "none" };
