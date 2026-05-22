import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, extname } from "node:path";
import { Harness } from "../src/harness.js";
import { ruleScorer } from "../src/evaluators/ruleScorer.js";
import { indexArtifacts } from "../src/io/artifactIndex.js";
import { loadWorkProducts } from "../spec/canonical/index.js";
import { renderReport } from "../src/io/reporter.js";
import {
  computeCoverage,
  isRequirementId,
  REQUIREMENT_PREFIXES,
} from "../src/crossProcess/coverage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "fixtures", "project");

async function loadProjectFixture() {
  const files = await readdir(FIXTURE_DIR);
  const artifacts = await Promise.all(
    files
      .filter((f) => [".md", ".csv", ".txt"].includes(extname(f)))
      .map(async (f) => {
        const path = resolve(FIXTURE_DIR, f);
        const text = await readFile(path, "utf8");
        return { name: f, path, mimeType: "text/plain", text, sizeBytes: text.length };
      })
  );
  return indexArtifacts(artifacts, { wpCatalog: loadWorkProducts() });
}

test("project: artifactIndex tags WP candidates + extracts IDs", async () => {
  const artifacts = await loadProjectFixture();
  const srs = artifacts.find((a) => a.name === "system_srs.md");
  assert.ok(srs, "SRS fixture loaded");
  assert.ok(srs.wpidCandidates.length > 0, "SRS should have WPID candidates");
  assert.ok(srs.extractedIds.some((id) => /^REQ-SYS-/.test(id)),
    `expected REQ-SYS-* ids, got ${srs.extractedIds.join(",")}`);

  const cr = artifacts.find((a) => a.name === "change_request_042.md");
  assert.ok(cr.extractedIds.includes("CR-042"));
});

test("project: evaluateProject returns per-process verdicts + cross-process block", async () => {
  const artifacts = await loadProjectFixture();
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProject({
    artifacts,
    processIds: ["SYS.1", "SYS.2", "SYS.3", "SWE.1", "SYS.5", "SUP.10"],
  });

  assert.equal(verdict.processes.length, 6);
  assert.ok(verdict.crossProcess);
  assert.ok(verdict.crossProcess.graph.edges.length > 0, "graph should have edges (seed)");
  assert.equal(verdict.crossProcess.graph.source, "seed");
});

test("project: trace matrices report coverage for engineering edges", async () => {
  const artifacts = await loadProjectFixture();
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProject({
    artifacts,
    processIds: ["SYS.1", "SYS.2", "SYS.3", "SWE.1"],
  });
  const matrices = verdict.crossProcess.traceMatrices;
  assert.ok(matrices.length > 0, "some trace matrices should be computed");

  const sys2ToSwe1 = matrices.find((m) => m.sourceProcess === "SYS.2" && m.targetProcess === "SWE.1");
  assert.ok(sys2ToSwe1, "SYS.2 → SWE.1 trace matrix expected");
  assert.ok(sys2ToSwe1.sourceIds.length > 0, "SYS.2 source IDs populated");
  assert.ok(sys2ToSwe1.coveragePercent > 0, `expected positive coverage, got ${sys2ToSwe1.coveragePercent}%`);
});

test("project: trace matrices keep development-area edges only", async () => {
  const artifacts = await loadProjectFixture();
  const harness = new Harness({ scorer: ruleScorer, targetLevel: 1 });
  const verdict = await harness.evaluateProject({
    artifacts,
    processIds: ["MAN.3", "SUP.9", "SUP.10", "SYS.2", "SYS.3", "SYS.5", "SWE.1"],
  });
  const matrices = verdict.crossProcess.traceMatrices;
  // Only SYS/SWE/HWE/MLE edges belong to the development area. Management,
  // support, acquisition, supply, validation and reuse edges are excluded.
  const nonDev = matrices.filter(
    (m) =>
      /^(MAN|SUP|ACQ|SPL|VAL|REU)\./.test(m.sourceProcess) ||
      /^(MAN|SUP|ACQ|SPL|VAL|REU)\./.test(m.targetProcess)
  );
  assert.equal(
    nonDev.length,
    0,
    `trace matrix should be development-area-only, found: ${nonDev
      .map((m) => `${m.sourceProcess}→${m.targetProcess}`)
      .join(", ")}`
  );
});

test("project: changePropagation detects CR-042 references downstream", async () => {
  const artifacts = await loadProjectFixture();
  const harness = new Harness({ scorer: ruleScorer });
  const verdict = await harness.evaluateProject({
    artifacts,
    processIds: ["SUP.10", "SYS.3", "SYS.5", "SWE.1"],
  });
  const ch = verdict.crossProcess.changes;
  assert.equal(ch.summary.total, 1, "one CR in fixture");
  const r = ch.report.find((r) => r.crId === "CR-042");
  assert.ok(r, "CR-042 should be reported");
  assert.ok(r.impactedArtifactCount >= 2, `CR-042 referenced by multiple artifacts, got ${r.impactedArtifactCount}`);
  assert.ok(["propagated", "verification-only"].includes(r.status));
});

test("project: coverage finds REQ → TC links", async () => {
  const artifacts = await loadProjectFixture();
  const harness = new Harness({ scorer: ruleScorer });
  const verdict = await harness.evaluateProject({
    artifacts,
    processIds: ["SYS.2", "SYS.5"],
  });
  const cov = verdict.crossProcess.coverage;
  assert.ok(cov.totalRequirements > 0);
  assert.ok(cov.coveragePercent > 0, `coverage should be positive, got ${cov.coveragePercent}%`);
  // REQ-SYS-003 is deliberately uncovered in the fixture
  assert.ok(
    cov.uncovered.includes("REQ-SYS-003"),
    `REQ-SYS-003 should be flagged uncovered, got uncovered=${cov.uncovered.join(",")}`
  );
});

test("coverage: requirement allow-list filters non-requirement IDs", () => {
  // Three requirement IDs and three noise IDs (sequence number, version tag,
  // test case). The allow-list should keep only the first three.
  const wpCatalog = loadWorkProducts();
  const artifacts = indexArtifacts(
    [
      {
        name: "SRS.docx",
        text: "본 명세서의 요구사항: REQ-001, FR-014, IF-007. 시퀀스: SEQ-1, SEQ-2. 버전: BSD-OTA-VER-001. 테스트: TC-099.",
      },
      {
        name: "TestPlan.docx",
        text: "테스트 계획. 검증 측정 verification measure 항목: REQ-001, FR-014, SEQ-1.",
      },
    ],
    { wpCatalog }
  );
  const cov = computeCoverage(artifacts);
  assert.equal(cov.totalRequirements, 3, "only requirement-shaped IDs are counted");
  assert.ok(!cov.uncovered.includes("SEQ-1"), "SEQ-* dropped");
  assert.ok(!cov.uncovered.includes("BSD-OTA-VER-001"), "BSD-OTA-VER-* dropped");
  assert.ok(!cov.uncovered.includes("TC-099"), "TC-* dropped");
});

test("coverage: extraRequirementPrefixes lets projects extend the allow-list", () => {
  const wpCatalog = loadWorkProducts();
  const artifacts = indexArtifacts(
    [
      {
        name: "SRS.docx",
        text: "본 명세: PROJ-001, PROJ-002, PROJ-003. 외부 참조: SEQ-1.",
      },
      { name: "TestPlan.docx", text: "test plan: PROJ-001 검증 측정." },
    ],
    { wpCatalog }
  );
  // Without extra prefix: PROJ-* dropped → 0 requirements.
  assert.equal(computeCoverage(artifacts).totalRequirements, 0);
  // With extra prefix: PROJ-* kept → 3 requirements.
  const cov = computeCoverage(artifacts, { extraRequirementPrefixes: ["PROJ"] });
  assert.equal(cov.totalRequirements, 3);
  assert.equal(cov.coveredCount, 1, "only PROJ-001 referenced by test artifact");
});

test("coverage: isRequirementId classifier handles common prefixes", () => {
  assert.ok(isRequirementId("REQ-001"));
  assert.ok(isRequirementId("FR-001"));
  assert.ok(isRequirementId("NFR-001"));
  assert.ok(isRequirementId("IF-001"));
  assert.ok(isRequirementId("SYS-001"));
  assert.ok(isRequirementId("SW-014"));
  assert.ok(isRequirementId("REQ-SYS-101"));
  assert.ok(!isRequirementId("SEQ-1"));
  assert.ok(!isRequirementId("BSD-OTA-VER-001"));
  assert.ok(!isRequirementId("TC-099"));
  assert.ok(!isRequirementId("CR-042"));
  assert.ok(REQUIREMENT_PREFIXES.has("FUNC"));
  assert.ok(REQUIREMENT_PREFIXES.has("INTF"));
});

test("project: markdown rendering produces sections we expect", async () => {
  const artifacts = await loadProjectFixture();
  const harness = new Harness({ scorer: ruleScorer });
  const verdict = await harness.evaluateProject({
    artifacts,
    processIds: ["SYS.1", "SYS.2", "SYS.3", "SWE.1", "SYS.5", "SUP.10"],
  });
  const md = renderReport(verdict, "markdown");
  assert.match(md, /# ASPICE Project Assessment Report/);
  assert.match(md, /## Capability Summary/);
  assert.match(md, /## Cross-Process Verification/);
  assert.match(md, /### Traceability Matrix/);
  assert.match(md, /### Change Propagation/);
});
