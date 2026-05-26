import { X, Upload, FolderTree, Play, FileText, History, Lightbulb, Layers, GitBranch, Target, Sliders, Plus, ListChecks, ToggleRight, Download, Link2, CheckCheck } from "lucide-react";
import { T, FONTS } from "../theme";

const SectionTitle = ({ children }) => (
  <div style={{
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: T.accent,
    fontWeight: 700,
    marginBottom: 10,
  }}>{children}</div>
);

const Step = ({ n, Icon, title, children }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 18,
    padding: "16px 0",
    borderBottom: `1px solid ${T.borderL}`,
  }}>
    <div style={{
      width: 42,
      height: 42,
      borderRadius: 6,
      background: T.accentSoft,
      border: `1px solid ${T.borderM}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: T.accent,
      position: "relative",
    }}>
      <Icon size={17} />
      <span style={{
        position: "absolute",
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: T.accent,
        color: T.onAccent,
        fontFamily: FONTS.mono,
        fontSize: 10,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>{n}</span>
    </div>
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.textHi, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.textMd, lineHeight: 1.7 }}>{children}</div>
    </div>
  </div>
);

const Grade = ({ code, label, range, color }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: T.surface2,
    border: `1px solid ${T.borderL}`,
    borderRadius: 5,
  }}>
    <span style={{
      width: 32,
      height: 32,
      borderRadius: 4,
      background: color,
      color: T.onAccent,
      fontFamily: FONTS.mono,
      fontWeight: 800,
      fontSize: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>{code}</span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textHi }}>{label}</div>
      <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: T.textLo, marginTop: 2 }}>{range}</div>
    </div>
  </div>
);

const Code = ({ children }) => (
  <code style={{
    fontFamily: FONTS.mono,
    color: T.accent,
    background: T.accentSoft,
    padding: "1px 5px",
    borderRadius: 3,
    fontSize: 11,
  }}>{children}</code>
);

export const HelpModal = ({ onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: T.overlay,
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: T.surface,
        border: `1px solid ${T.borderM}`,
        borderRadius: 10,
        width: "100%",
        maxWidth: 760,
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.18s ease",
        boxShadow: T.shadowLg,
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "22px 32px",
        borderBottom: `1px solid ${T.borderL}`,
      }}>
        <div>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: T.accent,
            marginBottom: 6,
            fontWeight: 500,
          }}>User Guide · 사용 가이드</div>
          <div style={{
            fontFamily: FONTS.sans,
            fontSize: 20,
            fontWeight: 700,
            color: T.textHi,
            letterSpacing: "-0.02em",
          }}>
            Automotive <span style={{ fontWeight: 300, color: T.accent }}>SPICE</span> Assessment Studio
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            background: "transparent",
            border: `1px solid ${T.borderM}`,
            color: T.textMd,
            width: 34,
            height: 34,
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: "8px 32px 24px", overflowY: "auto" }}>
        <div style={{ padding: "16px 0 6px" }}>
          <SectionTitle>개요</SectionTitle>
          <div style={{ fontSize: 13, color: T.textMd, lineHeight: 1.75 }}>
            본 스튜디오는 <strong style={{ color: T.textHi }}>VDA Automotive SPICE® 4.0</strong> 기준에 따라 산출물을 자동 진단합니다.
            두 가지 평가 모드를 제공합니다 — <strong style={{ color: T.textHi }}>프로세스 모드</strong>(단일 프로세스 · 단일 문서)와
            <strong style={{ color: T.textHi }}> 프로젝트 모드</strong>(다중 프로세스 · 다중 산출물 · Cross-process 검증).
          </div>
        </div>

        {/* Per-process mode */}
        <div style={{ paddingTop: 18 }}>
          <SectionTitle>프로세스 모드 — 진행 단계</SectionTitle>

          <Step n={1} Icon={FolderTree} title="프로세스 선택">
            좌측 사이드바에서 평가할 ASPICE 프로세스(예: <Code>SYS.2</Code>, <Code>SWE.3</Code>)를 고릅니다.
            파일명에 프로세스 ID가 포함되어 있으면 업로드 시 자동 감지·선택됩니다.
            그룹 헤더(▸)를 클릭하면 접었다 펼칠 수 있습니다.
          </Step>

          <Step n={2} Icon={Upload} title="산출물 업로드">
            지원 형식: <strong style={{ color: T.textHi }}>PDF · DOC · DOCX · XLSX · MD</strong>, 최대 <strong style={{ color: T.textHi }}>30MB</strong>.
            실제 문서가 없으면 <strong style={{ color: T.textHi }}>"Sample Report"</strong>로 예시 결과를 먼저 볼 수 있습니다.
          </Step>

          <Step n={3} Icon={Play} title="분석 실행">
            <strong style={{ color: T.textHi }}>"Run Assessment"</strong>를 누르면 확인 창이 뜨고,
            각 BP별 <strong style={{ color: T.textHi }}>N·P·L·F</strong> 등급과 근거가 산출됩니다.
            문서 크기에 따라 수십 초가 걸릴 수 있습니다.
          </Step>

          <Step n={4} Icon={FileText} title="결과 확인 및 내보내기">
            BP별 판정·근거·개선 제안이 평가 리포트에 표시됩니다.
            <strong style={{ color: T.textHi }}>PDF</strong>·<strong style={{ color: T.textHi }}>TXT</strong>로 저장 가능합니다.
          </Step>

          <Step n={5} Icon={History} title="이력 관리">
            실행된 분석은 자동 저장됩니다. 이력 항목을 클릭하면 이전 결과를 다시 열어볼 수 있고, 개별/전체 삭제도 가능합니다.
          </Step>
        </div>

        {/* Project mode */}
        <div style={{ paddingTop: 24 }}>
          <SectionTitle>프로젝트 모드 — 다중 프로세스 평가</SectionTitle>

          <div style={{
            fontSize: 13,
            color: T.textMd,
            lineHeight: 1.75,
            background: T.accentSoft,
            border: `1px solid ${T.accent}33`,
            borderLeft: `3px solid ${T.accent}`,
            padding: "12px 16px",
            borderRadius: 5,
            marginBottom: 4,
          }}>
            <strong style={{ color: T.textHi }}>프로젝트 모드</strong>는 여러 산출물(요구사항·아키텍처·테스트·CR 등)을 한 번에 올려
            여러 프로세스를 동시에 평가하고, <strong style={{ color: T.textHi }}>프로세스 간 연결성</strong>까지 자동 점검합니다.
            CL1 개별 BP 평가를 넘어 프로젝트 전체의 일관성을 확인할 때 사용하세요.
          </div>

          <Step n={1} Icon={Upload} title="여러 산출물 업로드">
            상단 탭에서 <strong style={{ color: T.textHi }}>"프로젝트 모드"</strong>를 선택한 뒤,
            증적 파일을 <strong style={{ color: T.textHi }}>여러 개 한꺼번에</strong> 선택합니다.
            예) 이해관계자 요구사항, 시스템 요구사항, SW 요구사항, 아키텍처 설계, 테스트 케이스, 변경요청.
            파일마다 <Code>REQ-001</Code>, <Code>ARCH-SYS-002</Code>, <Code>TC-001</Code> 같은 ID가 포함돼 있으면 트레이스 매트릭스가 더 정확해집니다.
          </Step>

          <Step n={2} Icon={Layers} title="대상 프로세스 선택">
            기본 선택: <Code>SYS.1</Code> <Code>SYS.2</Code> <Code>SYS.3</Code> <Code>SWE.1</Code> <Code>SYS.5</Code> <Code>SUP.10</Code>.
            필요에 따라 <strong style={{ color: T.textHi }}>"전체"</strong>로 모두 선택하거나 프로세스별로 토글할 수 있습니다.
            선택한 각 프로세스에 대해 BP/WP/PA 평가가 수행됩니다.
          </Step>

          <Step n={3} Icon={Target} title="목표 Capability Level 및 Scorer 선택">
            <strong style={{ color: T.textHi }}>CL1</strong>은 기본 수행, <strong style={{ color: T.textHi }}>CL2</strong>는 관리, <strong style={{ color: T.textHi }}>CL3</strong>는 확립된 프로세스입니다.
            엔진은 <Code>Rule</Code>(오프라인 키워드/WPID 매칭 · 무료 · 빠름), <Code>LLM</Code>(OpenAI — BP/WP/GP별 호출),
            <Code>Hybrid</Code>(0.4 rule + 0.6 llm, 권장), <Code>Custom</Code>(직접 만든 룰로 평가 · 무료) 중 선택합니다.
            LLM/Hybrid는 서버에 <Code>OPENAI_API_KEY</Code>가 설정돼 있어야 합니다.
            <Code>Custom</Code> 선택 시 <strong style={{ color: T.textHi }}>"평가 룰 편집"</strong>에서 키워드 룰을
            추가·편집·제외할 수 있으며, 룰이 없는 항목은 자동 키워드 폴백으로 평가됩니다.
          </Step>

          <Step n={4} Icon={GitBranch} title="Cross-process 검증 결과">
            평가가 끝나면 다음 6가지 뷰가 리포트에 표시됩니다.
            <ul style={{ margin: "8px 0 0 18px", padding: 0, color: T.textMd, lineHeight: 1.8 }}>
              <li><strong style={{ color: T.textHi }}>Capability Summary</strong> — 프로세스별 CL과 PA 1.1/2.1/2.2/3.1/3.2 평가.</li>
              <li><strong style={{ color: T.textHi }}>Traceability Matrix</strong> — V-모델 seed 엣지 기반 상·하위 프로세스 간 ID 커버리지.</li>
              <li><strong style={{ color: T.textHi }}>Consistency Findings</strong> — 산출물 간 용어·ID·상태 불일치.</li>
              <li><strong style={{ color: T.textHi }}>Requirement → Test Coverage</strong> — 요구사항별 테스트 매핑 및 미커버 ID.</li>
              <li><strong style={{ color: T.textHi }}>Change Propagation (SUP.10)</strong> — CR이 요구사항·설계·테스트에 모두 반영됐는지.</li>
              <li><strong style={{ color: T.textHi }}>Process Graph</strong> — 노드/엣지 수와 엣지 소스(seed / heuristic).</li>
            </ul>
          </Step>

          <div style={{
            marginTop: 14,
            padding: "14px 18px",
            background: T.surface2,
            border: `1px solid ${T.borderL}`,
            borderRadius: 6,
            display: "flex",
            gap: 12,
          }}>
            <Lightbulb size={16} color={T.warm} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: T.textMd, lineHeight: 1.7 }}>
              <strong style={{ color: T.textHi }}>Tip.</strong> 파일명에 프로세스 카테고리를 넣으면(<Code>sys2_req.pdf</Code>, <Code>swe3_arch.docx</Code>) WP 후보 추론이 더 잘 됩니다.
              일부 PDF 파일이 손상되어 파싱에 실패해도, 나머지 산출물들로 평가가 계속 진행됩니다.
              실패한 파일 목록은 리포트 헤더 상단에 경고로 표시됩니다.
            </div>
          </div>
        </div>

        {/* Custom rules — detailed */}
        <div style={{ paddingTop: 24 }}>
          <SectionTitle>CUSTOM 엔진 — 사용자 룰 사용법</SectionTitle>

          <div style={{
            fontSize: 13,
            color: T.textMd,
            lineHeight: 1.75,
            background: T.accentSoft,
            border: `1px solid ${T.accent}33`,
            borderLeft: `3px solid ${T.accent}`,
            padding: "12px 16px",
            borderRadius: 5,
            marginBottom: 4,
          }}>
            <strong style={{ color: T.textHi }}>Custom 엔진</strong>은 LLM 호출 없이도
            <strong style={{ color: T.textHi }}> 사용자가 직접 정의한 키워드/WPID 룰</strong>로 BP·WP·GP를 평가합니다.
            프로젝트 고유의 용어, 사내 산출물 ID 체계(예: <Code>PRJ-REQ-001</Code>),
            팀별 평가 기준을 반영하고 싶을 때 사용하세요. <strong style={{ color: T.textHi }}>API 키 불필요 · 오프라인 · 무료</strong>.
          </div>

          <Step n={1} Icon={Sliders} title="① 엔진을 Custom으로 전환">
            프로젝트 모드 카드의 <strong style={{ color: T.textHi }}>Engine</strong>에서 <Code>Custom</Code>을 선택하면
            <strong style={{ color: T.textHi }}> "평가 룰 편집"</strong> 버튼이 활성화됩니다. 이 버튼을 눌러 룰 편집 모달을 엽니다.
          </Step>

          <Step n={2} Icon={Plus} title="② 키워드 룰 추가하기">
            <strong style={{ color: T.textHi }}>"키워드 룰"</strong> 탭에서 "룰 추가"를 누르고 다음 항목을 채웁니다.
            <ul style={{ margin: "8px 0 0 18px", padding: 0, color: T.textMd, lineHeight: 1.85 }}>
              <li><strong style={{ color: T.textHi }}>룰 이름</strong> — 예) <Code>요구사항 추적성 ID</Code>, <Code>리뷰 회의록 존재</Code></li>
              <li><strong style={{ color: T.textHi }}>적용 단위</strong> — <Code>BP</Code> / <Code>WP</Code> / <Code>GP</Code> / <Code>전체</Code>. 어느 평가 항목에 룰을 걸지 결정합니다.</li>
              <li><strong style={{ color: T.textHi }}>대상 프로세스</strong> — <Code>모든 프로세스</Code> 또는 <Code>SYS.2</Code>처럼 특정 프로세스에만 적용.</li>
              <li><strong style={{ color: T.textHi }}>키워드 / WPID</strong> — 쉼표로 구분하여 여러 개 입력. 예) <Code>traceability, 추적성, 17-50</Code>. WP ID(예: <Code>17-50</Code>)도 그대로 키워드로 인식됩니다.</li>
              <li><strong style={{ color: T.textHi }}>충족 조건</strong> — <Code>1개라도 발견</Code>(느슨함) / <Code>모든 키워드 발견</Code>(엄격함).</li>
              <li><strong style={{ color: T.textHi }}>가중치 (0.1 – 5)</strong> — 룰이 충족됐을 때 점수에 기여하는 비중. 중요한 룰일수록 큰 값.</li>
            </ul>
            <div style={{ marginTop: 8, color: T.textLo, fontSize: 12 }}>
              점수 산식: <Code>점수 = Σ(충족된 룰 가중치) ÷ Σ(적용된 룰 가중치)</Code> — 결과를 N·P·L·F로 매핑.
            </div>
          </Step>

          <Step n={3} Icon={ListChecks} title="③ 사용자 정의 BP 만들기 (선택)">
            <strong style={{ color: T.textHi }}>"사용자 정의 BP"</strong> 탭에서는 PAM에 없는 <strong style={{ color: T.textHi }}>추가 Base Practice</strong>를 만들 수 있습니다.
            예) <Code>SYS.2.BPx — 변경요청 회의록 작성</Code>. 선택한 프로세스의 BP 목록 끝에 추가되어
            <strong style={{ color: T.textHi }}> PA 1.1 평균에 함께 반영</strong>됩니다.
            BP 자체에 키워드/충족 조건/가중치를 정의하므로 별도의 룰이 없어도 점수가 매겨집니다.
          </Step>

          <Step n={4} Icon={ToggleRight} title="④ 자동 키워드 폴백 (중요)">
            <strong style={{ color: T.textHi }}>"자동 키워드 폴백 사용"</strong>이 켜져 있으면, 어떤 사용자 룰도 적용되지 않는 BP/WP/GP는
            <strong style={{ color: T.textHi }}> 오프라인 PAM 자동 키워드</strong>로 평가됩니다(= Rule 엔진과 동일).
            끄면 <strong style={{ color: T.textHi }}>룰이 없는 항목은 모두 0점</strong>으로 처리되니,
            처음에는 켠 채로 일부 항목만 사용자 룰로 덮어쓰는 방식을 권장합니다.
          </Step>

          <Step n={5} Icon={Download} title="⑤ 룰 책 내보내기 · 불러오기 · 복원">
            모달 하단에서 전체 룰 묶음을 <Code>JSON</Code>으로 <strong style={{ color: T.textHi }}>내보내기</strong>·<strong style={{ color: T.textHi }}>불러오기</strong>할 수 있습니다.
            팀원과 공유하거나 프로젝트별로 다른 룰 셋을 운용할 때 유용합니다.
            <strong style={{ color: T.textHi }}>"기본값 복원"</strong>은 샘플 룰로 되돌립니다(작성한 룰은 사라집니다).
          </Step>

          <div style={{
            marginTop: 14,
            padding: "14px 18px",
            background: T.surface2,
            border: `1px solid ${T.borderL}`,
            borderRadius: 6,
            display: "flex",
            gap: 12,
          }}>
            <Lightbulb size={16} color={T.warm} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: T.textMd, lineHeight: 1.7 }}>
              <strong style={{ color: T.textHi }}>활용 예시.</strong> ① 사내 산출물 ID 체계(<Code>ACME-REQ-*</Code>)를 키워드로 등록해
              "추적성 ID 명시" 룰을 BP에 걸어두면, 해당 ID가 들어간 문서만 합격으로 인정됩니다.
              ② Hybrid의 정확도는 원하지만 LLM 비용이 부담될 때, Hybrid로 일부 프로세스만 평가하고
              나머지는 Custom + 사용자 룰로 운영할 수 있습니다.
            </div>
          </div>
        </div>

        {/* Traceability matrix & requirement coverage — detailed */}
        <div style={{ paddingTop: 24 }}>
          <SectionTitle>추적성 매트릭스 & 요구사항 → 테스트 커버리지</SectionTitle>

          <div style={{
            fontSize: 13,
            color: T.textMd,
            lineHeight: 1.75,
            background: T.accentSoft,
            border: `1px solid ${T.accent}33`,
            borderLeft: `3px solid ${T.accent}`,
            padding: "12px 16px",
            borderRadius: 5,
            marginBottom: 4,
          }}>
            ASPICE의 핵심은 <strong style={{ color: T.textHi }}>"요구사항 → 설계 → 테스트"</strong>가
            ID 수준에서 양방향으로 연결되어 있는지 확인하는 것입니다.
            본 도구는 이를 두 가지 관점에서 자동 계산합니다 —
            <strong style={{ color: T.textHi }}> 추적성 매트릭스</strong>(프로세스 간 ID 흐름)와
            <strong style={{ color: T.textHi }}> 요구사항 → 테스트 커버리지</strong>(전체 요구사항 중 테스트가 존재하는 비율).
          </div>

          <Step n={1} Icon={GitBranch} title="추적성 매트릭스 (Traceability Matrix)란?">
            V-모델의 <strong style={{ color: T.textHi }}>인접한 프로세스 쌍</strong>마다 한 장씩 매트릭스를 만듭니다.
            예) <Code>SYS.1 → SYS.2</Code>, <Code>SYS.2 → SWE.1</Code>, <Code>SWE.1 → SWE.4</Code> …
            각 매트릭스는 <strong style={{ color: T.textHi }}>상위(Source) 산출물에서 추출된 요구사항 ID</strong>가
            <strong style={{ color: T.textHi }}> 하위(Target) 산출물에 얼마나 인용됐는지</strong>를 보여줍니다.
            <div style={{ marginTop: 8, color: T.textLo, fontSize: 12 }}>
              연결 규칙은 <Code>spec/canonical/processGraph.json</Code>의 V-모델 seed 엣지에서 가져오며,
              엣지 없는 프로세스 쌍은 매트릭스가 만들어지지 않습니다.
            </div>
          </Step>

          <Step n={2} Icon={Link2} title="어떤 ID가 카운트되나?">
            매트릭스는 <strong style={{ color: T.textHi }}>"개발 요구사항 ID"</strong>만 분모로 셉니다 —
            <Code>REQ-*</Code>, <Code>SR-*</Code>, <Code>FR-*</Code> / <Code>FUNC-*</Code>(기능),
            <Code>NFR-*</Code> / <Code>NF-*</Code>(비기능), <Code>IFR-*</Code> / <Code>IF-*</Code> / <Code>INTF-*</Code>(인터페이스).
            <strong style={{ color: T.textHi }}> 시퀀스/버전/테스트 ID</strong>(<Code>SEQ-*</Code>, <Code>VER-*</Code>, <Code>TC-*</Code> 등)는 의도적으로 제외해서
            "문서에 우연히 나타난 식별자"가 분모를 부풀리지 않도록 합니다.
            <div style={{ marginTop: 8, color: T.textLo, fontSize: 12 }}>
              <strong style={{ color: T.textMd }}>커버리지 % =</strong> 하위 산출물 어딘가에 그 ID 문자열이 등장한
              상위 ID 개수 ÷ 상위 ID 전체 개수 × 100. 인용되지 않은 ID는 <strong style={{ color: T.textMd }}>orphan</strong>으로 표시됩니다.
            </div>
          </Step>

          <Step n={3} Icon={CheckCheck} title="요구사항 → 테스트 커버리지 (Requirement → Test Coverage)">
            <strong style={{ color: T.textHi }}>요구사항 산출물</strong>(WP <Code>17-00</Code>, <Code>17-05</Code>, <Code>17-54</Code>, <Code>17-55</Code>, <Code>17-57</Code>)에서 추출한
            모든 요구사항 ID 중에서, <strong style={{ color: T.textHi }}>테스트 산출물</strong>(WP <Code>08-60</Code>, <Code>08-59</Code>, <Code>08-58</Code>, <Code>08-57</Code>,
            <Code>15-52</Code>, <Code>13-24</Code>, <Code>13-25</Code>, <Code>03-50</Code>)의 본문에 등장하는 비율을 계산합니다.
            <ul style={{ margin: "8px 0 0 18px", padding: 0, color: T.textMd, lineHeight: 1.85 }}>
              <li><strong style={{ color: T.textHi }}>Total requirements</strong> — 요구사항 산출물에서 찾아낸 고유 요구사항 ID 수.</li>
              <li><strong style={{ color: T.textHi }}>Covered</strong> — 테스트 산출물 본문에 그 ID 문자열이 등장한 개수.</li>
              <li><strong style={{ color: T.textHi }}>Uncovered ID 목록</strong> — 테스트가 없는 요구사항. 그대로 갭 보완 작업 리스트로 활용 가능.</li>
            </ul>
            <div style={{ marginTop: 8, color: T.textLo, fontSize: 12 }}>
              매트릭스 범위(REQ/SR/FR/NFR/IFR)에 더해 <Code>SYS-*</Code>, <Code>SW-*</Code>, <Code>HW-*</Code>, <Code>ML-*</Code>,
              <Code>SRS-*</Code> 같은 도메인/문서 접두어까지 인정합니다(커버리지는 더 넓은 분모를 사용).
            </div>
          </Step>

          <div style={{
            marginTop: 14,
            padding: "14px 18px",
            background: T.surface2,
            border: `1px solid ${T.borderL}`,
            borderRadius: 6,
            display: "flex",
            gap: 12,
          }}>
            <Lightbulb size={16} color={T.warm} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: T.textMd, lineHeight: 1.7 }}>
              <strong style={{ color: T.textHi }}>점수를 올리는 가장 쉬운 방법.</strong>
              ① 모든 요구사항·설계·테스트 문서가 <strong style={{ color: T.textHi }}>같은 ID 표기</strong>를 사용하도록 통일합니다(예: 항상 <Code>SR-001</Code> 형식).
              ② 하위 산출물에 상위 ID를 <strong style={{ color: T.textHi }}>본문 어디든 한 번이라도</strong> 인용합니다(표·각주·코멘트 모두 인정).
              ③ 파일명에 프로세스 ID(<Code>sys2_</Code>, <Code>swe1_</Code>)와 WP ID(<Code>17-50</Code>)를 포함해 자동 분류 정확도를 높입니다.
            </div>
          </div>
        </div>

        {/* NPLF grades */}
        <div style={{ paddingTop: 24 }}>
          <SectionTitle>NPLF 등급 (ISO/IEC 33020)</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <Grade code="N" label="Not achieved"        range="0 – 15%"   color={T.err}  />
            <Grade code="P" label="Partially achieved"  range="16 – 50%"  color={T.warm} />
            <Grade code="L" label="Largely achieved"    range="51 – 85%"  color={T.accent} />
            <Grade code="F" label="Fully achieved"      range="86 – 100%" color={T.ok}   />
          </div>
        </div>
      </div>

      <div style={{
        padding: "16px 32px",
        borderTop: `1px solid ${T.borderL}`,
        display: "flex",
        justifyContent: "flex-end",
      }}>
        <button
          onClick={onClose}
          style={{
            background: T.accent,
            color: T.onAccent,
            border: "none",
            padding: "11px 32px",
            fontFamily: FONTS.mono,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            borderRadius: 4,
            fontWeight: 700,
          }}
        >
          확인
        </button>
      </div>
    </div>
  </div>
);
