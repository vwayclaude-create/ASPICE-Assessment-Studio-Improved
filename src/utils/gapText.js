// Client-side gap text normalization shared by per-process and project-mode UIs.
// Mirrors koreanizeGap() in api/_legacyAdapter.js. The server applies it in the
// legacy single-process path before returning to the client, but project-mode
// returns raw ProcessVerdict.bps[].gaps, so the client must koreanize itself.

export function koreanizeGap(text) {
  if (!text) return text;
  let out = String(text);
  out = out.replace(/^\[rule\]\s*/i, "[규칙] ");
  out = out.replace(/^\[llm\]\s*/i, "[LLM] ");
  out = out.replace(
    /No evidence found for keywords:\s*[^.]*\.?/i,
    "관련 키워드 증거 미발견.",
  );
  out = out.replace(/GP evidence missing:\s*[^.]*\.?/i, "GP 증거 누락.");
  out = out.replace(
    /No artifact satisfies WP\s+(\S+)\s+(.+)/i,
    "WP $1 $2를 만족하는 산출물 없음",
  );
  out = out.replace(
    /No explicit WP ID\s+(\S+)\s+tagging;\s*matched on name\./i,
    "명시적 WP ID $1 태깅 없음. 이름으로 매칭됨.",
  );
  out = out.replace(
    /Some base practices below ['"]Largely['"] threshold/i,
    "일부 BP가 'Largely' 기준 미만",
  );
  out = out.replace(
    /no keywords derivable from BP spec/i,
    "BP 명세에서 키워드 추출 불가",
  );
  out = out.replace(/^rejected:\s*/i, "거부됨: ");
  out = out.replace(/rule threw:/i, "규칙 평가 실패:");
  out = out.replace(/llm threw:/i, "LLM 평가 실패:");
  return out;
}

export function condenseGap(raw, { maxLen = 70 } = {}) {
  if (!raw) return "";
  let s = koreanizeGap(String(raw)).trim();
  s = s.replace(/^\[(규칙|LLM|rule|llm)\]\s*/i, "");
  const firstSentence = s.split(/\.\s+/)[0];
  if (firstSentence) s = firstSentence;
  s = s.replace(
    /(에 대한 추가적?인? 설명이 필요합니다|이 (부족|필요)합니다|합니다)\.?$/u,
    "",
  );
  s = s.replace(/\.+$/u, "").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen - 2) + "…";
  return s;
}
