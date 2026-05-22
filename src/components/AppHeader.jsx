import { T, FONTS } from "../theme";
import { ASPICE_DATA } from "../data/aspiceData";

export const AppHeader = ({ topLeftSlot, topRightSlot }) => (
  <header style={{ borderBottom: `1px solid ${T.borderL}`, paddingBottom: 32, marginBottom: 36 }}>
    {(topLeftSlot || topRightSlot) && (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{topLeftSlot}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{topRightSlot}</div>
      </div>
    )}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
      <div>
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: T.accent,
          marginBottom: 14,
          fontWeight: 500,
        }}>
          VDA · Automotive SPICE® 4.0 · OII(Output Information Items) Diagnostic Workbench
        </div>
        <h1 style={{
          fontFamily: FONTS.sans,
          fontWeight: 700,
          fontSize: "clamp(36px, 5vw, 45px)",
          lineHeight: 1.02,
          letterSpacing: "-0.035em",
          margin: 0,
          color: T.textHi,
        }}>
          Automotive <span style={{ fontWeight: 300, color: T.accent }}>SPICE</span><br/>
          <span style={{ fontSize: "0.66em", fontWeight: 300, color: T.textMd }}>Assessment Studio</span>
        </h1>
      </div>
      <div style={{
        fontFamily: FONTS.mono,
        fontSize: 10,
        color: T.textLo,
        textAlign: "right",
        lineHeight: 1.85,
      }}>
        <div>REF · PAM v4.0 (2023-11-29)</div>
        <div>REF · Guidelines (2024-03-12)</div>
        <div>SCALE · ISO/IEC 33020 NPLF</div>
        <div style={{ marginTop: 8, color: T.accent }}>⬤ {Object.keys(ASPICE_DATA).length} PROCESSES LOADED</div>
      </div>
    </div>
    <p style={{
      fontFamily: FONTS.sans,
      fontSize: 12,
      fontWeight: 400,
      color: T.textMd,
      maxWidth: 760,
      marginTop: 22,
      lineHeight: 1.6,
      letterSpacing: "-0.005em",
    }}>
      개발 산출물을 업로드하면, Automotive SPICE PAM의 Base Practice와 VDA Guideline의 해석 기준에 따라 각 BP에 N·P·L·F 등급을 부여합니다.
    </p>
  </header>
);
