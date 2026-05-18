// Bridges the harness ProcessVerdict to the legacy UI shape
// {ratings, summary, strengths, gaps} that the per-process VerdictCard
// component still consumes. Also Koreanizes English template phrases
// emitted by ruleScorer/hybridScorer so the verdict UI is single-language.

// Translate rule/hybrid scorer English template phrases (and the [rule]/[llm]
// tag prefixes that hybridScorer prepends) into Korean.
export function koreanizeGap(text) {
  if (!text) return text;
  let out = String(text);
  out = out.replace(/^\[rule\]\s*/i, "[규칙] ");
  out = out.replace(/^\[llm\]\s*/i, "[LLM] ");
  out = out.replace(/No evidence found for keywords:/i, "키워드 증거 미발견:");
  out = out.replace(/GP evidence missing:/i, "GP 증거 누락:");
  out = out.replace(/No artifact satisfies WP\s+(\S+)\s+(.+)/i, "WP $1 $2를 만족하는 산출물 없음");
  out = out.replace(/No explicit WP ID\s+(\S+)\s+tagging;\s*matched on name\./i, "명시적 WP ID $1 태깅 없음. 이름으로 매칭됨.");
  out = out.replace(/Some base practices below ['"]Largely['"] threshold/i, "일부 BP가 'Largely' 기준 미만");
  out = out.replace(/no keywords derivable from BP spec/i, "BP 명세에서 키워드 추출 불가");
  out = out.replace(/^rejected:\s*/i, "거부됨: ");
  out = out.replace(/rule threw:/i, "규칙 평가 실패:");
  out = out.replace(/llm threw:/i, "LLM 평가 실패:");
  return out;
}

function summarizeProjectFingerprint(fp) {
  if (!fp || !Array.isArray(fp.dominant) || fp.dominant.length === 0) return "";
  const top = fp.dominant.slice(0, 6).join(", ");
  const off = (fp.perArtifact ?? [])
    .filter((p) => p.contextMatch != null && p.contextMatch < 0.3)
    .map((p) => p.name);
  if (off.length) {
    return ` · 프로젝트 식별자: ${top} · 컨텍스트 이탈 의심 파일: ${off.join(", ")}`;
  }
  return ` · 프로젝트 식별자: ${top}`;
}

// Compress a noisy gap line into a short improvement point. Strips engine tags,
// keeps only the first sentence, drops trailing 합니다/부족/필요 verbs, and caps
// at ~60 chars so each item reads as a scannable improvement bullet.
function condenseGap(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/^\[(규칙|LLM)\]\s*/i, "");
  const firstSentence = s.split(/\.\s+/)[0];
  if (firstSentence) s = firstSentence;
  s = s.replace(/(에 대한 추가적?인? 설명이 필요합니다|이 (부족|필요)합니다|합니다)\.?$/u, "");
  s = s.replace(/\.+$/u, "").trim();
  if (s.length > 60) s = s.slice(0, 58) + "…";
  return s;
}

/** Convert ProcessVerdict → legacy UI shape {ratings, summary, strengths, gaps}. */
export function toLegacyShape(v, skipped = []) {
  const ratings = (v.bps || []).map((b) => {
    const gaps = (b.gaps || []).map(koreanizeGap).map(condenseGap).filter(Boolean);
    const rationale = gaps.length
      ? `개선 필요 — ${gaps.slice(0, 3).join(" / ")}`
      : "특이 약점 없음";
    return {
      bp: b.id,
      rating: b.rating,
      rationale,
      evidence: (b.evidence || []).slice(0, 6).map((e) => {
        const base = e.location || e.artifactName || "";
        const loc = e.page != null
          ? (base ? `${base} · p.${e.page}` : `p.${e.page}`)
          : base;
        return { quote: e.quote || "", location: loc };
      }),
      pamCitation: b.pamCitation,
      contextConsistency: b.contextConsistency,
    };
  });
  const strong = (v.bps || []).filter((b) => b.scorePercent >= 68);
  const weak = (v.bps || []).filter((b) => b.scorePercent < 51);
  const skipNote = skipped.length
    ? ` · 스킵된 파일 ${skipped.length}개: ${skipped.map((s) => s.name).join(", ")}`
    : "";
  const fpNote = summarizeProjectFingerprint(v.projectFingerprint);
  const summary = `CL${v.capabilityLevel} — ${v.capabilityLevelReason ?? ""}${skipNote}${fpNote}`;
  return {
    ratings,
    summary,
    strengths: strong.map((b) => `${b.id} ${b.title}`).join(", ") || "—",
    gaps:
      weak
        .map((b) => `${b.id}: ${koreanizeGap(b.gaps?.[0]) ?? "부족"}`)
        .join("; ") || "—",
    projectFingerprint: v.projectFingerprint,
  };
}
