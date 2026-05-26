import { useRef, useState } from "react";

import { T, FONTS } from "./theme";
import { ASPICE_DATA } from "./data/aspiceData";
import { getFormatByName, MAX_FILE_SIZE } from "./data/formats";
import { detectProcess } from "./data/detectRules";
import {
  SAMPLE_PROCESS_ID,
  SAMPLE_FILE_NAME,
  SAMPLE_FILE_SIZE,
  SAMPLE_RESULTS,
} from "./data/sampleReport";

import { useFontInjector } from "./hooks/useFontInjector";
import { useHistory, buildHistoryEntry } from "./hooks/useHistory";
import { useProjectHistory, buildProjectHistoryEntry } from "./hooks/useProjectHistory";
import { useAnalysis } from "./hooks/useAnalysis";
import { useProject } from "./hooks/useProject";
import { useCustomRules } from "./hooks/useCustomRules";

import { extractFileContent } from "./utils/fileReaders";
import { exportReportAsText, exportReportAsPdf } from "./utils/exportReport";
import { exportProjectReportAsPdf } from "./utils/exportProjectReport";
import { DEFAULT_ENGINES, ENGINE_IDS } from "./data/engineDefaults";

import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";
import { Stepper } from "./components/Stepper";
import { ProcessSidebar } from "./components/ProcessSidebar";
import { ProcessCard } from "./components/ProcessCard";
import { ImportCard } from "./components/ImportCard";
import { HistoryCard } from "./components/HistoryCard";
import { VerdictCard } from "./components/VerdictCard";
import { ConfirmModal } from "./components/ConfirmModal";
import { HelpButton } from "./components/HelpButton";
import { HelpModal } from "./components/HelpModal";
import { GlobalStyles } from "./components/GlobalStyles";
import { ProjectModeCard } from "./components/ProjectModeCard";
import { CustomRulesModal } from "./components/CustomRulesModal";
import { ProjectReportCard } from "./components/ProjectReportCard";
import { ProjectHistoryCard } from "./components/ProjectHistoryCard";
import { ModeToggle, MODE_PER_PROCESS, MODE_PROJECT } from "./components/ModeToggle";
import { UserMenu } from "./auth/UserMenu";
import { ProfileModal } from "./auth/ProfileModal";

const DEFAULT_PROCESS = "SYS.2";

export default function SolutionApp() {
  useFontInjector();

  const [mode, setMode] = useState(MODE_PER_PROCESS);

  // Per-process mode state — multi-file so the same evidence set the user
  // uploads here can also be sent to project mode and produce identical BPs.
  const [selectedProcess, setSelectedProcess] = useState(DEFAULT_PROCESS);
  const [processFiles, setProcessFiles] = useState([]);
  const [autoDetected, setAutoDetected] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Project mode state
  const [projectArtifacts, setProjectArtifacts] = useState([]);
  const [projectProcessIds, setProjectProcessIds] = useState([]);
  const [projectTargetLevel, setProjectTargetLevel] = useState(1);
  const [projectEngines, setProjectEngines] = useState(DEFAULT_ENGINES);
  const handleToggleEngine = (id) => {
    if (!ENGINE_IDS.includes(id)) return;
    setProjectEngines((prev) => {
      if (prev.includes(id)) {
        // Never let the user empty the list; keep the last engine pinned on.
        if (prev.length <= 1) return prev;
        return prev.filter((x) => x !== id);
      }
      // Preserve declaration order so "Rule, LLM, Hybrid, Custom" is stable.
      return ENGINE_IDS.filter((e) => prev.includes(e) || e === id);
    });
  };
  const [selectedProjectHistoryId, setSelectedProjectHistoryId] = useState(null);
  const [exportingProjectEntryId, setExportingProjectEntryId] = useState(null);
  const [customRulesOpen, setCustomRulesOpen] = useState(false);

  // Custom-scorer rule book — persisted in IndexedDB, shared by both modes.
  const customRules = useCustomRules();

  const { history, addEntry, removeEntry, clearAll } = useHistory();
  const {
    history: projectHistory,
    addEntry: addProjectHistoryEntry,
    removeEntry: removeProjectHistoryEntry,
    clearAll: clearProjectHistory,
  } = useProjectHistory();
  const {
    analyzing, phase, results, error,
    setResults, setError, runAnalysis, cancel: cancelAnalysis, clear: clearAnalysis,
  } = useAnalysis();
  const project = useProject();

  const reportRef = useRef(null);
  const projectReportRef = useRef(null);
  const proc = ASPICE_DATA[selectedProcess];
  const hasFile = processFiles.length > 0;
  const totalFileSize = processFiles.reduce((s, f) => s + (f.sizeBytes || 0), 0);
  const displayFileNameLocal = processFiles.length === 0
    ? ""
    : processFiles.length === 1
      ? processFiles[0].name
      : `${processFiles[0].name} 외 ${processFiles.length - 1}개`;

  const viewingHistory = selectedHistoryId ? history.find((h) => h.id === selectedHistoryId) : null;
  const displayResults  = viewingHistory ? viewingHistory.results : results;
  const displayProc     = viewingHistory ? (ASPICE_DATA[viewingHistory.processId] || proc) : proc;
  const displayFileName = viewingHistory ? viewingHistory.fileName : displayFileNameLocal;
  const displayDate     = viewingHistory ? new Date(viewingHistory.date) : new Date();

  const handleProcessSelect = (id) => {
    setSelectedProcess(id);
    setResults(null);
    setSelectedHistoryId(null);
    setAutoDetected(null);
  };

  const handleFilesChange = async (e) => {
    const incoming = [...(e.target.files || [])];
    if (!incoming.length) return;
    const accepted = [];
    const rejected = [];
    for (const f of incoming) {
      const fmt = getFormatByName(f.name);
      if (!fmt) { rejected.push(`${f.name} (형식)`); continue; }
      if (f.size > MAX_FILE_SIZE) { rejected.push(`${f.name} (30MB 초과)`); continue; }
      const { b64, text } = await extractFileContent(f, fmt.mode);
      accepted.push({
        name: f.name,
        sizeBytes: f.size,
        mimeType: fmt.mode === "pdf" ? "application/pdf" : (fmt.mediaType || "text/plain"),
        base64: b64 || undefined,
        text: text || undefined,
      });
    }
    if (rejected.length) {
      setError(`스킵된 파일: ${rejected.join(", ")}. 지원 형식: PDF, DOC, DOCX, XLSX, MD`);
    } else {
      setError("");
    }
    if (!accepted.length) return;

    setProcessFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      for (const a of accepted) byName.set(a.name, a);
      return [...byName.values()];
    });
    setResults(null);
    setSelectedHistoryId(null);

    // Auto-detect from the first accepted file (matches prior single-file behavior).
    const detected = detectProcess(accepted[0].name);
    if (detected) {
      setSelectedProcess(detected);
      setAutoDetected(detected);
    } else {
      setAutoDetected(null);
    }
  };

  const handleRemoveFile = (name) => {
    setProcessFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleReset = () => {
    setProcessFiles([]);
    setAutoDetected(null);
    setSelectedHistoryId(null);
    clearAnalysis();
  };

  const handleLoadSample = () => {
    setSelectedProcess(SAMPLE_PROCESS_ID);
    setResults(SAMPLE_RESULTS);
    setProcessFiles([{ name: SAMPLE_FILE_NAME, sizeBytes: SAMPLE_FILE_SIZE, text: "" }]);
    setError("");
    setSelectedHistoryId(null);
  };

  const handleAnalyzeClick = () => {
    if (!hasFile) {
      setError("먼저 증적 문서를 업로드하세요.");
      return;
    }
    setShowConfirm(true);
  };

  const handleRunAnalysis = async () => {
    setShowConfirm(false);
    setSelectedHistoryId(null);
    const parsed = await runAnalysis({
      proc,
      artifacts: processFiles,
      engines: projectEngines, // share the same scorer selection as project mode
      customRules: customRules.ruleBook,
      targetLevel: projectTargetLevel,
    });
    if (parsed) {
      addEntry(buildHistoryEntry({
        proc,
        fileName: displayFileNameLocal,
        fileSize: totalFileSize,
        results: parsed,
      }));
    }
  };

  const handleHistoryToggle = (id) => {
    const willOpen = selectedHistoryId !== id;
    setSelectedHistoryId(willOpen ? id : null);
    if (willOpen) {
      setTimeout(() => {
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const handleHistoryDelete = (id) => {
    if (!confirm("이 분석 이력을 삭제하시겠습니까?")) return;
    removeEntry(id);
    if (selectedHistoryId === id) setSelectedHistoryId(null);
  };

  const handleHistoryClearAll = () => {
    if (!confirm("모든 분석 이력을 삭제하시겠습니까?")) return;
    clearAll();
    setSelectedHistoryId(null);
  };

  const handleExportPdf = async () => {
    if (!displayResults || !reportRef.current) return;
    setExporting(true);
    try {
      await exportReportAsPdf({ proc: displayProc, node: reportRef.current });
    } catch (e) {
      setError(`PDF 생성 실패 — ${e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportTxt = () => {
    if (!displayResults) return;
    exportReportAsText({
      proc: displayProc,
      results: displayResults,
      fileName: displayFileName,
      date: displayDate,
    });
  };

  // Project-mode handlers
  const handleAddArtifacts = (arts) => {
    setProjectArtifacts((prev) => {
      const byName = new Map(prev.map((a) => [a.name, a]));
      for (const a of arts) byName.set(a.name, a);
      return [...byName.values()];
    });
  };
  const handleRemoveArtifact = (name) =>
    setProjectArtifacts((prev) => prev.filter((a) => a.name !== name));
  const handleClearArtifacts = () => setProjectArtifacts([]);
  const handleToggleProcess = (id) =>
    setProjectProcessIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const handleSelectAllProcesses = () => setProjectProcessIds(Object.keys(ASPICE_DATA));
  const handleClearProcesses = () => setProjectProcessIds([]);
  const handleToggleGroupProcesses = (groupIds, select) =>
    setProjectProcessIds((prev) => {
      if (select) return [...new Set([...prev, ...groupIds])];
      const drop = new Set(groupIds);
      return prev.filter((x) => !drop.has(x));
    });

  const handleRunProject = async () => {
    setSelectedProjectHistoryId(null);
    const verdict = await project.runProject({
      artifacts: projectArtifacts,
      processIds: projectProcessIds,
      targetLevel: projectTargetLevel,
      engines: projectEngines,
      customRules: customRules.ruleBook,
    });
    if (verdict) {
      addProjectHistoryEntry(buildProjectHistoryEntry({
        verdict,
        artifacts: projectArtifacts,
        processIds: projectProcessIds,
        targetLevel: projectTargetLevel,
        engines: projectEngines,
      }));
    }
  };

  const handleProjectHistoryToggle = (id) => {
    const willOpen = selectedProjectHistoryId !== id;
    setSelectedProjectHistoryId(willOpen ? id : null);
    if (willOpen) {
      setTimeout(() => {
        projectReportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  const handleProjectHistoryDelete = (id) => {
    if (!confirm("이 프로젝트 평가 이력을 삭제하시겠습니까?")) return;
    removeProjectHistoryEntry(id);
    if (selectedProjectHistoryId === id) setSelectedProjectHistoryId(null);
  };

  const handleProjectHistoryClearAll = () => {
    if (!confirm("모든 프로젝트 평가 이력을 삭제하시겠습니까?")) return;
    clearProjectHistory();
    setSelectedProjectHistoryId(null);
  };

  const handleExportProjectEntryPdf = async (entry) => {
    if (!entry?.verdict) {
      alert("PDF로 내보낼 verdict 데이터가 비어있습니다.");
      return;
    }
    setExportingProjectEntryId(entry.id);
    try {
      await exportProjectReportAsPdf({ verdict: entry.verdict, entry });
    } catch (e) {
      alert(`PDF 생성 실패: ${e.message || e}`);
    } finally {
      setExportingProjectEntryId(null);
    }
  };

  const viewingProjectHistory = selectedProjectHistoryId
    ? projectHistory.find((h) => h.id === selectedProjectHistoryId)
    : null;
  const displayProjectVerdict = viewingProjectHistory ? viewingProjectHistory.verdict : project.verdict;

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bgGrad,
      fontFamily: FONTS.sans,
      color: T.textHi,
      padding: "40px 24px 96px",
      letterSpacing: "-0.005em",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <AppHeader
          topLeftSlot={<HelpButton onClick={() => setHelpOpen(true)} />}
          topRightSlot={<UserMenu onOpenProfile={() => setProfileOpen(true)} />}
        />

        <ModeToggle mode={mode} onChange={setMode} />

        {mode === MODE_PER_PROCESS && (
          <>
            <Stepper hasFile={hasFile} analyzing={analyzing} hasResults={!!results} />

            <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 360px) 1fr", gap: 28 }}>
              <ProcessSidebar
                selectedProcess={selectedProcess}
                onSelect={handleProcessSelect}
              />

              <main>
                <ProcessCard proc={proc} />

                <ImportCard
                  files={processFiles}
                  hasFile={hasFile}
                  autoDetected={autoDetected}
                  analyzing={analyzing}
                  phase={phase}
                  error={error}
                  showReset={hasFile || !!results}
                  engines={projectEngines}
                  onFilesChange={handleFilesChange}
                  onRemoveFile={handleRemoveFile}
                  onAnalyzeClick={handleAnalyzeClick}
                  onCancelClick={cancelAnalysis}
                  onSampleClick={handleLoadSample}
                  onResetClick={handleReset}
                />

                <HistoryCard
                  history={history}
                  selectedHistoryId={selectedHistoryId}
                  onToggleView={handleHistoryToggle}
                  onDeleteEntry={handleHistoryDelete}
                  onClearAll={handleHistoryClearAll}
                />

                {displayResults && (
                  <VerdictCard
                    ref={reportRef}
                    proc={displayProc}
                    results={displayResults}
                    fileName={displayFileName}
                    date={displayDate}
                    viewingHistory={!!viewingHistory}
                    exporting={exporting}
                    onExportPdf={handleExportPdf}
                    onExportTxt={handleExportTxt}
                  />
                )}

                <AppFooter />
              </main>
            </div>
          </>
        )}

        {mode === MODE_PROJECT && (
          <main style={{ marginTop: 20 }}>
            <ProjectModeCard
              artifacts={projectArtifacts}
              onAddArtifacts={handleAddArtifacts}
              onRemoveArtifact={handleRemoveArtifact}
              onClearArtifacts={handleClearArtifacts}
              processIds={projectProcessIds}
              onToggleProcess={handleToggleProcess}
              onSelectAllProcesses={handleSelectAllProcesses}
              onClearProcesses={handleClearProcesses}
              onToggleGroupProcesses={handleToggleGroupProcesses}
              targetLevel={projectTargetLevel}
              onChangeLevel={setProjectTargetLevel}
              engines={projectEngines}
              onToggleEngine={handleToggleEngine}
              customRuleStats={{
                enabled: customRules.ruleBook.rules.filter((r) => r.enabled).length,
                total: customRules.ruleBook.rules.length,
                customBPs: (customRules.ruleBook.customBPs || []).length,
              }}
              onEditCustomRules={() => setCustomRulesOpen(true)}
              running={project.running}
              phase={project.phase}
              error={project.error}
              onRun={handleRunProject}
              onCancel={project.cancel}
            />
            {displayProjectVerdict && (
              <div ref={projectReportRef}>
                {viewingProjectHistory && (
                  <div style={{
                    background: T.accentSoft,
                    border: `1px solid ${T.accent}`,
                    borderRadius: 6,
                    padding: "10px 14px",
                    marginBottom: 12,
                    fontSize: 12,
                    color: T.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}>
                    <span>
                      과거 이력 보기 — {new Date(viewingProjectHistory.date).toLocaleString("ko-KR")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProjectHistoryId(null)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${T.accent}`,
                        color: T.accent,
                        padding: "4px 12px",
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >현재 결과로 돌아가기</button>
                  </div>
                )}
                <ProjectReportCard
                  verdict={displayProjectVerdict}
                  onClose={() => {
                    if (viewingProjectHistory) {
                      setSelectedProjectHistoryId(null);
                    } else {
                      project.clear();
                    }
                  }}
                />
              </div>
            )}
            <ProjectHistoryCard
              history={projectHistory}
              selectedHistoryId={selectedProjectHistoryId}
              onToggleView={handleProjectHistoryToggle}
              onDeleteEntry={handleProjectHistoryDelete}
              onClearAll={handleProjectHistoryClearAll}
              onExportEntryPdf={handleExportProjectEntryPdf}
              exportingEntryId={exportingProjectEntryId}
            />
            <AppFooter />
          </main>
        )}
      </div>

      <GlobalStyles />

      {showConfirm && (
        <ConfirmModal
          proc={proc}
          fileName={displayFileNameLocal}
          fileSize={totalFileSize}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleRunAnalysis}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      {customRulesOpen && (
        <CustomRulesModal
          ruleBook={customRules.ruleBook}
          addRule={customRules.addRule}
          updateRule={customRules.updateRule}
          toggleRule={customRules.toggleRule}
          deleteRule={customRules.deleteRule}
          setUseAutoFallback={customRules.setUseAutoFallback}
          replaceRuleBook={customRules.replaceRuleBook}
          resetToDefaults={customRules.resetToDefaults}
          addCustomBP={customRules.addCustomBP}
          updateCustomBP={customRules.updateCustomBP}
          deleteCustomBP={customRules.deleteCustomBP}
          onClose={() => setCustomRulesOpen(false)}
        />
      )}
    </div>
  );
}
