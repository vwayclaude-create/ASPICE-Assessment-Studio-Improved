import { useEffect, useRef, useState } from "react";
import { DEFAULT_ENGINES, normalizeEngines } from "../data/engineDefaults";

const PROJECT_ENDPOINT = "/api/project";

/**
 * Project-mode evaluation hook. Orchestrates a multi-file, multi-process
 * assessment and keeps the resulting ProjectVerdict in state.
 */
export const useProject = () => {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * @param {{artifacts: Array<{name,text?:string,base64?:string,mimeType?:string,sizeBytes?:number}>, processIds: string[], targetLevel?: 1|2|3, engines?: Array<"rule"|"llm"|"hybrid"|"custom">, engine?: "rule"|"llm"|"hybrid"|"custom", customRules?: object}} ctx
   *   `customRules` is the user's rule book; only sent (and only used by the
   *   server) when one of the selected engines is "custom".
   */
  const runProject = async ({ artifacts, processIds, targetLevel = 1, engines, engine, customRules }) => {
    const enginesList = normalizeEngines(engines ?? engine ?? DEFAULT_ENGINES);
    if (!artifacts?.length) {
      setError("프로젝트 증적 파일을 1개 이상 업로드하세요.");
      return null;
    }
    if (!processIds?.length) {
      setError("평가할 프로세스를 1개 이상 선택하세요.");
      return null;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError("");
    setVerdict(null);

    try {
      const engineLabel = enginesList.length > 1
        ? `${enginesList.length}개 엔진 평균`
        : enginesList[0];
      setPhase(`${processIds.length}개 프로세스 평가 중 (${engineLabel})`);
      const res = await fetch(PROJECT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifacts,
          processIds,
          targetLevel,
          engines: enginesList,
          ...(enginesList.includes("custom") && customRules ? { customRules } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API ${res.status}: ${txt.slice(0, 200)}`);
      }
      setPhase("Cross-process 검증 집계 중");
      const data = await res.json();
      setVerdict(data);
      setPhase("");
      return data;
    } catch (e) {
      if (e?.name === "AbortError" || controller.signal.aborted) {
        setPhase("");
        return null;
      }
      // "Failed to fetch" is a TypeError from the browser when the request
      // never reached the server (dev server crashed / restarted, request
      // aborted, or a hanging pdf-parse on a large/complex PDF). Surface a
      // hint instead of just the cryptic message so the user can act on it.
      const isNetwork = e instanceof TypeError && /failed to fetch/i.test(e.message);
      setError(
        isNetwork
          ? "프로젝트 평가 실패 — 서버 연결 끊김 (Failed to fetch). 개발 서버 재시작 후 페이지를 새로고침하거나, 큰 파일을 한 번에 한 개씩 업로드해 보세요."
          : `프로젝트 평가 실패 — ${e.message}`
      );
      setPhase("");
      return null;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRunning(false);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const clear = () => {
    cancel();
    setVerdict(null);
    setError("");
    setPhase("");
  };

  return { running, phase, verdict, error, runProject, cancel, clear };
};
