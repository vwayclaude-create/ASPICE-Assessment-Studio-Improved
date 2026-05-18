// Text extraction for uploaded artifacts.
// Returns { text, pages } where pages is [{start, end, page}] in cleaned-text
// char offsets, or null when the source format has no page concept (xlsx,
// plain text) or when page detection failed. PDF pages are captured via
// pdf-parse's pagerender hook; DOCX pages are signalled by U+000C (\f) form
// feeds inserted by the client-side XML parser in fileReaders.js.

export async function extractText({ name, text, base64, mimeType }) {
  if (text != null) {
    if (text.includes("\f")) return splitByFormFeed(text);
    return { text: cleanText(text), pages: null };
  }
  if (!base64) return { text: "", pages: null };
  const buf = Buffer.from(base64, "base64");
  if (/pdf/i.test(mimeType || "") || /\.pdf$/i.test(name)) {
    const pdfParse = (await import("pdf-parse")).default;
    const pageTexts = [];
    // pdf-parse can hang on PDFs with non-standard fonts or corrupt cross-ref
    // tables. A blocked parse used to keep the dev server stuck on one request
    // until the browser gave up with "Failed to fetch". 60s is generous for
    // legitimate 30MB PDFs but short enough to fail loud on a true hang.
    await withTimeout(
      pdfParse(buf, {
        pagerender: async (pageData) => {
          const tc = await pageData.getTextContent({
            normalizeWhitespace: false,
            disableCombineTextItems: false,
          });
          let lastY;
          let pageText = "";
          for (const item of tc.items) {
            if (lastY === item.transform[5] || !lastY) pageText += item.str;
            else pageText += "\n" + item.str;
            lastY = item.transform[5];
          }
          pageTexts.push(pageText);
          return pageText;
        },
      }),
      60_000,
      `PDF parse timed out after 60s for "${name}"`
    );
    return assemblePages(pageTexts, "\n\n");
  }
  return { text: cleanText(buf.toString("utf8")), pages: null };
}

function withTimeout(promise, ms, message) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

function splitByFormFeed(raw) {
  return assemblePages(raw.split("\f"), "");
}

function assemblePages(rawSegments, separator) {
  const pages = [];
  let combined = "";
  for (let i = 0; i < rawSegments.length; i++) {
    const cleaned = cleanText(rawSegments[i]);
    const start = combined.length;
    combined += cleaned;
    pages.push({ start, end: combined.length, page: i + 1 });
    if (separator && i < rawSegments.length - 1) combined += separator;
  }
  return { text: combined, pages: pages.length ? pages : null };
}

// Normalize PDF-extracted text so the UI and scorer do not see glyph-level noise:
//   1) pdf.js emits CJK text one glyph at a time with a space between each glyph
//      ("가 나 다 라"). Collapse any run of 4 or more single-char tokens so the
//      original compact word is restored.
//   2) When a PDF uses CID fonts without a ToUnicode CMap, Korean glyphs surface
//      as Latin Extended garbage (e.g. AM/PM "오전" => "ÆŞÈ"). Replace such
//      unrecoverable clusters with a placeholder instead of printing mojibake.
//   3) Collapse repeated whitespace.
function cleanText(text) {
  if (!text) return "";
  // Run the letter-spacing collapse twice: after the first pass collapses 4+ runs,
  // neighbouring short runs (e.g. "4 .", "Æ Ş È") become visible to the second pass.
  // The lookbehind/lookahead anchor the run to real word boundaries so we don't
  // accidentally absorb the last letter of a preceding word ("Management 2 0 2 6").
  for (let i = 0; i < 2; i++) {
    text = text.replace(/(?<=^|\s)(?:[^\s] ){2,}[^\s](?=\s|$)/g, (m) => m.replace(/ /g, ""));
  }
  text = text.replace(/[À-ɏʰ-˿]{2,}/g, "□");
  text = text.replace(/[ \t]{2,}/g, " ");
  return text;
}
