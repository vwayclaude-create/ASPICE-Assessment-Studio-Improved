import { ArrowRight, ShieldCheck, FileSearch, History } from "lucide-react";
import { T, FONTS } from "../theme";

const PROCESS_GROUPS = ["SYS", "HWE", "SWE", "MLE", "ACQ", "SPL", "REU", "PIM", "MAN", "SUP", "VAL"];

const FEATURES = [
  {
    Icon: FileSearch,
    title: "PAM 4.0 기반 NPLF 평가",
    body: "PDF·DOCX·XLSX 산출물을 업로드하면 Base Practice 단위로 N·P·L·F 등급과 근거를 자동 도출합니다.",
  },
  {
    Icon: ShieldCheck,
    title: "VDA Guideline 해석 일관성",
    body: "VDA 4.0 가이드라인의 해석 기준을 적용해 평가자 간 편차를 줄이고, 결론의 재현성을 높입니다.",
  },
  {
    Icon: History,
    title: "분석 이력 보존",
    body: "프로세스·문서·등급 결과가 이력으로 누적되어, 산출물 개선 추이를 손쉽게 추적할 수 있습니다.",
  },
];

// 침착한 인상을 위한 로컬 톤 — 전역 테마는 건드리지 않고 랜딩에서만 부드럽게 보정.
const LT = {
  accentTint: "#EEF3FC",
  accentLine: "#D8E3F6",
  pageBg: "linear-gradient(180deg, #FAFBFD 0%, #F2F5F9 100%)",
  cardShadow: "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px rgba(15,23,42,0.06)",
  softShadow: "0 1px 2px rgba(15,23,42,0.03), 0 4px 16px rgba(15,23,42,0.04)",
  radius: 16,
};

const LANDING_CSS = `
.lp-btn { transition: background .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease; }
.lp-btn:hover { transform: translateY(-1px); }
.lp-btn-primary:hover { box-shadow: 0 8px 20px rgba(37,99,235,0.28); }
.lp-card { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.lp-card:hover { transform: translateY(-3px); box-shadow: 0 1px 2px rgba(15,23,42,0.05), 0 18px 40px rgba(15,23,42,0.10); border-color: ${LT.accentLine}; }
.lp-chip { transition: background .18s ease, color .18s ease; }
`;

export function LandingPage({ onLogin, onSignup }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: LT.pageBg,
      fontFamily: FONTS.sans,
      color: T.textHi,
      padding: "32px 24px 64px",
    }}>
      <style>{LANDING_CSS}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ── Nav ───────────────────────────────────────── */}
        <nav style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 88,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: T.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <ShieldCheck size={18} color={T.onAccent} strokeWidth={2} />
            </div>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: T.textHi,
            }}>
              ASPICE Assessment Studio
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lp-btn" onClick={onLogin} style={navButtonStyle()}>로그인</button>
            <button className="lp-btn lp-btn-primary" onClick={onSignup} style={navButtonStyle({ primary: true })}>
              회원가입
            </button>
          </div>
        </nav>

        {/* ── Hero ──────────────────────────────────────── */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
          gap: 56,
          alignItems: "center",
          marginBottom: 112,
        }}>
          <div>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: LT.accentTint,
              border: `1px solid ${LT.accentLine}`,
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: T.accent,
              marginBottom: 24,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999, background: T.accent,
              }} />
              Automotive SPICE® 4.0 · OII(Output Information Items) Diagnostic Workbench
            </div>

            <h1 style={{
              fontWeight: 700,
              fontSize: "clamp(30.4px, 3.68vw, 41.6px)",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              margin: 0,
              color: T.textHi,
            }}>
              Automotive SPICE 인증 준비를 위한<br/>
              <span style={{ color: T.accent }}>산출물 진단</span>을 지원합니다
            </h1>

            <p style={{
              fontSize: 16,
              color: T.textMd,
              maxWidth: 500,
              marginTop: 22,
              lineHeight: 1.75,
            }}>
              산출물 한 건만 올리면 PAM Base Practice 별 N·P·L·F 등급과 그 근거를
              받아볼 수 있습니다. 회원으로 가입하면 분석 이력이 안전하게 보존되고,
              평가 기준과 결과를 팀과 공유할 수 있습니다.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
              <button className="lp-btn lp-btn-primary" onClick={onSignup} style={ctaButtonStyle({ primary: true })}>
                무료로 시작하기 <ArrowRight size={16} />
              </button>
              <button className="lp-btn" onClick={onLogin} style={ctaButtonStyle()}>
                기존 계정으로 로그인
              </button>
            </div>
          </div>

          {/* ── Reference panel ──────────────────────────── */}
          <div style={{
            background: T.surface,
            border: `1px solid ${T.borderL}`,
            borderRadius: LT.radius,
            padding: 28,
            boxShadow: LT.cardShadow,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textHi }}>
                탑재된 프로세스 레퍼런스
              </div>
              <div style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                color: T.accent,
                fontWeight: 600,
              }}>
                32 loaded
              </div>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
            }}>
              {PROCESS_GROUPS.map((id) => (
                <div key={id} className="lp-chip" style={{
                  background: T.surface2,
                  border: `1px solid ${T.borderL}`,
                  borderRadius: 9,
                  padding: "11px 8px",
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.textMd,
                  textAlign: "center",
                }}>
                  {id}
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid ${T.borderL}`,
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}>
              {[
                ["PAM", "v4.0 · 2023-11-29"],
                ["Guidelines", "v4.0 · 2024-03-12"],
                ["Scale", "ISO/IEC 33020 · NPLF"],
              ].map(([k, v]) => (
                <div key={k} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12.5,
                }}>
                  <span style={{ color: T.textLo }}>{k}</span>
                  <span style={{ color: T.textMd, fontFamily: FONTS.mono, fontSize: 11.5 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────── */}
        <section style={{ marginBottom: 80 }}>
          <h2 style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: T.textHi,
            margin: "0 0 6px",
          }}>
            평가의 흐름을 한 화면에서
          </h2>
          <p style={{ fontSize: 14.5, color: T.textLo, margin: "0 0 28px" }}>
            업로드부터 등급 산정, 이력 추적까지 — 일관된 기준으로 이어집니다.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="lp-card" style={{
                background: T.surface,
                border: `1px solid ${T.borderL}`,
                borderRadius: LT.radius,
                padding: 26,
                boxShadow: LT.softShadow,
              }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  background: LT.accentTint,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}>
                  <Icon size={20} color={T.accent} strokeWidth={1.75} />
                </div>
                <div style={{
                  fontWeight: 600,
                  fontSize: 16,
                  color: T.textHi,
                  marginBottom: 9,
                  letterSpacing: "-0.01em",
                }}>
                  {title}
                </div>
                <div style={{ fontSize: 13.5, color: T.textMd, lineHeight: 1.65 }}>
                  {body}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────── */}
        <footer style={{
          paddingTop: 24,
          borderTop: `1px solid ${T.borderL}`,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 12,
            color: T.textLo,
          }}>
            <span>ASPICE Assessment Studio</span>
            <span style={{ color: T.textDim }}>for evaluation use</span>
          </div>
          <div style={{
            marginTop: 14,
            fontSize: 11.5,
            lineHeight: 1.6,
            color: T.textDim,
          }}>
            주의 : 본 진단 및 평가 결과는 비공식 갭 진단이며, iNTACS 공식 평가를 대체하지 않으며, 심사 또는 평가 근거로 사용되지 않습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}

function navButtonStyle({ primary = false } = {}) {
  return {
    background: primary ? T.accent : T.surface,
    color: primary ? T.onAccent : T.textMd,
    border: primary ? "1px solid transparent" : `1px solid ${T.borderM}`,
    padding: "9px 18px",
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    fontWeight: 500,
    cursor: "pointer",
    borderRadius: 10,
  };
}

function ctaButtonStyle({ primary = false } = {}) {
  return {
    background: primary ? T.accent : T.surface,
    color: primary ? T.onAccent : T.textMd,
    border: primary ? "1px solid transparent" : `1px solid ${T.borderM}`,
    padding: "13px 22px",
    fontFamily: FONTS.sans,
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
  };
}
