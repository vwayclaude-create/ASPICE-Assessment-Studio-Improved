import { T, FONTS } from "../theme";

export const AppFooter = () => (
  <div style={{
    marginTop: 40,
    paddingTop: 24,
    borderTop: `1px solid ${T.borderL}`,
  }}>
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 14,
      fontFamily: FONTS.mono,
      fontSize: 9,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: T.textDim,
      fontWeight: 500,
    }}>
      <div>Automotive SPICE® VDA QMC · PAM v4.0 · Guidelines 2024-03-12</div>
      <div>⬤ F fully  ◆ L largely  ◇ P partially  ○ N not achieved</div>
    </div>
    <div style={{
      marginTop: 16,
      fontFamily: FONTS.sans,
      fontSize: 11.5,
      lineHeight: 1.6,
      color: T.textDim,
    }}>
      주의 : 본 진단 및 평가 결과는 비공식 갭 진단이며, iNTACS 공식 평가를 대체하지 않으며, 심사 또는 평가 근거로 사용되지 않습니다.
    </div>
  </div>
);
