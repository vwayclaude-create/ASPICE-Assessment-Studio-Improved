// 도움말(HelpModal) 사용자 가이드를 모드별 PDF로 내보낸다.
//   exportHelpGuideAsPdf({ mode: "process" | "project" })
// 화면용 컴포넌트(HelpModal)는 다크 테마라 인쇄에 부적합하므로, PDF 전용
// 정적 HTML을 오프스크린에 렌더 → html2canvas로 캡처 → A4 세로 페이지로
// 슬라이스 → 각 페이지 하단에 disclaimer 도장을 찍는다(exportReport.js와 동일 패턴).
import jsPDF from "jspdf";
import { captureToPngCanvas, sliceCanvasToPdfPage } from "./pdfPaginator";

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const SIDE_MM = 12;
const HEADER_H_MM = 14;
const FOOTER_H_MM = 12;
const CONTENT_W_MM = PAGE_W_MM - SIDE_MM * 2;
const CONTENT_TOP_MM = HEADER_H_MM + 4;
const CONTENT_BOT_MM = PAGE_H_MM - FOOTER_H_MM - 2;
const CONTENT_H_MM = CONTENT_BOT_MM - CONTENT_TOP_MM;

// 세로 A4 컨텐츠 영역(186mm) ≈ 740px @ ~96dpi.
const CAPTURE_W_PX = 740;

const FONT_SANS = "'Inter', 'Noto Sans KR', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'D2Coding', monospace";

const DISCLAIMER_TEXT = "주의 : 본 진단 및 평가 결과는 비공식 갭 진단이며, iNTACS 공식 평가를 대체하지 않으며, 심사 또는 평가 근거로 사용되지 않습니다.";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

const MODE_META = {
  process: {
    title: "프로세스 모드 사용 가이드",
    fileSlug: "process_mode",
    headerLabel: "PROCESS MODE GUIDE",
  },
  project: {
    title: "프로젝트 모드 사용 가이드",
    fileSlug: "project_mode",
    headerLabel: "PROJECT MODE GUIDE",
  },
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

const sectionTitleHtml = (text) => `
  <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#2563EB;font-weight:700;margin:22px 0 10px">${esc(text)}</div>
`;

const calloutHtml = (innerHtml) => `
  <div style="font-size:12px;color:#334155;line-height:1.7;background:#EFF6FF;border:1px solid #BFDBFE;border-left:3px solid #2563EB;padding:11px 14px;border-radius:4px;margin-bottom:6px">
    ${innerHtml}
  </div>
`;

const tipHtml = (innerHtml) => `
  <div style="margin-top:12px;padding:11px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:5px;font-size:11px;color:#334155;line-height:1.65">
    <strong style="color:#0F172A">Tip.</strong> ${innerHtml}
  </div>
`;

const stepHtml = (n, title, bodyHtml) => `
  <div style="display:grid;grid-template-columns:34px 1fr;gap:14px;padding:13px 0;border-bottom:1px solid #E2E8F0">
    <div style="width:30px;height:30px;border-radius:5px;background:#EFF6FF;border:1px solid #BFDBFE;color:#1D4ED8;display:flex;align-items:center;justify-content:center;font-family:${FONT_MONO};font-size:12px;font-weight:800">${n}</div>
    <div>
      <div style="font-size:13px;font-weight:700;color:#0F172A;margin-bottom:5px">${esc(title)}</div>
      <div style="font-size:12px;color:#334155;line-height:1.7">${bodyHtml}</div>
    </div>
  </div>
`;

const code = (s) => `<code style="font-family:${FONT_MONO};color:#1D4ED8;background:#EFF6FF;padding:1px 5px;border-radius:3px;font-size:10.5px">${esc(s)}</code>`;
const hi = (s) => `<strong style="color:#0F172A">${esc(s)}</strong>`;

const overviewHtml = () => `
  ${sectionTitleHtml("개요")}
  <div style="font-size:12px;color:#334155;line-height:1.75">
    본 스튜디오는 ${hi("VDA Automotive SPICE® 4.0")} 기준에 따라 산출물을 자동 진단합니다.
    두 가지 평가 모드를 제공합니다 — ${hi("프로세스 모드")}(단일 프로세스 · 단일 문서)와
    ${hi("프로젝트 모드")}(다중 프로세스 · 다중 산출물 · Cross-process 검증).
  </div>
`;

const processSectionHtml = () => `
  ${sectionTitleHtml("프로세스 모드 — 진행 단계")}
  ${stepHtml(1, "프로세스 선택", `
    좌측 사이드바에서 평가할 ASPICE 프로세스(예: ${code("SYS.2")}, ${code("SWE.3")})를 고릅니다.
    파일명에 프로세스 ID가 포함되어 있으면 업로드 시 자동 감지·선택됩니다.
    그룹 헤더(▸)를 클릭하면 접었다 펼칠 수 있습니다.
  `)}
  ${stepHtml(2, "산출물 업로드", `
    지원 형식: ${hi("PDF · DOC · DOCX · XLSX · MD")}, 최대 ${hi("30MB")}.
    실제 문서가 없으면 ${hi("\"Sample Report\"")}로 예시 결과를 먼저 볼 수 있습니다.
  `)}
  ${stepHtml(3, "분석 실행", `
    ${hi("\"Run Assessment\"")}를 누르면 확인 창이 뜨고,
    각 BP별 ${hi("N·P·L·F")} 등급과 근거가 산출됩니다.
    문서 크기에 따라 수십 초가 걸릴 수 있습니다.
  `)}
  ${stepHtml(4, "결과 확인 및 내보내기", `
    BP별 판정·근거·개선 제안이 평가 리포트에 표시됩니다.
    ${hi("PDF")} · ${hi("TXT")}로 저장 가능합니다.
  `)}
  ${stepHtml(5, "이력 관리", `
    실행된 분석은 자동 저장됩니다. 이력 항목을 클릭하면 이전 결과를 다시 열어볼 수 있고, 개별/전체 삭제도 가능합니다.
  `)}
`;

const projectSectionHtml = () => `
  ${sectionTitleHtml("프로젝트 모드 — 다중 프로세스 평가")}
  ${calloutHtml(`
    ${hi("프로젝트 모드")}는 여러 산출물(요구사항·아키텍처·테스트·CR 등)을 한 번에 올려
    여러 프로세스를 동시에 평가하고, ${hi("프로세스 간 연결성")}까지 자동 점검합니다.
    CL1 개별 BP 평가를 넘어 프로젝트 전체의 일관성을 확인할 때 사용하세요.
  `)}
  ${stepHtml(1, "여러 산출물 업로드", `
    상단 탭에서 ${hi("\"프로젝트 모드\"")}를 선택한 뒤,
    증적 파일을 ${hi("여러 개 한꺼번에")} 선택합니다.
    예) 이해관계자 요구사항, 시스템 요구사항, SW 요구사항, 아키텍처 설계, 테스트 케이스, 변경요청.
    파일마다 ${code("REQ-001")}, ${code("ARCH-SYS-002")}, ${code("TC-001")} 같은 ID가 포함돼 있으면 트레이스 매트릭스가 더 정확해집니다.
  `)}
  ${stepHtml(2, "대상 프로세스 선택", `
    기본 선택: ${code("SYS.1")} ${code("SYS.2")} ${code("SYS.3")} ${code("SWE.1")} ${code("SYS.5")} ${code("SUP.10")}.
    필요에 따라 ${hi("\"전체\"")}로 모두 선택하거나 프로세스별로 토글할 수 있습니다.
    선택한 각 프로세스에 대해 BP/WP/PA 평가가 수행됩니다.
  `)}
  ${stepHtml(3, "목표 Capability Level 및 Scorer 선택", `
    ${hi("CL1")}은 기본 수행, ${hi("CL2")}는 관리, ${hi("CL3")}는 확립된 프로세스입니다.
    엔진은 ${code("Rule")}(오프라인 키워드/WPID 매칭 · 무료 · 빠름), ${code("LLM")}(OpenAI — BP/WP/GP별 호출),
    ${code("Hybrid")}(0.4 rule + 0.6 llm, 권장), ${code("Custom")}(직접 만든 룰로 평가 · 무료) 중 선택합니다.
    LLM/Hybrid는 서버에 ${code("OPENAI_API_KEY")}가 설정돼 있어야 합니다.
    ${code("Custom")} 선택 시 ${hi("\"평가 룰 편집\"")}에서 키워드 룰을 추가·편집·제외할 수 있으며,
    룰이 없는 항목은 자동 키워드 폴백으로 평가됩니다.
  `)}
  ${stepHtml(4, "Cross-process 검증 결과", `
    평가가 끝나면 다음 6가지 뷰가 리포트에 표시됩니다.
    <ul style="margin:6px 0 0 18px;padding:0;color:#334155;line-height:1.75">
      <li>${hi("Capability Summary")} — 프로세스별 CL과 PA 1.1/2.1/2.2/3.1/3.2 평가.</li>
      <li>${hi("Traceability Matrix")} — V-모델 seed 엣지 기반 상·하위 프로세스 간 ID 커버리지.</li>
      <li>${hi("Consistency Findings")} — 산출물 간 용어·ID·상태 불일치.</li>
      <li>${hi("Requirement → Test Coverage")} — 요구사항별 테스트 매핑 및 미커버 ID.</li>
      <li>${hi("Change Propagation (SUP.10)")} — CR이 요구사항·설계·테스트에 모두 반영됐는지.</li>
      <li>${hi("Process Graph")} — 노드/엣지 수와 엣지 소스(seed / heuristic).</li>
    </ul>
  `)}
  ${tipHtml(`
    파일명에 프로세스 카테고리를 넣으면(${code("sys2_req.pdf")}, ${code("swe3_arch.docx")}) WP 후보 추론이 더 잘 됩니다.
    일부 PDF 파일이 손상되어 파싱에 실패해도, 나머지 산출물들로 평가가 계속 진행됩니다.
    실패한 파일 목록은 리포트 헤더 상단에 경고로 표시됩니다.
  `)}

  ${sectionTitleHtml("CUSTOM 엔진 — 사용자 룰 사용법")}
  ${calloutHtml(`
    ${hi("Custom 엔진")}은 LLM 호출 없이도
    ${hi("사용자가 직접 정의한 키워드/WPID 룰")}로 BP·WP·GP를 평가합니다.
    프로젝트 고유의 용어, 사내 산출물 ID 체계(예: ${code("PRJ-REQ-001")}),
    팀별 평가 기준을 반영하고 싶을 때 사용하세요. ${hi("API 키 불필요 · 오프라인 · 무료")}.
  `)}
  ${stepHtml(1, "① 엔진을 Custom으로 전환", `
    프로젝트 모드 카드의 ${hi("Engine")}에서 ${code("Custom")}을 선택하면
    ${hi("\"평가 룰 편집\"")} 버튼이 활성화됩니다. 이 버튼을 눌러 룰 편집 모달을 엽니다.
  `)}
  ${stepHtml(2, "② 키워드 룰 추가하기", `
    ${hi("\"키워드 룰\"")} 탭에서 "룰 추가"를 누르고 다음 항목을 채웁니다.
    <ul style="margin:6px 0 0 18px;padding:0;color:#334155;line-height:1.85">
      <li>${hi("룰 이름")} — 예) ${code("요구사항 추적성 ID")}, ${code("리뷰 회의록 존재")}</li>
      <li>${hi("적용 단위")} — ${code("BP")} / ${code("WP")} / ${code("GP")} / ${code("전체")}. 어느 평가 항목에 룰을 걸지 결정합니다.</li>
      <li>${hi("대상 프로세스")} — ${code("모든 프로세스")} 또는 ${code("SYS.2")}처럼 특정 프로세스에만 적용.</li>
      <li>${hi("키워드 / WPID")} — 쉼표로 구분하여 여러 개 입력. 예) ${code("traceability, 추적성, 17-50")}. WP ID(예: ${code("17-50")})도 그대로 키워드로 인식됩니다.</li>
      <li>${hi("충족 조건")} — ${code("1개라도 발견")}(느슨함) / ${code("모든 키워드 발견")}(엄격함).</li>
      <li>${hi("가중치 (0.1 – 5)")} — 룰이 충족됐을 때 점수에 기여하는 비중. 중요한 룰일수록 큰 값.</li>
    </ul>
    <div style="margin-top:8px;color:#64748B;font-size:11px">점수 산식: ${code("점수 = Σ(충족된 룰 가중치) ÷ Σ(적용된 룰 가중치)")} — 결과를 N·P·L·F로 매핑.</div>
  `)}
  ${stepHtml(3, "③ 사용자 정의 BP 만들기 (선택)", `
    ${hi("\"사용자 정의 BP\"")} 탭에서는 PAM에 없는 ${hi("추가 Base Practice")}를 만들 수 있습니다.
    예) ${code("SYS.2.BPx — 변경요청 회의록 작성")}. 선택한 프로세스의 BP 목록 끝에 추가되어
    ${hi("PA 1.1 평균에 함께 반영")}됩니다.
    BP 자체에 키워드/충족 조건/가중치를 정의하므로 별도의 룰이 없어도 점수가 매겨집니다.
  `)}
  ${stepHtml(4, "④ 자동 키워드 폴백 (중요)", `
    ${hi("\"자동 키워드 폴백 사용\"")}이 켜져 있으면, 어떤 사용자 룰도 적용되지 않는 BP/WP/GP는
    ${hi("오프라인 PAM 자동 키워드")}로 평가됩니다(= Rule 엔진과 동일).
    끄면 ${hi("룰이 없는 항목은 모두 0점")}으로 처리되니,
    처음에는 켠 채로 일부 항목만 사용자 룰로 덮어쓰는 방식을 권장합니다.
  `)}
  ${stepHtml(5, "⑤ 룰 책 내보내기 · 불러오기 · 복원", `
    모달 하단에서 전체 룰 묶음을 ${code("JSON")}으로 ${hi("내보내기")} · ${hi("불러오기")}할 수 있습니다.
    팀원과 공유하거나 프로젝트별로 다른 룰 셋을 운용할 때 유용합니다.
    ${hi("\"기본값 복원\"")}은 샘플 룰로 되돌립니다(작성한 룰은 사라집니다).
  `)}
  ${tipHtml(`
    <strong style="color:#0F172A">활용 예시.</strong> ① 사내 산출물 ID 체계(${code("ACME-REQ-*")})를 키워드로 등록해
    "추적성 ID 명시" 룰을 BP에 걸어두면, 해당 ID가 들어간 문서만 합격으로 인정됩니다.
    ② Hybrid의 정확도는 원하지만 LLM 비용이 부담될 때, Hybrid로 일부 프로세스만 평가하고
    나머지는 Custom + 사용자 룰로 운영할 수 있습니다.
  `)}

  ${sectionTitleHtml("추적성 매트릭스 & 요구사항 → 테스트 커버리지")}
  ${calloutHtml(`
    ASPICE의 핵심은 ${hi("\"요구사항 → 설계 → 테스트\"")}가
    ID 수준에서 양방향으로 연결되어 있는지 확인하는 것입니다.
    본 도구는 이를 두 가지 관점에서 자동 계산합니다 —
    ${hi("추적성 매트릭스")}(프로세스 간 ID 흐름)와
    ${hi("요구사항 → 테스트 커버리지")}(전체 요구사항 중 테스트가 존재하는 비율).
  `)}
  ${stepHtml(1, "추적성 매트릭스 (Traceability Matrix)란?", `
    V-모델의 ${hi("인접한 프로세스 쌍")}마다 한 장씩 매트릭스를 만듭니다.
    예) ${code("SYS.1 → SYS.2")}, ${code("SYS.2 → SWE.1")}, ${code("SWE.1 → SWE.4")} …
    각 매트릭스는 ${hi("상위(Source) 산출물에서 추출된 요구사항 ID")}가
    ${hi("하위(Target) 산출물에 얼마나 인용됐는지")}를 보여줍니다.
    <div style="margin-top:6px;color:#64748B;font-size:11px">
      연결 규칙은 ${code("spec/canonical/processGraph.json")}의 V-모델 seed 엣지에서 가져오며,
      엣지 없는 프로세스 쌍은 매트릭스가 만들어지지 않습니다.
    </div>
  `)}
  ${stepHtml(2, "어떤 ID가 카운트되나?", `
    매트릭스는 ${hi("\"개발 요구사항 ID\"")}만 분모로 셉니다 —
    ${code("REQ-*")}, ${code("SR-*")}, ${code("FR-*")} / ${code("FUNC-*")}(기능),
    ${code("NFR-*")} / ${code("NF-*")}(비기능), ${code("IFR-*")} / ${code("IF-*")} / ${code("INTF-*")}(인터페이스).
    ${hi("시퀀스/버전/테스트 ID")}(${code("SEQ-*")}, ${code("VER-*")}, ${code("TC-*")} 등)는 의도적으로 제외해서
    "문서에 우연히 나타난 식별자"가 분모를 부풀리지 않도록 합니다.
    <div style="margin-top:6px;color:#64748B;font-size:11px">
      <strong style="color:#475569">커버리지 % =</strong> 하위 산출물 어딘가에 그 ID 문자열이 등장한
      상위 ID 개수 ÷ 상위 ID 전체 개수 × 100. 인용되지 않은 ID는 <strong style="color:#475569">orphan</strong>으로 표시됩니다.
    </div>
  `)}
  ${stepHtml(3, "요구사항 → 테스트 커버리지", `
    ${hi("요구사항 산출물")}(WP ${code("17-00")}, ${code("17-05")}, ${code("17-54")}, ${code("17-55")}, ${code("17-57")})에서 추출한
    모든 요구사항 ID 중에서, ${hi("테스트 산출물")}(WP ${code("08-60")}, ${code("08-59")}, ${code("08-58")}, ${code("08-57")},
    ${code("15-52")}, ${code("13-24")}, ${code("13-25")}, ${code("03-50")})의 본문에 등장하는 비율을 계산합니다.
    <ul style="margin:6px 0 0 18px;padding:0;color:#334155;line-height:1.85">
      <li>${hi("Total requirements")} — 요구사항 산출물에서 찾아낸 고유 요구사항 ID 수.</li>
      <li>${hi("Covered")} — 테스트 산출물 본문에 그 ID 문자열이 등장한 개수.</li>
      <li>${hi("Uncovered ID 목록")} — 테스트가 없는 요구사항. 그대로 갭 보완 작업 리스트로 활용 가능.</li>
    </ul>
    <div style="margin-top:6px;color:#64748B;font-size:11px">
      매트릭스 범위(REQ/SR/FR/NFR/IFR)에 더해 ${code("SYS-*")}, ${code("SW-*")}, ${code("HW-*")}, ${code("ML-*")},
      ${code("SRS-*")} 같은 도메인/문서 접두어까지 인정합니다(커버리지는 더 넓은 분모를 사용).
    </div>
  `)}
  ${tipHtml(`
    <strong style="color:#0F172A">점수를 올리는 가장 쉬운 방법.</strong>
    ① 모든 요구사항·설계·테스트 문서가 ${hi("같은 ID 표기")}를 사용하도록 통일합니다(예: 항상 ${code("SR-001")} 형식).
    ② 하위 산출물에 상위 ID를 ${hi("본문 어디든 한 번이라도")} 인용합니다(표·각주·코멘트 모두 인정).
    ③ 파일명에 프로세스 ID(${code("sys2_")}, ${code("swe1_")})와 WP ID(${code("17-50")})를 포함해 자동 분류 정확도를 높입니다.
  `)}
`;

const nplfSectionHtml = () => {
  const grade = (codeStr, label, range, color) => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:5px">
      <span style="width:30px;height:30px;border-radius:4px;background:${color};color:#FFFFFF;font-family:${FONT_MONO};font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center">${codeStr}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:#0F172A">${esc(label)}</div>
        <div style="font-family:${FONT_MONO};font-size:10px;color:#64748B;margin-top:1px">${esc(range)}</div>
      </div>
    </div>
  `;
  return `
    ${sectionTitleHtml("NPLF 등급 (ISO/IEC 33020)")}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
      ${grade("N", "Not achieved", "0 – 15%", "#DC2626")}
      ${grade("P", "Partially achieved", "16 – 50%", "#D97706")}
      ${grade("L", "Largely achieved", "51 – 85%", "#2563EB")}
      ${grade("F", "Fully achieved", "86 – 100%", "#059669")}
    </div>
  `;
};

const titleBlockHtml = (mode) => {
  const meta = MODE_META[mode];
  const dateStr = (() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();
  return `
    <div style="border-bottom:1.5px solid #0F172A;padding-bottom:14px;margin-bottom:6px">
      <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#2563EB;font-weight:500;margin-bottom:5px">User Guide · 사용 가이드</div>
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0F172A;line-height:1.2">
        Automotive <span style="font-weight:300;color:#2563EB">SPICE</span> Assessment Studio
      </div>
      <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:baseline;color:#475569;font-size:12px">
        <div style="font-weight:600;color:#0F172A">${esc(meta.title)}</div>
        <div style="font-family:${FONT_MONO};font-size:10px;color:#64748B">${esc(dateStr)}</div>
      </div>
    </div>
  `;
};

const guideBodyHtml = (mode) => `
  <div style="padding:18px 22px 22px;box-sizing:border-box;width:${CAPTURE_W_PX}px">
    ${titleBlockHtml(mode)}
    ${overviewHtml()}
    ${mode === "process" ? processSectionHtml() : projectSectionHtml()}
    ${nplfSectionHtml()}
  </div>
`;

async function captureDisclaimerImage() {
  const stage = document.createElement("div");
  stage.style.cssText = `
    position: fixed;
    left: -99999px;
    top: 0;
    width: 1100px;
    padding: 4px 12px;
    background: #FFFFFF;
    font-family: ${FONT_SANS};
    font-size: 11px;
    color: #6B7280;
    text-align: center;
    letter-spacing: -0.005em;
    line-height: 1.35;
  `;
  stage.textContent = DISCLAIMER_TEXT;
  document.body.appendChild(stage);
  try {
    return await captureToPngCanvas(stage);
  } finally {
    stage.remove();
  }
}

function drawHeader(pdf, mode, pageIndex, pageCount) {
  const meta = MODE_META[mode];
  const pw = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(248, 248, 250);
  pdf.rect(0, 0, pw, HEADER_H_MM, "F");
  pdf.setDrawColor(180, 180, 188);
  pdf.setLineWidth(0.3);
  pdf.line(0, HEADER_H_MM, pw, HEADER_H_MM);
  pdf.setTextColor(10, 10, 12);
  pdf.setFontSize(9);
  pdf.text(`ASPICE 4.0 USER GUIDE  ·  ${meta.headerLabel}`, SIDE_MM, 9);
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 100, 110);
  pdf.text(`${pageIndex} / ${pageCount}`, pw - SIDE_MM, 9, { align: "right" });
}

export async function exportHelpGuideAsPdf({ mode }) {
  const key = mode === "project" ? "project" : "process";
  const meta = MODE_META[key];

  const stage = offscreenStage();
  let pdf;
  try {
    stage.innerHTML = guideBodyHtml(key);
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = await captureToPngCanvas(stage, { windowWidth: CAPTURE_W_PX });
    const disclaimerCanvas = await captureDisclaimerImage();

    pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pxPerMm = canvas.width / CONTENT_W_MM;
    const pageHeightPx = Math.floor(CONTENT_H_MM * pxPerMm);
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    let cursor = 0;
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage();
      const srcH = Math.min(pageHeightPx, canvas.height - cursor);
      sliceCanvasToPdfPage(pdf, canvas, {
        srcY: cursor,
        srcH,
        dstX: SIDE_MM,
        dstY: CONTENT_TOP_MM,
        dstW: CONTENT_W_MM,
        dstH: srcH / pxPerMm,
      });
      cursor += srcH;
    }

    const disclaimerImg = disclaimerCanvas.toDataURL("image/png");
    const disclaimerWMm = PAGE_W_MM - SIDE_MM * 2;
    const disclaimerHMm = (disclaimerCanvas.height * disclaimerWMm) / disclaimerCanvas.width;
    const pc = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
      pdf.setPage(i);
      drawHeader(pdf, key, i, pc);
      pdf.addImage(
        disclaimerImg,
        "PNG",
        SIDE_MM,
        pageHeight - 4 - disclaimerHMm - 1.2,
        disclaimerWMm,
        disclaimerHMm,
      );
      pdf.setFontSize(7);
      pdf.setTextColor(120, 120, 130);
      pdf.text(
        `Automotive SPICE® VDA QMC · ASPICE Workbench  ·  ${i}/${pc}`,
        PAGE_W_MM / 2,
        pageHeight - 4,
        { align: "center" },
      );
    }

    pdf.save(`ASPICE_UserGuide_${meta.fileSlug}_${Date.now()}.pdf`);
    return { ok: true, pages: pc };
  } finally {
    stage.remove();
  }
}
