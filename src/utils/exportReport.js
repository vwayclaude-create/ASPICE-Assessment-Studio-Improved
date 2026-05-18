import jsPDF from "jspdf";
import { normalizeEvidence } from "./evidence";
import { captureToPngCanvas, sliceCanvasToPdfPage } from "./pdfPaginator";

export const exportReportAsText = ({ proc, results, fileName, date }) => {
  const lines = [];
  lines.push("ASPICE 4.0 CL1 진단 리포트");
  lines.push("================================");
  lines.push(`프로세스: ${proc.id} ${proc.name}`);
  lines.push(`문서: ${fileName}`);
  lines.push(`일시: ${date.toLocaleString("ko-KR")}`);
  lines.push("");
  lines.push(`[Summary] ${results.summary || ""}`);
  lines.push(`[Strengths] ${results.strengths || ""}`);
  lines.push(`[Gaps] ${results.gaps || ""}`);
  lines.push("");
  lines.push("BP별 평가");
  lines.push("--------------------------------");
  results.ratings.forEach((r) => {
    const bpDef = proc.bps.find((b) => b.id === r.bp);
    lines.push(`${r.bp} [${r.rating}] ${bpDef?.title || ""}`);
    lines.push(`  약점: ${r.rationale}`);
    const evidenceItems = normalizeEvidence(r.evidence);
    if (evidenceItems.length === 0) {
      lines.push(`  약점 근거: (제시된 근거 없음)`);
    } else {
      lines.push(`  약점 근거:`);
      evidenceItems.forEach((ev, i) => {
        const loc = ev.location ? `[${ev.location}] ` : "";
        lines.push(`    ${i + 1}. ${loc}${ev.quote || "(내용 없음)"}`);
      });
    }
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ASPICE_${proc.id}_report.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// PDF 내보내기용 인쇄 스타일: 화면의 다크 테마를 종이용 라이트 레이아웃으로 덮어쓴다.
// 모든 폰트 크기는 화면 대비 약 0.9× 로 축소되어 종이에 맞춰져 있음.
const PRINT_STYLE = `
  #pdf-export-root { background:#FFFFFF !important; color:#3F3F46 !important; border:1.5px solid #0A0A0C !important; border-radius:4px !important; padding:18px 22px 20px !important; font-family:'Inter',system-ui,sans-serif !important; }
  #pdf-export-root, #pdf-export-root * { color:#3F3F46 !important; letter-spacing:-0.005em !important; }
  #pdf-export-root > div:first-child { background:#FFFFFF !important; color:#0A0A0C !important; border:1.5px solid #0A0A0C !important; font-size:8px !important; padding:3px 10px !important; top:-9px !important; }
  #pdf-export-root > div:first-child * { color:#0A0A0C !important; }
  #pdf-export-root h3 { color:#0A0A0C !important; font-size:20px !important; margin:0 0 5px 0 !important; font-weight:700 !important; }
  #pdf-export-root h3 > span { font-size:11px !important; color:#52525C !important; }
  #pdf-export-root p { font-size:9.5px !important; line-height:1.45 !important; margin:0 !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] { gap:7px !important; margin-bottom:13px !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div { background:#FFFFFF !important; border-radius:4px !important; padding:9px 13px !important; border-width:1px 1px 1px 4px !important; border-style:solid !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div > div:nth-child(1) { font-size:8px !important; font-weight:700 !important; opacity:1 !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div > div:nth-child(2) { font-size:29px !important; line-height:1 !important; margin-top:5px !important; font-weight:800 !important; color:#111827 !important; }
  #pdf-export-root div[style*="repeat(3, 1fr)"] > div > div:nth-child(3) { font-size:8px !important; color:#6B7280 !important; opacity:1 !important; margin-top:3px !important; }
  #pdf-export-root div[style*="1fr 1fr"] { gap:9px !important; margin-bottom:13px !important; }
  #pdf-export-root div[style*="1fr 1fr"] > div { background:#FAFAFA !important; border:1px solid #D4D4D8 !important; border-left:2.5px solid #0A0A0C !important; border-radius:0 3px 3px 0 !important; padding:9px 11px !important; }
  #pdf-export-root div[style*="1fr 1fr"] > div > div:nth-child(1) { font-size:8px !important; color:#0A0A0C !important; font-weight:700 !important; margin-bottom:3px !important; }
  #pdf-export-root div[style*="1fr 1fr"] > div > div:nth-child(2) { font-size:10px !important; color:#3F3F46 !important; line-height:1.45 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] { background:#FFFFFF !important; border:1px solid #0A0A0C !important; border-radius:3px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(1) { background:#FFFFFF !important; color:#0A0A0C !important; border-right:1px solid #0A0A0C !important; padding:6px 0 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(1) > div:nth-child(1) { font-size:18px !important; font-weight:800 !important; color:#0A0A0C !important; line-height:1 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(1) > div:nth-child(2) { font-size:6.5px !important; color:#52525C !important; opacity:1 !important; margin-top:2px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) { padding:7px 11px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(2) { font-size:9px !important; color:#3F3F46 !important; line-height:1.4 !important; margin-bottom:5px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(3) { font-size:7px !important; color:#52525C !important; letter-spacing:0.12em !important; font-weight:700 !important; margin-bottom:3px !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) { gap:3px !important; max-height:none !important; overflow:visible !important; padding-right:0 !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div { background:#FAFAFA !important; border:1px solid #D4D4D8 !important; border-left:2px solid #0A0A0C !important; padding:5px 8px !important; }
  /* Evidence "location" pill — black bg + white text + visible icon. Force span/svg color so icon and label both render in PDF. */
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:first-child { background:#0A0A0C !important; color:#FFFFFF !important; border:1px solid #0A0A0C !important; padding:2px 7px !important; font-size:7px !important; font-weight:700 !important; letter-spacing:0.06em !important; margin-bottom:3px !important; display:inline-flex !important; align-items:center !important; gap:4px !important; max-width:100% !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:first-child * { color:#FFFFFF !important; }
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:first-child svg { color:#FFFFFF !important; stroke:#FFFFFF !important; fill:none !important; width:8px !important; height:8px !important; flex-shrink:0 !important; }
  /* Quote box — show full content (no scroll), neutralise screen-only background/border. */
  #pdf-export-root div[style*="60px minmax(0, 1fr)"] > div:nth-child(2) > div:nth-child(4) > div > div:last-child { font-size:8.5px !important; color:#3F3F46 !important; line-height:1.4 !important; max-height:none !important; overflow:visible !important; padding:4px 6px !important; background:#FFFFFF !important; border:none !important; }
  #pdf-export-root > div[style*="flex-direction: column"]:last-child { gap:5px !important; }
`;

const attachPrintStyle = (clonedDoc) => {
  // Prefer the explicit data-attribute marker set by VerdictCard. Fall back
  // to legacy textContent-based matching so older snapshots still print.
  let target = clonedDoc.querySelector("[data-pdf-export-root]");
  if (!target) {
    clonedDoc.querySelectorAll("section").forEach((el) => {
      const t = el.textContent || "";
      if (!target && (t.includes("NPLF VERDICT") || t.includes("NPLF 평가 결과"))) target = el;
    });
  }
  if (!target) {
    console.warn("[aspice/pdf] verdict section not found in cloned doc — print stylesheet not applied");
    return;
  }
  target.id = "pdf-export-root";
  const s = clonedDoc.createElement("style");
  s.textContent = PRINT_STYLE;
  (clonedDoc.head || clonedDoc.documentElement).appendChild(s);
  // Belt-and-braces: also mutate inline styles directly so the print look
  // applies even if the injected <style> doesn't reach html2canvas's renderer
  // (selector specificity, attribute mismatch, etc.).
  applyInlinePdfStyle(target);
};

const setStyle = (el, patch) => {
  if (!el) return;
  for (const [k, v] of Object.entries(patch)) {
    el.style.setProperty(k, v, "important");
  }
};

// Walk the verdict section in the cloned doc and rewrite inline styles for
// the elements the PDF cares about. This is the load-bearing path now — the
// CSS in PRINT_STYLE remains as a backstop but is no longer required.
const applyInlinePdfStyle = (root) => {
  setStyle(root, {
    background: "#FFFFFF",
    color: "#3F3F46",
    border: "1.5px solid #0A0A0C",
    "border-radius": "4px",
    padding: "18px 22px 20px",
    "font-family": "'Inter',system-ui,sans-serif",
  });

  // Iterate every BP rating row (grid with 60px + minmax columns).
  root.querySelectorAll('div[style*="60px"][style*="minmax"]').forEach((row) => {
    setStyle(row, { background: "#FFFFFF", border: "1px solid #0A0A0C", "border-radius": "3px" });
    const cells = row.children;
    if (cells.length < 2) return;
    const [ratingCell, bodyCell] = cells;

    // Left rating cell — strip rating-color background, big bold rating glyph.
    setStyle(ratingCell, {
      background: "#FFFFFF",
      color: "#0A0A0C",
      "border-right": "1px solid #0A0A0C",
      padding: "6px 0",
    });
    const ratingChildren = ratingCell.children;
    if (ratingChildren[0]) setStyle(ratingChildren[0], { "font-size": "18px", "font-weight": "800", color: "#0A0A0C", "line-height": "1" });
    if (ratingChildren[1]) setStyle(ratingChildren[1], { "font-size": "6.5px", color: "#52525C", opacity: "1", "margin-top": "2px" });

    // Right body cell — title row, rationale, evidence label, evidence list.
    setStyle(bodyCell, { padding: "7px 11px" });
    const body = bodyCell.children;
    if (body[1]) setStyle(body[1], { "font-size": "9px", color: "#3F3F46", "line-height": "1.4", "margin-bottom": "5px" });
    if (body[2]) setStyle(body[2], { "font-size": "7px", color: "#52525C", "letter-spacing": "0.12em", "font-weight": "700", "margin-bottom": "3px" });
    const evidenceList = body[3];
    if (!evidenceList) return;
    setStyle(evidenceList, { gap: "3px", "max-height": "none", overflow: "visible", "padding-right": "0" });

    Array.from(evidenceList.children).forEach((item) => {
      setStyle(item, { background: "#FAFAFA", border: "1px solid #D4D4D8", "border-left": "2px solid #0A0A0C", padding: "5px 8px" });
      // Find the quote/pill by attribute. Children layout is variable now
      // (pill optional, quote optional, "더 보기" toggle button optional),
      // so positional destructuring is unsafe.
      const quote = item.querySelector('[data-evidence-quote]');
      const pill = Array.from(item.children).find(
        (c) => c !== quote && c.nodeType === 1 && !c.hasAttribute("data-html2canvas-ignore") && c.tagName !== "BUTTON"
      );
      if (pill) {
        // html2canvas struggles with lucide SVG inside inline-flex containers
        // (icon AND label sometimes vanish in the rasterised output). Replace
        // the pill contents with a single plain-text label, which renders
        // reliably as a normal block element.
        const labelText = pill.textContent ? pill.textContent.trim() : "";
        pill.innerHTML = "";
        const label = pill.ownerDocument.createElement("span");
        label.textContent = "▸ " + labelText;
        setStyle(label, { color: "#FFFFFF", "font-weight": "700" });
        pill.appendChild(label);
        setStyle(pill, {
          background: "#0A0A0C",
          color: "#FFFFFF",
          border: "1px solid #0A0A0C",
          "border-radius": "3px",
          padding: "2px 8px",
          "font-size": "7.5px",
          "font-weight": "700",
          "letter-spacing": "0.04em",
          "margin-bottom": "3px",
          display: "inline-block",
          "max-width": "100%",
          "word-break": "break-all",
          "white-space": "normal",
          "font-family": "'JetBrains Mono', monospace",
        });
      }
      if (quote) {
        setStyle(quote, {
          "font-size": "8.5px",
          color: "#3F3F46",
          "line-height": "1.4",
          "max-height": "none",
          overflow: "visible",
          padding: "4px 6px",
          background: "#FFFFFF",
          border: "none",
        });
      }
    });
  });
};

const formatHeaderDate = (d) => {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}. ${m}. ${day}. ${hh}:${mi}`;
};

const renderHeader = (pdf, proc, pageWidth, headerH, headerPad, cont) => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(248, 248, 250); pdf.rect(0, 0, pageWidth, headerH, "F");
  pdf.setDrawColor(180, 180, 188); pdf.setLineWidth(0.3);
  pdf.line(0, headerH, pageWidth, headerH);
  pdf.setTextColor(10, 10, 12); pdf.setFontSize(10);
  pdf.text(`ASPICE 4.0 · ${proc.id} ${proc.name}${cont ? " (cont.)" : ""}`, headerPad, 10);
  pdf.setFontSize(7.5); pdf.setTextColor(100, 100, 110);
  pdf.text(formatHeaderDate(new Date()), pageWidth - headerPad, 10, { align: "right" });
};

const sliceCanvasToPdf = (pdf, canvas, imgX, yTop, sliceMm, srcY, srcH, scaledImgW) => {
  sliceCanvasToPdfPage(pdf, canvas, {
    srcY, srcH,
    dstX: imgX, dstY: yTop, dstW: scaledImgW, dstH: sliceMm,
  });
};

export const exportReportAsPdf = async ({ proc, node }) => {
  const canvas = await captureToPngCanvas(node, {
    windowWidth: node.scrollWidth,
    onclone: attachPrintStyle,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const marginY = 8;
  const sideMargin = 5;
  const headerPad = 8;
  const headerH = 16;
  const scaledImgW = pageWidth - sideMargin * 2;
  const imgH = (canvas.height * scaledImgW) / canvas.width;
  const imgX = sideMargin;

  renderHeader(pdf, proc, pageWidth, headerH, headerPad, false);
  const positionY = headerH + 4;
  const pxPerMm = canvas.width / scaledImgW;

  if (imgH + positionY + marginY <= pageHeight) {
    pdf.addImage(imgData, "PNG", imgX, positionY, scaledImgW, imgH);
  } else {
    const firstMm = pageHeight - positionY - marginY;
    const otherMm = pageHeight - headerH - 4 - marginY;
    const fp = Math.min(canvas.height, Math.floor(firstMm * pxPerMm));
    sliceCanvasToPdf(pdf, canvas, imgX, positionY, fp / pxPerMm, 0, fp, scaledImgW);
    let sy = fp;
    let rem = canvas.height - fp;
    while (rem > 0) {
      pdf.addPage();
      renderHeader(pdf, proc, pageWidth, headerH, headerPad, true);
      const sp = Math.min(rem, Math.floor(otherMm * pxPerMm));
      sliceCanvasToPdf(pdf, canvas, imgX, positionY, sp / pxPerMm, sy, sp, scaledImgW);
      sy += sp;
      rem -= sp;
    }
  }

  const pc = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pc; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 130);
    pdf.text(`Automotive SPICE® VDA QMC · ASPICE Workbench  ·  ${i}/${pc}`, pageWidth / 2, pageHeight - 4, { align: "center" });
  }
  pdf.save(`ASPICE_${proc.id}_report_${Date.now()}.pdf`);
};
