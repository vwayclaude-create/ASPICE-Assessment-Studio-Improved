// 프로젝트 평가 결과 PDF 내보내기 (가로 A4, 표지 + 목차 + 섹션 본문).
// 호출자 흐름:
//   exportProjectReportAsPdf({ verdict, entry })
//     ├─ 본문 HTML을 화면 밖에 렌더 → html2canvas로 캡처
//     ├─ 캡처된 큰 캔버스를 가로 A4 페이지 높이로 슬라이스, 각 섹션의 시작 페이지 기록
//     ├─ 시작 페이지 정보로 목차 HTML 생성 → 캡처
//     ├─ 표지 HTML 생성 → 캡처
//     └─ jsPDF에 [표지][목차][본문 페이지들] 순으로 addImage / addPage
//
// 렌더는 모두 html2canvas → 이미지 변환을 거치므로 한글 폰트 임베딩 없이도 깨지지 않는다.
// 화면용 컴포넌트는 건드리지 않고 PDF 전용 정적 HTML을 직접 빌드한다.
import jsPDF from "jspdf";
import { RATING_META } from "../data/ratingMeta";
import { captureToPngCanvas, sliceCanvasToPdfPage } from "./pdfPaginator";
import { condenseGap as condenseGapShared } from "./gapText";

// A4 가로
const PAGE_W_MM = 297;
const PAGE_H_MM = 210;
const SIDE_MM = 8;
const HEADER_H_MM = 12;
const FOOTER_H_MM = 7;
const CONTENT_W_MM = PAGE_W_MM - SIDE_MM * 2;
const CONTENT_TOP_MM = HEADER_H_MM + 2;
const CONTENT_BOT_MM = PAGE_H_MM - FOOTER_H_MM - 2;
const CONTENT_H_MM = CONTENT_BOT_MM - CONTENT_TOP_MM;

// html2canvas 캡처 폭 (px). 가로 A4 컨텐츠 영역(281mm) ≈ 1100px @ ~96dpi.
const CAPTURE_W_PX = 1100;

const FONT_SANS = "'Inter', 'Noto Sans KR', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'D2Coding', monospace";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

const formatDate = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ratingPillHtml = (code) => {
  const m = RATING_META[code];
  if (!m) return `<span style="color:#94A3B8">${esc(code || "—")}</span>`;
  return `<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:${m.bg};color:${m.fg};font-size:10px;font-family:${FONT_MONO};font-weight:700">${esc(code)}</span>`;
};

function offscreenStage() {
  const stage = document.createElement("div");
  stage.style.cssText = `
    position: fixed;
    left: -99999px;
    top: 0;
    width: ${CAPTURE_W_PX}px;
    background: #FFFFFF;
    color: #0F172A;
    font-family: ${FONT_SANS};
    -webkit-font-smoothing: antialiased;
  `;
  document.body.appendChild(stage);
  return stage;
}

const baseSectionPad = "padding: 18px 22px;";

function coverHtml({ entry, verdict }) {
  const date = formatDate(entry?.date);
  const target = verdict?.meta?.targetLevel ?? entry?.targetLevel ?? 1;
  const arts = entry?.artifactNames || [];
  const procIds = entry?.processIds || (verdict?.processes || []).map((p) => p.processId);
  const engine = (entry?.engine || verdict?.meta?.engine || "hybrid").toUpperCase();
  return `
    <div style="${baseSectionPad}padding-top:80px;padding-bottom:80px;height:${CAPTURE_W_PX * (PAGE_H_MM / PAGE_W_MM)}px;display:flex;flex-direction:column;justify-content:space-between">
      <div>
        <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:0.2em;color:#64748B;margin-bottom:18px">ASPICE 4.0 · 프로젝트 평가 보고서</div>
        <div style="font-size:42px;font-weight:800;letter-spacing:-0.025em;color:#0F172A;line-height:1.1;margin-bottom:14px">프로젝트 평가 결과</div>
        <div style="font-size:16px;color:#475569;line-height:1.55;max-width:760px">
          본 보고서는 업로드된 산출물에 대해 ASPICE PAM v4.0 기준으로 수행된 자동 평가의 요약입니다. 능력 수준, 추적성, 일관성, 커버리지, 변경 전파를 포함합니다.
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:18px 32px;font-size:13px">
        <div>
          <div style="font-family:${FONT_MONO};font-size:9px;letter-spacing:0.15em;color:#94A3B8;text-transform:uppercase;margin-bottom:4px">발행일</div>
          <div style="color:#0F172A;font-weight:600">${esc(date)}</div>
        </div>
        <div>
          <div style="font-family:${FONT_MONO};font-size:9px;letter-spacing:0.15em;color:#94A3B8;text-transform:uppercase;margin-bottom:4px">목표 능력 수준</div>
          <div style="color:#0F172A;font-weight:700">CL ${esc(target)}</div>
        </div>
        <div>
          <div style="font-family:${FONT_MONO};font-size:9px;letter-spacing:0.15em;color:#94A3B8;text-transform:uppercase;margin-bottom:4px">평가 엔진</div>
          <div style="font-family:${FONT_MONO};color:#0F172A;font-weight:600">${esc(engine)}</div>
        </div>
        <div>
          <div style="font-family:${FONT_MONO};font-size:9px;letter-spacing:0.15em;color:#94A3B8;text-transform:uppercase;margin-bottom:4px">대상 프로세스 (${procIds.length})</div>
          <div style="font-family:${FONT_MONO};color:#0F172A;font-weight:600;font-size:12px;line-height:1.5">${esc(procIds.join(", "))}</div>
        </div>
        <div style="grid-column:1 / -1">
          <div style="font-family:${FONT_MONO};font-size:9px;letter-spacing:0.15em;color:#94A3B8;text-transform:uppercase;margin-bottom:6px">증적 산출물 (${arts.length})</div>
          <ul style="margin:0;padding:0 0 0 18px;color:#334155;font-size:12px;line-height:1.6">
            ${arts.map((n) => `<li style="font-family:${FONT_MONO}">${esc(n)}</li>`).join("")}
          </ul>
        </div>
      </div>
      <div style="border-top:1px solid #CBD5E1;padding-top:12px;font-size:10px;font-family:${FONT_MONO};color:#94A3B8;letter-spacing:0.1em">
        Automotive SPICE® · VDA QMC · ASPICE Workbench
      </div>
    </div>
  `;
}

function tocHtml(sections) {
  // 페이지 정중앙 정렬 + 카드형 컴팩트 레이아웃. 가로 A4 비율(297:210)에 맞춰
  // 외곽 컨테이너 높이를 잡아주면 html2canvas 캡처가 한 페이지로 깔끔하게 떨어진다.
  const pageHeightPx = Math.round(CAPTURE_W_PX * (PAGE_H_MM / PAGE_W_MM));
  const rows = sections.map((s, i) => `
    <div style="display:flex;align-items:baseline;gap:14px;padding:9px 4px;border-bottom:1px dotted #CBD5E1">
      <span style="font-family:${FONT_MONO};color:#94A3B8;font-size:9px;letter-spacing:0.1em;width:24px;flex-shrink:0">${String(i + 1).padStart(2, "0")}</span>
      <span style="color:#0F172A;font-size:11px;font-weight:500;letter-spacing:-0.005em;flex:1;line-height:1.3">${esc(s.title)}</span>
      <span style="font-family:${FONT_MONO};color:#475569;font-size:9.5px;letter-spacing:0.04em">p.&nbsp;${s.page}</span>
    </div>
  `).join("");
  return `
    <div style="width:${CAPTURE_W_PX}px;height:${pageHeightPx}px;display:flex;align-items:center;justify-content:center;padding:40px 60px;box-sizing:border-box;background:#FFFFFF">
      <div style="width:100%;max-width:520px">
        <div style="text-align:center;font-family:${FONT_MONO};font-size:8.5px;letter-spacing:0.32em;color:#94A3B8;margin-bottom:10px">TABLE OF CONTENTS</div>
        <div style="text-align:center;font-size:26px;font-weight:800;letter-spacing:-0.02em;color:#0F172A;margin-bottom:8px;line-height:1">목차</div>
        <div style="width:34px;height:2px;background:#0F172A;margin:0 auto 26px"></div>
        ${rows}
      </div>
    </div>
  `;
}

function reportContentHtml(verdict, entry) {
  const { processes = [], crossProcess = {}, meta = {} } = verdict || {};
  const { traceMatrices = [], consistency = [], coverage, changes } = crossProcess;
  const target = meta.targetLevel ?? entry?.targetLevel ?? 1;
  const metProcesses = processes.filter((p) => (p.capabilityLevel ?? 0) >= target);

  // 섹션 번호는 실제로 포함되는 것만 카운트해 1.., 2.. 순으로 부여한다.
  // 빈 섹션이 스킵되어도 "4, 6, 8" 같은 구멍 난 번호가 나오지 않는다.
  let counter = 0;
  const num = () => ++counter;
  const sections = [];

  // Executive Summary
  sections.push({
    id: "summary",
    title: `${num()}. 평가 요약 (Executive Summary)`,
    body: `
      <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:12px;margin-bottom:14px">
        ${kpi("목표 능력 수준", `CL ${target}`)}
        ${kpi("프로세스 충족", `${metProcesses.length} / ${processes.length}`, metProcesses.length === processes.length ? "#059669" : "#DC2626")}
        ${kpi("산출물", `${meta.artifactCount ?? entry?.artifactCount ?? 0}개`)}
        ${kpi("커버리지", coverage?.coveragePercent != null ? `${coverage.coveragePercent}%` : "—", coverageColor(coverage?.coveragePercent))}
      </div>
      <div style="font-size:12px;color:#475569;line-height:1.6">
        평가 대상 프로세스 ${processes.length}개 중 <strong style="color:#0F172A">${metProcesses.length}개</strong>가 목표 능력 수준을 충족하였으며,
        교차 프로세스 일관성 점검에서 <strong>${consistency.filter((c) => c.severity === "error").length}건</strong>의 오류,
        <strong>${consistency.filter((c) => c.severity === "warning").length}건</strong>의 경고가 발견되었습니다.
      </div>
    `,
  });

  // Capability Summary
  sections.push({
    id: "cl",
    title: `${num()}. 능력 수준 요약 (Capability Summary)`,
    body: tableHtml(
      ["프로세스", "CL", "PA 1.1", "PA 2.1", "PA 2.2", "PA 3.1", "PA 3.2"],
      processes.map((p) => [
        `<strong>${esc(p.processId)}</strong> <span style="color:#64748B">${esc(p.processName)}</span>`,
        `<strong>CL${p.capabilityLevel}</strong>`,
        ...["PA 1.1", "PA 2.1", "PA 2.2", "PA 3.1", "PA 3.2"].map((pa) => {
          const hit = p.pas?.find((x) => x.paId === pa);
          return hit ? ratingPillHtml(hit.rating) : `<span style="color:#94A3B8">—</span>`;
        }),
      ]),
      [null, "center", "center", "center", "center", "center", "center"],
    ),
  });

  // PA 1.1 details (per process)
  sections.push({
    id: "pa11",
    title: `${num()}. PA 1.1 약점 — 프로세스별 BP 평가`,
    body: processes.map((p) => {
      const bps = p.bps || [];
      const avg = bps.length ? Math.round(bps.reduce((s, b) => s + (b.scorePercent || 0), 0) / bps.length) : 0;
      const pa = p.pas?.find((x) => x.paId === "PA 1.1");
      return `
        <div style="border:1px solid #E2E8F0;border-radius:5px;padding:12px 14px;margin-bottom:12px;background:#F8FAFC">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <strong style="font-size:13px;color:#0F172A">${esc(p.processId)}</strong>
            <span style="color:#64748B;font-size:12px">${esc(p.processName)}</span>
            <span style="margin-left:auto;display:inline-flex;align-items:center;gap:8px">
              <span style="font-size:10px;color:#64748B">PA 1.1</span>
              ${pa ? ratingPillHtml(pa.rating) : ""}
              <span style="font-family:${FONT_MONO};font-size:10px;color:#64748B">BP 평균 ${avg}%</span>
            </span>
          </div>
          ${tableHtml(
            ["BP", "제목", "등급", "점수", "약점 (개선 필요)"],
            bps.map((b) => [
              `<span style="font-family:${FONT_MONO};white-space:nowrap">${esc(b.id)}</span>`,
              esc(b.title || ""),
              ratingPillHtml(b.rating),
              `<span style="font-family:${FONT_MONO}">${Math.round(b.scorePercent || 0)}%</span>`,
              `<span style="color:#475569;font-size:11px">${esc(summarizeBp(b))}</span>`,
            ]),
            [null, null, "center", "center", null],
          )}
        </div>
      `;
    }).join(""),
  });

  // PA 2.1 ~ PA 3.2 details (per process, GP-by-GP). Only present when the
  // target CL is 2 or 3 — otherwise the harness does not evaluate these PAs
  // and the section is skipped (no `pas` entry → no rows).
  const PA_GP_LABELS = {
    "PA 2.1": "프로세스 수행 관리",
    "PA 2.2": "작업산출물 관리",
    "PA 3.1": "프로세스 정의",
    "PA 3.2": "프로세스 배포",
  };
  for (const [paId, label] of Object.entries(PA_GP_LABELS)) {
    const paRows = processes
      .map((p) => ({ proc: p, pa: p.pas?.find((x) => x.paId === paId) }))
      .filter((r) => r.pa && (r.pa.gps?.length ?? 0) > 0);
    if (!paRows.length) continue;
    sections.push({
      id: `pa${paId.replace(/\D/g, "")}`,
      title: `${num()}. ${paId} 약점 — 프로세스별 GP 평가 (${label})`,
      body: paRows.map(({ proc, pa }) => {
        const gps = pa.gps || [];
        const avg = gps.length ? Math.round(gps.reduce((s, g) => s + (g.scorePercent || 0), 0) / gps.length) : 0;
        return `
          <div style="border:1px solid #E2E8F0;border-radius:5px;padding:12px 14px;margin-bottom:12px;background:#F8FAFC">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <strong style="font-size:13px;color:#0F172A">${esc(proc.processId)}</strong>
              <span style="color:#64748B;font-size:12px">${esc(proc.processName)}</span>
              <span style="margin-left:auto;display:inline-flex;align-items:center;gap:8px">
                <span style="font-size:10px;color:#64748B">${esc(paId)}</span>
                ${ratingPillHtml(pa.rating)}
                <span style="font-family:${FONT_MONO};font-size:10px;color:#64748B">GP 평균 ${avg}%</span>
              </span>
            </div>
            ${tableHtml(
              ["GP", "제목", "등급", "점수", "약점 (개선 필요)"],
              gps.map((g) => [
                `<span style="font-family:${FONT_MONO};white-space:nowrap">${esc(g.id)}</span>`,
                esc(g.title || ""),
                ratingPillHtml(g.rating),
                `<span style="font-family:${FONT_MONO}">${Math.round(g.scorePercent || 0)}%</span>`,
                `<span style="color:#475569;font-size:11px">${esc(summarizeGp(g))}</span>`,
              ]),
              [null, null, "center", "center", null],
            )}
          </div>
        `;
      }).join(""),
    });
  }

  // Traceability
  if (traceMatrices.length > 0) {
    const traceTable = tableHtml(
      ["출발 → 도착", "WP", "출발 ID 수", "도착 ID 수", "커버리지", "고아 (출발/도착)"],
      traceMatrices.map((m) => [
        `${esc(m.sourceProcess)} → ${esc(m.targetProcess)}`,
        `<span style="font-family:${FONT_MONO}">${esc(m.sourceWp)}</span>`,
        String(m.sourceIds?.length ?? 0),
        String(m.targetIds?.length ?? 0),
        m.coveragePercent == null ? "—" : `${m.coveragePercent}%`,
        `<span style="color:${(m.orphansSource?.length || m.orphansTarget?.length) ? "#D97706" : "#64748B"}">${m.orphansSource?.length ?? 0} / ${m.orphansTarget?.length ?? 0}</span>`,
      ]),
      [null, null, "center", "center", "center", "center"],
    );
    // Per-edge orphan ID listing — the matrix cell only carries counts, so
    // the actual unreferenced IDs are spelled out here for follow-up.
    const orphanDetail = traceMatrices
      .filter((m) => (m.orphansSource?.length || m.orphansTarget?.length))
      .map((m) => {
        const lines = [];
        if (m.orphansSource?.length) {
          lines.push(`<div><span style="color:#64748B">출발 누락(${m.orphansSource.length}): </span><span style="font-family:${FONT_MONO};word-break:break-all">${esc(m.orphansSource.join(", "))}</span></div>`);
        }
        if (m.orphansTarget?.length) {
          lines.push(`<div><span style="color:#64748B">도착 누락(${m.orphansTarget.length}): </span><span style="font-family:${FONT_MONO};word-break:break-all">${esc(m.orphansTarget.join(", "))}</span></div>`);
        }
        return `
          <div style="padding:8px 10px;border-left:3px solid #D97706;background:#F8FAFC;margin-bottom:6px;border-radius:0 3px 3px 0;font-size:11px;color:#475569">
            <strong style="color:#0F172A">${esc(m.sourceProcess)} → ${esc(m.targetProcess)}</strong>
            <span style="color:#64748B"> · WP ${esc(m.sourceWp)}</span>
            ${lines.join("")}
          </div>`;
      })
      .join("");
    sections.push({
      id: "trace",
      title: `${num()}. 추적성 매트릭스 (Traceability Matrix)`,
      body: orphanDetail
        ? `${traceTable}<div style="margin-top:10px"><div style="font-size:11px;color:#64748B;margin-bottom:6px">고아 ID 상세 (참조되지 않은 ID 목록)</div>${orphanDetail}</div>`
        : traceTable,
    });
  }

  // Consistency
  if (consistency.length > 0) {
    sections.push({
      id: "consistency",
      title: `${num()}. 일관성 점검 결과 (Consistency Findings)`,
      body: `<ul style="margin:0;padding:0;list-style:none">${consistency.map((f) => `
        <li style="padding:8px 10px;border-left:3px solid ${f.severity === "error" ? "#DC2626" : f.severity === "warning" ? "#D97706" : "#64748B"};background:#F8FAFC;margin-bottom:6px;border-radius:0 3px 3px 0">
          <div style="display:flex;gap:10px;align-items:baseline;margin-bottom:3px">
            <span style="font-family:${FONT_MONO};font-size:10px;text-transform:uppercase;color:${f.severity === "error" ? "#DC2626" : f.severity === "warning" ? "#D97706" : "#64748B"};font-weight:700">[${esc(f.severity)}]</span>
            <span style="font-family:${FONT_MONO};font-size:11px;color:#475569">${esc(f.kind)}</span>
          </div>
          <div style="color:#0F172A;font-size:12px;margin-bottom:4px">${esc(f.description)}</div>
          <div style="color:#64748B;font-size:11px;font-family:${FONT_MONO}">아티팩트: ${esc((f.relatedArtifacts || []).join(", "))}</div>
        </li>
      `).join("")}</ul>`,
    });
  }

  // Coverage
  if (coverage && coverage.totalRequirements > 0) {
    sections.push({
      id: "coverage",
      title: `${num()}. 요구사항 → 테스트 커버리지 (Coverage)`,
      body: `
        <div style="font-size:14px;color:#0F172A;margin-bottom:8px">
          커버된 요구사항 <strong>${coverage.coveredCount}</strong> / ${coverage.totalRequirements}
          <span style="margin-left:12px;font-family:${FONT_MONO};font-weight:700;color:${coverageColor(coverage.coveragePercent)}">${coverage.coveragePercent}%</span>
        </div>
        ${coverage.uncovered?.length ? `
          <div style="margin-top:8px;padding:10px 12px;border:1px solid #FECACA;background:#FEF2F2;border-radius:4px;font-size:11px">
            <div style="color:#991B1B;font-weight:700;margin-bottom:4px;font-family:${FONT_MONO};letter-spacing:0.05em">미커버 요구사항 (${coverage.uncovered.length})</div>
            <div style="font-family:${FONT_MONO};color:#7F1D1D;line-height:1.65">${esc(coverage.uncovered.slice(0, 80).join(", "))}${coverage.uncovered.length > 80 ? ` … 외 ${coverage.uncovered.length - 80}건` : ""}</div>
          </div>
        ` : ""}
      `,
    });
  }

  // Change propagation
  if (changes && changes.summary?.total > 0) {
    sections.push({
      id: "changes",
      title: `${num()}. 변경 전파 (SUP.10 Change Propagation)`,
      body: `
        <div style="font-size:12px;color:#475569;margin-bottom:10px">
          총 <strong>${changes.summary.total}</strong>건 · 전파됨 ${changes.summary.propagated} · 검증만 ${changes.summary.verificationOnly} · 미해결 ${changes.summary.unresolved}
        </div>
        ${tableHtml(
          ["CR ID", "상태", "영향 산출물 수", "관련 산출물"],
          (changes.report || []).map((r) => [
            `<span style="font-family:${FONT_MONO};font-weight:700">${esc(r.crId)}</span>`,
            statusBadgeHtml(r.status),
            String(r.impactedArtifactCount),
            `<span style="color:#64748B;font-size:11px">${esc((r.artifacts || []).join(", ") || "—")}</span>`,
          ]),
          [null, "center", "center", null],
        )}
      `,
    });
  }

  return sections;
}

function kpi(label, value, valueColor = "#0F172A") {
  return `
    <div style="border:1px solid #E2E8F0;border-radius:5px;padding:10px 12px;background:#FFFFFF">
      <div style="font-family:${FONT_MONO};font-size:9px;color:#64748B;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px">${esc(label)}</div>
      <div style="font-size:22px;font-weight:800;color:${valueColor};letter-spacing:-0.02em;line-height:1.1">${value}</div>
    </div>
  `;
}

function coverageColor(pct) {
  if (pct == null) return "#0F172A";
  if (pct >= 85) return "#059669";
  if (pct >= 50) return "#D97706";
  return "#DC2626";
}

function statusBadgeHtml(status) {
  const color = status === "propagated" ? "#059669" : status === "verification-only" ? "#D97706" : "#DC2626";
  return `<span style="display:inline-block;padding:1px 7px;font-size:9px;font-family:${FONT_MONO};border-radius:3px;background:${color}22;color:${color};text-transform:uppercase;letter-spacing:0.06em;font-weight:700">${esc(status)}</span>`;
}

function summarizeBp(b) {
  const gaps = (b.gaps || [])
    .map((g) => condenseGapShared(g, { maxLen: 80 }))
    .filter(Boolean);
  if (gaps.length) return `개선 필요 — ${gaps.slice(0, 2).join(" / ")}`;
  if (["F", "L+", "L-"].includes(b.rating)) return "특이 약점 없음";
  return "개선 필요 — 평가 근거 미확보";
}

function summarizeGp(g) {
  const gaps = (g.gaps || [])
    .map((x) => condenseGapShared(x, { maxLen: 80 }))
    .filter(Boolean);
  if (gaps.length) return `개선 필요 — ${gaps.slice(0, 2).join(" / ")}`;
  if (["F", "L+", "L-"].includes(g.rating)) return "특이 약점 없음";
  return "개선 필요 — 평가 근거 미확보";
}

function tableHtml(headers, rows, aligns = []) {
  const th = headers.map((h, i) => {
    const a = aligns[i] === "center" ? "text-align:center;" : "";
    return `<th style="padding:6px 10px;color:#475569;font-size:9.5px;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #CBD5E1;${a}">${esc(h)}</th>`;
  }).join("");
  const trs = rows.map((row) => {
    const tds = row.map((c, i) => {
      const a = aligns[i] === "center" ? "text-align:center;" : "";
      return `<td style="padding:6px 10px;color:#0F172A;font-size:11.5px;border-bottom:1px solid #E2E8F0;${a}">${c}</td>`;
    }).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;font-family:${FONT_SANS};border-top:1px solid #0F172A"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function buildContentBodyHtml(sections) {
  return `
    <div style="${baseSectionPad}padding-top:24px;padding-bottom:24px">
      ${sections.map((s) => `
        <div data-pdf-section="${esc(s.id)}">
          <h2 style="font-size:18px;color:#0F172A;letter-spacing:-0.01em;margin:24px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #0F172A;font-weight:700">${esc(s.title)}</h2>
          ${s.body}
        </div>
      `).join("")}
    </div>
  `;
}

async function captureToCanvas(htmlNode) {
  return captureToPngCanvas(htmlNode, { windowWidth: CAPTURE_W_PX });
}

// jsPDF 기본 폰트(Helvetica)는 한글을 못 그려서 mojibake 가 된다.
// 한글 폰트 임베딩은 파일 크기 부담이 크니, 헤더/푸터는 ASCII 만 사용한다.
const SECTION_LABEL_ASCII = { toc: "TOC", body: "BODY" };

function drawHeaderFooter(pdf, { sectionKey, pageIndex, pageCount }) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  // Header
  pdf.setFillColor(248, 248, 250);
  pdf.rect(0, 0, pw, HEADER_H_MM, "F");
  pdf.setDrawColor(180, 180, 188);
  pdf.setLineWidth(0.3);
  pdf.line(0, HEADER_H_MM, pw, HEADER_H_MM);
  pdf.setTextColor(10, 10, 12);
  pdf.setFontSize(9);
  pdf.text(`ASPICE 4.0 PROJECT REPORT  ·  ${SECTION_LABEL_ASCII[sectionKey] || ""}`, SIDE_MM, 8);
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 100, 110);
  pdf.text(formatDateAscii(), pw - SIDE_MM, 8, { align: "right" });
  // Footer
  pdf.setFontSize(7);
  pdf.setTextColor(120, 120, 130);
  pdf.text("Automotive SPICE(R) VDA QMC  ·  ASPICE Workbench", pw / 2, ph - 4, { align: "center" });
  pdf.text(`${pageIndex} / ${pageCount}`, pw - SIDE_MM, ph - 4, { align: "right" });
}

function formatDateAscii() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 큰 캔버스를 페이지 높이에 맞게 잘라 PDF에 페이지 단위로 추가한다.
// 호출 시점의 PDF 마지막 페이지 번호 다음부터 새 페이지가 추가된다 (항상 addPage 호출).
// sectionMarkers 의 srcY 위치를 추적해 어느 페이지에서 섹션이 시작되는지 기록한다.
function paginateContent(pdf, canvas, sectionMarkers, startingPageIndex) {
  const pxPerMm = canvas.width / CONTENT_W_MM;
  const pageHeightPx = Math.floor(CONTENT_H_MM * pxPerMm);
  const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));
  let cursor = 0;
  let pageIdx = startingPageIndex;
  const sectionPageStarts = new Map();
  for (let i = 0; i < totalPages; i++) {
    pdf.addPage();
    const srcH = Math.min(pageHeightPx, canvas.height - cursor);
    sliceCanvasToPdfPage(pdf, canvas, {
      srcY: cursor, srcH,
      dstX: SIDE_MM, dstY: CONTENT_TOP_MM, dstW: CONTENT_W_MM, dstH: srcH / pxPerMm,
    });
    for (const sec of sectionMarkers) {
      if (!sectionPageStarts.has(sec.id) && sec.srcY >= cursor && sec.srcY < cursor + srcH) {
        sectionPageStarts.set(sec.id, pageIdx);
      }
    }
    cursor += srcH;
    pageIdx++;
  }
  for (const sec of sectionMarkers) {
    if (!sectionPageStarts.has(sec.id)) sectionPageStarts.set(sec.id, pageIdx - 1);
  }
  return { sectionPageStarts, pagesAdded: totalPages };
}

export async function exportProjectReportAsPdf({ verdict, entry }) {
  if (!verdict) throw new Error("verdict required");

  const stage = offscreenStage();
  try {
    const sections = reportContentHtml(verdict, entry);
    const sectionDescriptors = sections.map((s) => ({ id: s.id, title: s.title }));

    // Step 1: render content offscreen → measure section markers
    stage.innerHTML = buildContentBodyHtml(sections);
    // wait one frame so layout settles
    await new Promise((r) => requestAnimationFrame(r));
    const markers = sectionDescriptors.map((s) => {
      const el = stage.querySelector(`[data-pdf-section="${s.id}"]`);
      const srcY = el ? el.offsetTop : 0;
      return { id: s.id, title: s.title, srcY };
    });
    const contentCanvas = await captureToCanvas(stage);
    // markers' srcY is in CSS px of the offscreen DOM; canvas captured at scale=2 → multiply
    const scaleY = contentCanvas.height / stage.scrollHeight;
    const markersOnCanvas = markers.map((m) => ({ ...m, srcY: Math.round(m.srcY * scaleY) }));

    // Step 2: render cover offscreen → canvas
    stage.innerHTML = coverHtml({ entry, verdict });
    await new Promise((r) => requestAnimationFrame(r));
    const coverCanvas = await captureToCanvas(stage);

    // Step 3: PDF assembly.
    //   1. Cover on page 1
    //   2. Render content as pages 2..N (track each section's page)
    //   3. Build TOC with page numbers shifted by +1 (TOC will be inserted at p2)
    //   4. insertPage(2) — content shifts to 3..N+1, TOC lands on p2
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.addImage(coverCanvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_W_MM, PAGE_H_MM);

    // Content occupies pages starting at 2 (will become 3 after TOC insertion).
    const contentStartBeforeShift = 2;
    const { sectionPageStarts } = paginateContent(
      pdf,
      contentCanvas,
      markersOnCanvas,
      contentStartBeforeShift,
    );

    // Build TOC content using post-shift page numbers (each content page +1).
    const tocSections = sectionDescriptors.map((s) => ({
      title: s.title,
      page: (sectionPageStarts.get(s.id) ?? contentStartBeforeShift) + 1,
    }));
    stage.innerHTML = tocHtml(tocSections);
    await new Promise((r) => requestAnimationFrame(r));
    const tocCanvas = await captureToCanvas(stage);

    // Insert blank page 2 and paint TOC onto it.
    pdf.insertPage(2);
    pdf.setPage(2);
    pdf.addImage(tocCanvas.toDataURL("image/png"), "PNG", 0, 0, PAGE_W_MM, PAGE_H_MM);
    const tocPageIndex = 2;

    // Header/footer on pages 2.. (cover keeps its own design).
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      pdf.setPage(i);
      drawHeaderFooter(pdf, {
        sectionKey: i === tocPageIndex ? "toc" : "body",
        pageIndex: i,
        pageCount: totalPages,
      });
    }

    const procIds = (entry?.processIds || (verdict?.processes || []).map((p) => p.processId)).join("-").slice(0, 40);
    pdf.save(`ASPICE_Project_${procIds || "report"}_${Date.now()}.pdf`);
    return { ok: true, pages: totalPages };
  } finally {
    stage.remove();
  }
}
