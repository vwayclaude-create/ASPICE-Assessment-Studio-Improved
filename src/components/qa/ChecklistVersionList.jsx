import { useRef, useState } from "react";
import { T, FONTS } from "../../theme";
import { confirmRate } from "./ChecklistImportPanel";

const th = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: T.textLo, borderBottom: `1px solid ${T.borderL}` };
const td = { padding: "6px 8px", fontSize: 12, borderBottom: `1px solid ${T.borderL}`, verticalAlign: "top" };
const btn = {
  padding: "3px 10px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: FONTS.sans,
  border: `1px solid ${T.borderM}`,
  background: T.surface,
  color: T.textMd,
  cursor: "pointer",
  marginRight: 6,
};

export function ChecklistVersionList({ qa }) {
  const versions = [...qa.state.versions].sort((a, b) => b.version - a.version);
  const [json, setJson] = useState(null); // { id, version, text }
  const [copied, setCopied] = useState(false);
  const areaRef = useRef(null);

  if (!versions.length) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json.text);
      setCopied(true);
    } catch {
      areaRef.current?.select();
    }
  };

  return (
    <section style={{ background: T.surface, border: `1px solid ${T.borderL}`, borderRadius: 8, padding: "16px 20px", marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: T.textHi, margin: "0 0 12px" }}>버전 목록</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={th}>버전</th>
              <th style={th}>가져온 시각</th>
              <th style={th}>원본 파일</th>
              <th style={th}>확정률</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const isActive = v.id === qa.state.activeVersionId;
              return (
                <tr key={v.id} style={{ background: isActive ? T.accentSoft : "transparent" }}>
                  <td style={td}>v{v.version}{isActive ? " (활성)" : ""}</td>
                  <td style={td}>{new Date(v.createdAt).toLocaleString("ko-KR")}</td>
                  <td style={td}>{[...new Set(v.sources.map((s) => s.fileName))].join(", ")}</td>
                  <td style={td}>{confirmRate(v)}%</td>
                  <td style={td}>
                    <button type="button" style={btn} disabled={isActive} onClick={() => qa.setActiveVersion(v.id)}>
                      활성으로 지정
                    </button>
                    <button
                      type="button"
                      style={btn}
                      onClick={() => {
                        setCopied(false);
                        setJson({ id: v.id, version: v.version, text: qa.exportVersionJson(v.id) });
                      }}
                    >
                      JSON 내보내기
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {json && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
            v{json.version} JSON
            <button type="button" style={btn} onClick={copy}>{copied ? "복사됨" : "복사"}</button>
            <button type="button" style={btn} onClick={() => setJson(null)}>닫기</button>
          </div>
          <textarea
            ref={areaRef}
            readOnly
            value={json.text}
            style={{ width: "100%", boxSizing: "border-box", height: 240, fontFamily: FONTS.mono, fontSize: 11 }}
          />
        </div>
      )}
    </section>
  );
}
