# QA Audit 모드 1단계 — 체크리스트 입력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VWAY 산출물·프로세스 체크리스트 Excel을 가져와 검증하고, AI 판정 기준 초안을 QA가 확정해 버전별로 저장하는 QA Audit 모드 "체크리스트" 화면을 만든다.

**Architecture:** 엑셀 파싱·검증·버전 병합·초안 응답 정제는 브라우저와 Node 양쪽에서 쓰는 순수 함수로 `packages/harness/src/qa/`에 둔다(`aspice-harness/qa`로 export, `node:fs` 금지). AI 초안은 새 서버 엔드포인트 `/api/qa-draft`가 기존 LLM 클라이언트로 만든다. 프런트는 `src/components/qa/`와 `src/hooks/useQaChecklist.js`(IndexedDB)로 구성하고, 기존 두 모드 코드 경로는 건드리지 않는다.

**Tech Stack:** React 19 + Vite 8(JSX, `src/theme.js` 인라인 스타일, lucide-react), `xlsx@0.18.5`, Node 20 `node:test`, Vercel 함수.

**Spec:** `docs/superpowers/specs/2026-10-27-qa-audit-checklist-import-design.md` (이하 "스펙"; 절 번호로 참조)

## Global Constraints

- VWAY 템플릿 두 종만 지원. 임의 열 매핑 화면 없음.
- `packages/harness/src/qa/**`는 `node:fs`·`node:path` 등 Node 전용 모듈을 import하지 않는다(브라우저에서도 import됨). BP 목록은 `processes` 배열을 인자로 받는다(Node 테스트: `loadProcesses()`, 브라우저: `import { processes } from "aspice-harness/spec/all"`).
- 엑셀 원문(체크 ID, 영역, 검토 항목, 프로세스 이름, 단계)은 어떤 코드에서도 수정하지 않는다.
- 판정에 쓰는 것은 `status === "confirmed"` 항목의 `confirmed`뿐. `draft`는 판정 입력이 아니다.
- IndexedDB 키: `aspice_qa_checklists` 하나(`{ activeVersionId, versions, mappingOverrides }`). PC당 한 세트 공유, 사용자별 분리 없음.
- 사내 프로세스 ID `VWAY.PR`(이름 "산출물 동료 검토"), 관련 BP 0개로 확정 허용.
- 심각도 값: `"상" | "중" | "하"`, 잘못된 값은 `"중"`. 상태 값: `"pending" | "drafted" | "confirmed" | "stale"`.
- AI 초안 배치 20개, 동시 LLM 호출 5(기존 `ASPICE_LLM_CONCURRENCY` 기본값과 동일).
- 기존 프로세스 모드·프로젝트 모드 동작 불변. 기존 엔진 ID 목록(4곳)은 1단계에서 건드리지 않는다.
- UI 문구는 한국어, 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **엉뚱한 파일을 넣음** (프로세스 체크리스트를 산출물 칸에 넣거나 그 반대) → 크래시 없이 "형식이 맞지 않음" 오류 한 줄, 기존 활성 버전 유지. Task 2·3에 테스트 추가.
2. **같은 파일을 그대로 다시 가져옴** → 새 버전이 생기되 모든 항목이 상태 그대로 이어지고 변경 0건, stale 0건. Task 5에 테스트 추가.
3. **LLM이 한 배치에서 깨진 JSON을 돌려줌** → 그 배치 항목만 실패 표시, 다른 배치 결과는 반영. Task 6에 테스트 추가.
4. **QA가 판정 기준을 모두 지우거나 BP를 다른 프로세스 것으로 잘못 입력** → 확정 버튼 비활성과 이유 표시. Task 4 `canConfirm` 테스트로 고정.
5. **빈 시트(헤더만 있음)·빈 행이 섞인 시트** → 항목 0건, 오류가 아닌 경고 한 줄. Task 2에 테스트 추가.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `packages/harness/src/qa/processNameMap.js` | 시트 이름·프로세스 한글 이름 → 프로세스 ID, BP 목록 조회 |
| `packages/harness/src/qa/readWorkbook.js` | ArrayBuffer/Buffer → `{ sheets: [{ name, rows }] }` (xlsx) |
| `packages/harness/src/qa/importWpChecklist.js` | 산출물 체크리스트 시트 → `WpCheckItem[]` + issues |
| `packages/harness/src/qa/importProcessChecklist.js` | `양식` 시트 → `ProcessCheckItem[]` + issues |
| `packages/harness/src/qa/confirm.js` | 확정 조건(스펙 6.2), 확정/확정 취소 상태 전이 |
| `packages/harness/src/qa/mergeVersion.js` | 새 버전 생성·이어받기·연결 재검사(스펙 6.4) |
| `packages/harness/src/qa/draft.js` | 초안 프롬프트, 응답 정제, 배치 실행 |
| `packages/harness/src/qa/index.js` | 위 모듈 re-export |
| `api/_qaDraftService.js`, `api/qa-draft.js` | `/api/qa-draft` 서버 처리 |
| `src/hooks/useQaChecklist.js` | IndexedDB 상태, 가져오기·확정·버전 조작 |
| `src/components/qa/*.jsx` | QaAuditView, ChecklistImportPanel, ChecklistItemTable, ChecklistItemEditor, ChecklistVersionList |
| `packages/harness/test/fixtures/qa/*.xlsx` | 실제 VWAY 엑셀을 줄인 사본 |

---

### Task 1: 프로세스 대응표와 BP 목록

**Files:**
- Create: `packages/harness/src/qa/processNameMap.js`, `packages/harness/src/qa/index.js`
- Modify: `packages/harness/package.json` (`exports`에 `"./qa": "./src/qa/index.js"` 추가)
- Test: `packages/harness/test/qaProcessNameMap.test.js`

**Interfaces:**
- Produces:
  - `VWAY_PR = "VWAY.PR"`
  - `normalizeName(s: string): string` — 앞 번호(`/^\s*\d+\.\s*/`) 제거 후 모든 공백 제거.
  - `processIdForSheet(sheetName: string, overrides?: Record<string,string>): string|null` — overrides는 **원본 시트 이름 전체**를 키로 먼저 조회.
  - `processIdForProcessName(name: string, overrides?: Record<string,string>): string|null`
  - `bpCatalog(processes: object[], processId: string): {id: string, title: string, description: string}[]` — id는 `"MAN.3.BP1"` 형식(spec JSON의 `"BP1"`에 프로세스 ID 접두). `VWAY.PR`·없는 ID → `[]`.
  - `isValidBpId(processes, bpId: string): boolean`

- [ ] **Step 1: 테스트 작성** — 스펙 3.1·3.2 대응표 전부를 표 기반 테스트로 고정한다.

```js
import { loadProcesses } from "../spec/canonical/index.js";
const P = loadProcesses();
test("sheet names map per spec 3.1", () => {
  assert.equal(processIdForSheet("1.프로젝트계획서"), "MAN.3");
  assert.equal(processIdForSheet("2.동료검토 계획서"), "VWAY.PR");
  assert.equal(processIdForSheet("7.위험관리 계획서"), "MAN.5");
  assert.equal(processIdForSheet("20. 소프트웨어 컴포너트 테스트 및 통합 테스트 케이스"), "SWE.5");
  assert.equal(processIdForSheet("22. 소프트웨어 요구사항 테스트 케이스 "), "SWE.6");
  assert.equal(processIdForSheet("22. 소프트웨어 소스코드"), "SWE.3");
  assert.equal(processIdForSheet("99. 모르는 시트"), null);
  assert.equal(processIdForSheet("99. 모르는 시트", { "99. 모르는 시트": "SUP.1" }), "SUP.1");
});
test("process names map per spec 3.2", () => {
  assert.equal(processIdForProcessName("소프트웨어 단위 검증"), "SWE.4");
  assert.equal(processIdForProcessName("산출물 동료 검토"), "VWAY.PR");
  assert.equal(processIdForProcessName("변경요청 관리"), "SUP.10"); // 공백 차이 무시
  assert.equal(processIdForProcessName("없는 프로세스"), null);
});
test("bpCatalog prefixes ids and handles VWAY.PR", () => {
  assert.equal(bpCatalog(P, "MAN.3")[0].id, "MAN.3.BP1");
  assert.deepEqual(bpCatalog(P, "VWAY.PR"), []);
  assert.equal(isValidBpId(P, "MAN.3.BP5"), true);
  assert.equal(isValidBpId(P, "MAN.3.BP99"), false);
});
```

스펙 3.1·3.2 표의 나머지 행도 같은 방식으로 한 줄씩 추가한다.

- [ ] **Step 2: 실패 확인** — `npm test --workspace aspice-harness` → `qaProcessNameMap` FAIL(모듈 없음).
- [ ] **Step 3: 구현** — 대응표는 `normalizeName`한 키 → ID의 객체 두 개. 시트 대응 시 "컴포넌트"/"컴포너트" 두 표기를 모두 키로 넣는다.
- [ ] **Step 4: 통과 확인** — 같은 명령, 전체 PASS.
- [ ] **Step 5: 커밋** — `feat(qa): 체크리스트 프로세스 대응표와 BP 목록`

### Task 2: 엑셀 읽기 + 산출물 체크리스트 가져오기 (+ 테스트 픽스처)

**Files:**
- Create: `packages/harness/src/qa/readWorkbook.js`, `packages/harness/src/qa/importWpChecklist.js`
- Create: `packages/harness/test/fixtures/qa/wp_checklist.xlsx`, `packages/harness/test/fixtures/qa/process_checklist.xlsx`
- Test: `packages/harness/test/qaImportWp.test.js`

**Interfaces:**
- Consumes: Task 1 `processIdForSheet`, `normalizeName`
- Produces:
  - `readWorkbook(data: ArrayBuffer|Uint8Array): { sheets: { name: string, rows: any[][] }[] }` — `XLSX.read(data, {type: "array"})`, 각 시트 `sheet_to_json(ws, {header: 1, defval: "", blankrows: true})`. 행 번호 = 배열 index + `!ref` 시작 행.
  - `Issue = { level: "error"|"warning", file: string, sheet: string, row: number|null, message: string }`
  - `importWpChecklist(book, { fileName, sheetOverrides? }): { items: WpCheckItem[], issues: Issue[], sheetNames: string[] }` — `WpCheckItem` 필드는 스펙 6절 그대로. 새 항목은 `draft: null, confirmed: null, status: "pending", customRuleIds: []`.

- [ ] **Step 1: 픽스처 만들기** — 일회성 Node 스크립트(스크래치패드, 커밋하지 않음)로 원본 두 파일(스펙 10절 경로)을 읽어 줄인 사본을 쓴다. `XLSX.utils.book_new` + 원본 시트 객체에서 행만 잘라 `aoa_to_sheet`, `!merges`는 남는 범위 안의 것만 복사.
  - `wp_checklist.xlsx`: `1.프로젝트계획서`(1·2행 헤더 + 데이터 6행, 그중 한 행 `col06`을 `"준수성 "`로), `22. 소프트웨어 요구사항 테스트 케이스 `(헤더 + 3행), `22. 소프트웨어 소스코드`(헤더 + 3행), `99. 헤더만`(1·2행만), 그리고 데이터 사이에 빈 행 2개.
  - `process_checklist.xlsx`: `표지`, `개정이력`, `양식`(1~3행 헤더·병합 그대로, `시스템 요구사항 분석` 6행 — 첫 행 ID `QA-XXX-001`, `프로젝트 관리` 3행, `산출물 동료 검토` 2행, `없는 프로세스` 1행, 빈 행 1개, 합계 행 1개).
- [ ] **Step 2: 테스트 작성**

```js
const book = readWorkbook(readFileSync(fx("wp_checklist.xlsx")));
const r = importWpChecklist(book, { fileName: "wp_checklist.xlsx" });
test("reads items by codebeamer field row, skips blank rows", () => {
  const pp = r.items.filter(i => i.sheet === "1.프로젝트계획서");
  assert.equal(pp.length, 6);
  assert.deepEqual(Object.keys(pp[0]).sort(), [/* 스펙 6절 WpCheckItem 키 */].sort());
  assert.equal(pp[0].processId, "MAN.3");
  assert.equal(pp[0].workProduct, "프로젝트계획서");
  assert.equal(pp[0].status, "pending");
});
test("trims area", () => assert.ok(r.items.some(i => i.area === "준수성")));
test("two '22.' sheets map to different processes", () => {
  assert.ok(r.items.some(i => i.sheet.startsWith("22. 소프트웨어 요구사항") && i.processId === "SWE.6"));
  assert.ok(r.items.some(i => i.sheet === "22. 소프트웨어 소스코드" && i.processId === "SWE.3"));
});
test("header-only sheet → warning, no items", () => {
  assert.ok(r.issues.some(x => x.sheet === "99. 헤더만" && x.level === "warning"));
});
test("process checklist in wp slot → single format error, no items", () => {
  const bad = importWpChecklist(readWorkbook(readFileSync(fx("process_checklist.xlsx"))), { fileName: "p.xlsx" });
  assert.equal(bad.items.length, 0);
  assert.ok(bad.issues.some(x => x.level === "error" && /형식/.test(x.message)));
});
```

인라인 시트(`{ sheets: [{ name, rows }] }` 직접 구성)로 추가: 체크 ID 중복 → 두 번째 행 error, 체크 ID 빈칸 → error, 검토 항목 빈칸 → error, 대응표에 없는 시트 → warning "프로세스 지정 필요" + `processId: null`, `col35 = "N"` → `applicable: false`.
- [ ] **Step 3: 실패 확인** — `npm test --workspace aspice-harness`, 새 테스트 FAIL.
- [ ] **Step 4: 구현** — 1행에서 `item_id`·`item_title` 열 위치를 찾는다. 하나라도 없으면 그 시트는 error 한 줄. 모든 시트가 그렇다면 error 메시지를 "산출물 체크리스트 형식이 아닙니다"로 한 줄만 낸다.
- [ ] **Step 5: 통과 확인 후 커밋** — `feat(qa): 산출물 체크리스트 엑셀 가져오기`

### Task 3: 프로세스 체크리스트 가져오기

**Files:**
- Create: `packages/harness/src/qa/importProcessChecklist.js`
- Test: `packages/harness/test/qaImportProcess.test.js`

**Interfaces:**
- Consumes: Task 1 `processIdForProcessName`, Task 2 `readWorkbook`, `Issue`
- Produces: `importProcessChecklist(book, { fileName, processNameOverrides? }): { items: ProcessCheckItem[], issues: Issue[], sheetNames: ["양식"] }` — 새 항목 `draft: null, confirmed: null, status: "pending"`. `excelId` 필드(엑셀 A열 원문, 자리표시자면 `null`)를 추가로 둔다(Task 5 대체 매칭용).

- [ ] **Step 1: 테스트 작성**

```js
test("reads 양식 only, skips header/blank/total rows", () => {
  assert.equal(r.items.length, 6 + 3 + 2 + 1);
  assert.ok(!r.items.some(i => /준수율/.test(i.question)));
});
test("auto ids per process, placeholder ignored", () => {
  const sys2 = r.items.filter(i => i.processId === "SYS.2");
  assert.deepEqual(sys2.map(i => i.itemId).slice(0, 2), ["QA-SYS.2-001", "QA-SYS.2-002"]);
  assert.equal(sys2[0].excelId, null);
});
test("phase from 비고, judgement/score columns not imported", () => {
  assert.equal(r.items[0].phase, "분석");
  assert.ok(!("score" in r.items[0]) && !("judgement" in r.items[0]));
});
test("unknown process name → error, processId null", () => {
  assert.ok(r.issues.some(x => x.level === "error" && /없는 프로세스/.test(x.message)));
});
test("VWAY.PR mapped", () => assert.ok(r.items.some(i => i.processId === "VWAY.PR")));
test("wp checklist in process slot → single format error", () => { /* Task 2와 대칭 */ });
```

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 헤더 행 = B열이 `"프로세스"`인 첫 행, 데이터는 그 +2행부터. 합계 행 = F열 `"프로세스 준수율"`. 자리표시자 판정: `/X{2,}/i`.
- [ ] **Step 4: 통과 확인 후 커밋** — `feat(qa): 프로세스 체크리스트 엑셀 가져오기`

### Task 4: 확정 조건과 상태 전이

**Files:**
- Create: `packages/harness/src/qa/confirm.js`
- Test: `packages/harness/test/qaConfirm.test.js`

**Interfaces:**
- Consumes: Task 1 `isValidBpId`, `VWAY_PR`
- Produces:
  - `canConfirmWp(item, criteria: WpCriteria, processes): { ok: boolean, reasons: string[], warnings: string[] }`
  - `canConfirmProcess(item, criteria: ProcCriteria, { processes, wpCheckIds: Set<string> }): { ok, reasons, warnings }`
  - `confirmItem(item, criteria, { user: string, now: string }): item` — 새 객체 반환. `confirmed = criteria`, `status = "confirmed"`, `confirmedBy`, `confirmedAt`.
  - `unconfirmItem(item): item` — `status = item.draft ? "drafted" : "pending"`, `confirmed = null`.

- [ ] **Step 1: 테스트 작성** — 스펙 6.2를 그대로 옮긴다.
  - 산출물: 기준 0개 → `ok:false`, 이유 "판정 기준"; 기준 텍스트 공백만 → 0개로 취급; BP `"SYS.2.BP1"`(유효하지만 다른 프로세스) → 허용(스펙 8.2 "다른 프로세스 BP도 추가 가능"); BP `"MAN.3.BP99"` → `ok:false`; 심각도 `"높음"` → `ok:false`; `processId: null` → `ok:false`; `targetLocations: []` → `ok:true` + warning 1개; VWAY.PR + BP 0개 → `ok:true`.
  - 프로세스: 연결 0개 → `ok:false`; 연결 ID가 `wpCheckIds`에 없음 → `ok:false`(이유에 그 ID 포함); 연결된 산출물 항목이 미확정이어도 `ok:true`.
  - `confirmItem` 후 원문 필드(`question`, `checkId`, `area`)가 그대로인지 확인; `unconfirmItem`은 draft 유무에 따라 상태 결정.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인 후 커밋** — `feat(qa): 체크 항목 확정 조건`

### Task 5: 버전 병합

**Files:**
- Create: `packages/harness/src/qa/mergeVersion.js`
- Test: `packages/harness/test/qaMergeVersion.test.js`

**Interfaces:**
- Consumes: Task 2·3 결과 형태, Task 1 대응 함수
- Produces:
  - `buildVersion({ prev: ChecklistVersion|null, wp: ImportResult|null, process: ImportResult|null, mappingOverrides, now, user }): { version: ChecklistVersion, summary: MergeSummary }`
    - `wp`/`process` 중 `null`인 쪽은 `prev`의 항목을 그대로 복사한다(스펙 6.4 마지막 문단). 둘 다 `null`이면 throw.
    - `version.id`는 `crypto.randomUUID()`(브라우저·Node 20 공용 전역), `version.version = (prev?.version ?? 0) + 1`.
  - `MergeSummary = { wp: Counts, process: Counts }`, `Counts = { carried, stale, added, removed }`
  - `relinkCheck(version): version` — 스펙 6.4 4번. 확정된 프로세스 항목의 연결 중 없는 ID나 stale 산출물 항목이 있으면 그 항목을 `stale`로 바꾼다. 연결 배열은 수정하지 않는다.
  - `missingLinks(version, processItem): string[]` — 화면 "없는 항목" 표시용.

`mappingOverrides`는 import 단계(Task 2·3의 `sheetOverrides`/`processNameOverrides`)에서 이미 적용된다. 그래서 이 함수에는 버전 메타 기록용으로만 넘긴다. 호출 순서는 Task 7 훅이 지킨다: overrides로 import → `buildVersion` → (`buildVersion` 내부에서) `relinkCheck`.

- [ ] **Step 1: 테스트 작성**
  - 산출물: 같은 checkId·같은 question → `confirmed`·`status` 이어받음(`carried`); question 변경 → `status:"stale"`, `confirmed`는 복사(`stale`); 새 checkId → `pending`(`added`); 사라진 checkId → `removed` 1.
  - 프로세스: (processId, question) 일치 → carried. 문장이 바뀌었지만 `excelId`가 같음 → stale. `excelId`도 없지만 같은 processId 안 순번이 같음 → stale. 순번 범위 밖 → added/removed.
  - 연결 재검사: 확정 프로세스 항목이 사라진 `CH-PP-099`에 연결 → `stale`, `linkedWpCheckIds`에 `CH-PP-099` 그대로, `missingLinks` → `["CH-PP-099"]`. 연결된 산출물 항목이 stale → 프로세스 항목도 stale.
  - 한 파일만: `process: null`이면 프로세스 항목이 `prev`와 deepEqual(재검사로 stale 된 항목만 제외).
  - **Review Focus 2:** 같은 import 결과로 두 번 `buildVersion` → summary `{carried: n, stale: 0, added: 0, removed: 0}`, 모든 status 동일.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 대체 매칭 순서는 스펙 6.4 병합 3번(원문 → excelId → 순번). 이미 매칭된 이전 항목은 다시 쓰지 않는다.
- [ ] **Step 4: 통과 확인 후 커밋** — `feat(qa): 체크리스트 버전 병합과 연결 재검사`

### Task 6: AI 초안 — 프롬프트, 응답 정제, 배치 실행

**Files:**
- Create: `packages/harness/src/qa/draft.js`
- Test: `packages/harness/test/qaDraft.test.js`

**Interfaces:**
- Consumes: Task 1 `bpCatalog`, `isValidBpId`; LLM 클라이언트 형태 `{ generateJson({system, context, task}) → Promise<{parsed}> }` (`packages/harness/src/llm/anthropic.js`)
- Produces:
  - `wpCandidatesFor(version, processId, processes): {checkId, workProduct, question}[]` — 스펙 7.3 후보 규칙.
  - `buildWpDraftPrompt({ workProduct, processId, bps, items }): {system, context, task}`
  - `buildProcessDraftPrompt({ processId, bps, items, candidates }): {system, context, task}`
  - `sanitizeWpDraft(raw, { processes }): WpCriteria & { rationale } | null` — 기준 0개면 `null`. 기준 `id`는 `${checkId}-${n}`로 다시 매긴다. polarity가 `"negative"`가 아니면 `"positive"`.
  - `sanitizeProcessDraft(raw, { processes, candidateIds: Set }): ProcCriteria & { rationale }` — `aggregation: "default"` 고정.
  - `generateDrafts({ client, kind: "wp"|"process", groups, processes, batchSize = 20 }): Promise<{ results: Record<string, criteria>, failures: Record<string, string> }>` — `groups`는 `[{ key, workProduct?, processId, items, candidates? }]`. 키는 산출물 `checkId`, 프로세스 `itemId`. 배치 단위로 `generateJson`을 호출하고, 배치가 throw하면 그 배치 항목 전부를 `failures`에 넣는다. 동시성 제한은 서버 클라이언트 래퍼가 맡는다.
  - 모델 응답 JSON 형태(프롬프트에 명시): `{"items":[{"id": "...", "criteria":["..."], "polarity":"positive|negative", "targetLocations":["..."], "relatedBPs":["MAN.3.BP5"], "severity":"상|중|하", "rationale":"..."}]}` / 프로세스는 `{"items":[{"id":"...","linkedWpCheckIds":[],"relatedBPs":[],"rationale":"..."}]}`.

- [ ] **Step 1: 테스트 작성** (가짜 client: 호출마다 미리 정한 `parsed`를 반환하거나 throw)
  - 정제: 목록 밖 BP `"XYZ.1.BP1"` 제거, 심각도 `"높음"` → `"중"`, 기준 빈 배열 → `null`, 후보 밖 `linkedWpCheckIds` 제거.
  - 프롬프트: `context`에 BP id·title이, `task`에 각 항목의 id·question이 들어가고, 부정형 질문 처리 지시("'예'가 위반을 뜻하면 polarity=negative")가 system에 있다.
  - 배치: 45개 항목 → `generateJson` 3회 호출(20/20/5).
  - **Review Focus 3:** 두 번째 배치만 throw → 첫·셋째 배치 25개는 `results`, 둘째 20개는 `failures`(메시지 포함).
  - 응답에 없는 id → 그 항목 `failures`("응답 없음").
  - 후보: MAN.3 프로세스 항목 후보에 `processId === "MAN.3"`인 산출물 항목 전부가 들어가고, 다른 processId라도 확정되어 있고 `relatedBPs`에 MAN.3 BP가 있으면 포함된다.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인 후 커밋** — `feat(qa): AI 판정 기준 초안 생성과 응답 정제`

### Task 7: `/api/qa-draft` 엔드포인트

**Files:**
- Create: `api/_qaDraftService.js`, `api/qa-draft.js`
- Modify: `api/_harnessService.js` (`resolveLlmConfig`, `limitConcurrency`를 export만 추가 — 동작 불변), `vite.config.js` (기존 `/api/project` 미들웨어 블록 옆에 `/api/qa-draft` 같은 패턴으로 추가), `vercel.json` (`"api/qa-draft.js": { "maxDuration": 60 }`)

**Interfaces:**
- Consumes: Task 6 `generateDrafts`; `aspice-harness/llm` `createLlmClient`; `aspice-harness` `loadProcesses`
- Produces: `handleQaDraft({ kind, groups }, env): Promise<{ results, failures, model }>`. API 키가 없으면 `Error("QA 초안 생성에는 LLM API 키(ANTHROPIC_API_KEY 또는 OPENAI_API_KEY)가 필요합니다.")`. HTTP: 200 `{results, failures, model}`, 400(kind·groups 누락), 401, 502 — `api/project.js`와 같은 인증·CORS.
  - 요청당 항목 상한 200개(초과 시 400). 클라이언트가 나눠 보낸다.

- [ ] **Step 1: 구현** — 서비스 함수는 `createLlmClient(cfg)`를 `limitConcurrency(client, cfg.concurrency)`로 감싸 `generateDrafts`에 넘긴다.
- [ ] **Step 2: 수동 확인** — `npm run dev` 후:
  - `curl -s -X POST localhost:5173/api/qa-draft -H "Content-Type: application/json" -d "{}"` → 400
  - API 키 없이 유효 본문 → 502, `detail`에 위 한국어 메시지
  - 키가 있으면 프로젝트계획서 항목 2개로 200, `results`에 `criteria` 배열
- [ ] **Step 3: 기존 테스트 회귀 확인** — `npm test` 전체 PASS
- [ ] **Step 4: 커밋** — `feat(qa): QA 초안 생성 API`

### Task 8: QA Audit 모드 진입과 저장 훅

**Files:**
- Modify: `src/components/ModeToggle.jsx` (`export const MODE_QA_AUDIT = "qa-audit"`, 세 번째 버튼 라벨 "QA Audit 모드", 힌트 "체크리스트 기반 산출물·프로세스 감사"), `src/SolutionApp.jsx` (`mode === MODE_QA_AUDIT && <QaAuditView />` 분기만 추가)
- Create: `src/hooks/useQaChecklist.js`, `src/components/qa/QaAuditView.jsx`

**Interfaces:**
- Consumes: Task 2·3·5 `readWorkbook`, `importWpChecklist`, `importProcessChecklist`, `buildVersion`; Task 4 `confirmItem`, `unconfirmItem`; `src/utils/idb.js` `idbGet/idbSet`; `useAuth()`의 `user.name`
- Produces (훅 반환값, Task 9·10이 사용):
  ```
  useQaChecklist() → {
    loading, error,
    state: { activeVersionId, versions, mappingOverrides },
    active: ChecklistVersion|null,
    lastImport: { summary: MergeSummary, issues: Issue[] } | null,
    importFiles({ wpFile?: File, processFile?: File }): Promise<void>,
    setActiveVersion(id), exportVersionJson(id): string,
    setSheetProcess(sheetName, processId), setProcessNameMapping(name, processId),
    updateItem(kind: "wp"|"process", key, patch), confirm(kind, key, criteria), unconfirm(kind, key),
    applyDrafts(kind, results), // draft 채우고 pending → drafted
  }
  ```
  - 모든 변경은 새 state 객체 → `idbSet("aspice_qa_checklists", state)`. 저장 실패 시 `error`에 메시지를 넣고 state를 되돌린다(IndexedDB 불가 환경 포함).
  - `setSheetProcess`/`setProcessNameMapping`은 `mappingOverrides`를 갱신하고, 활성 버전 해당 항목의 `processId`도 바꾼다.
  - 브라우저 BP 목록: `import { processes } from "aspice-harness/spec/all"`.
  - `importFiles`에서 형식 오류만 있고 항목이 0건이면 새 버전을 만들지 않고 `lastImport.issues`만 갱신한다(Review Focus 1: 활성 버전 유지).
- [ ] **Step 1: 구현** — `QaAuditView`는 1단계에서 "체크리스트" 탭 하나와 Task 9·10 컴포넌트 자리만 둔다.
- [ ] **Step 2: 확인** — `npm run build` 성공. dev 서버에서 세 모드 전환 시 기존 두 모드 화면이 그대로 나온다.
- [ ] **Step 3: 커밋** — `feat(qa): QA Audit 모드 진입과 체크리스트 저장 훅`

### Task 9: 가져오기 패널·결과 요약·버전 목록

**Files:**
- Create: `src/components/qa/ChecklistImportPanel.jsx`, `src/components/qa/ChecklistVersionList.jsx`
- Modify: `src/components/qa/QaAuditView.jsx`

**Interfaces:**
- Consumes: Task 8 훅 `importFiles`, `lastImport`, `active`, `state.versions`, `setActiveVersion`, `exportVersionJson`, `setSheetProcess`, `setProcessNameMapping`

- [ ] **Step 1: 구현** — 스펙 8.2의 1·2·3·6을 구현한다.
  - 파일 칸 두 개(.xlsx만 받음)와 "가져오기" 버튼.
  - 요약: 버전 번호, 항목 수, carried/stale/added/removed, 오류·경고 표(파일·시트·행·메시지, error를 먼저).
  - 진행 현황: 시트·프로세스별 상태 건수와 확정률.
  - "프로세스 지정 필요" 시트·프로세스 이름 옆에 프로세스 선택 드롭다운(32개 + `VWAY.PR`).
  - 버전 목록: 버전, 시각, 원본 파일명, 확정률, "활성으로 지정". "JSON 내보내기"는 화면에 JSON을 보여주고 복사 버튼을 둔다.
- [ ] **Step 2: 확인** — dev 서버에서 원본 VWAY 엑셀 두 파일을 가져와 확인한다.
  - 산출물 항목 수가 23개 시트의 데이터 행 합계와 같다.
  - 프로세스 항목은 97개다(합계 행 제외).
  - `양식`의 첫 ID `QA-XXX-001`이 무시되고 `QA-SYS.2-001`로 표시된다.
  - 같은 두 파일을 다시 가져오면 v2가 생기고 carried만 있다.
  - 프로세스 파일을 산출물 칸에 넣으면 오류 한 줄만 나오고 활성 버전이 그대로다.
- [ ] **Step 3: 커밋** — `feat(qa): 체크리스트 가져오기 화면과 버전 목록`

### Task 10: 항목 표·확정 패널·AI 초안 실행

**Files:**
- Create: `src/components/qa/ChecklistItemTable.jsx`, `src/components/qa/ChecklistItemEditor.jsx`, `src/hooks/useQaDraft.js`
- Modify: `src/components/qa/QaAuditView.jsx`

**Interfaces:**
- Consumes: Task 8 훅 `updateItem`, `confirm`, `unconfirm`, `applyDrafts`; Task 4 `canConfirmWp`, `canConfirmProcess`; Task 5 `missingLinks`; Task 6 `wpCandidatesFor`, `bpCatalog`; `/api/qa-draft`
- Produces: `useQaDraft() → { running, progress: {done, total}, failures, run({ kind, scope: "all"|{sheet}|{processId}|{keys}, includeConfirmed?: false }) }` — 그룹을 만들어 요청당 최대 200개 항목으로 나눠 순서대로 POST하고, 성공분은 매번 `applyDrafts`로 반영한다.

- [ ] **Step 1: 구현** — 스펙 8.2의 4·5.
  - 왼쪽 트리(산출물 시트 / 프로세스), 오른쪽 표(ID, 영역 또는 단계, 검토 항목, 상태, 심각도), 상태 필터.
  - 편집 패널: 원문 읽기 전용 영역 + 편집 폼.
    - 산출물: 판정 기준 목록(추가·삭제·수정), 긍정/부정 질문, 대상 위치 목록, 관련 BP(해당 프로세스 목록 다중 선택 + 전체 BP 검색), 심각도, 프로세스.
    - 프로세스: 연결 체크 ID(검색·다중 선택·문장 미리보기, `missingLinks`는 빨간 "없는 항목" 칩), 관련 BP, 프로세스.
    - AI `rationale`은 회색 참고 문구.
  - 버튼: 확정(조건 미충족 시 비활성 + `reasons` 표시, `warnings`는 노란 문구), 초안 다시 만들기, 확정 취소.
  - 표 다중 선택 → "초안 그대로 일괄 확정"(조건 미충족 제외, 제외 건수 알림), "선택 항목 AI 초안 만들기".
  - 상단 "AI 초안 만들기"(전체·현재 시트/프로세스). 진행률과 실패 목록을 표시한다.
- [ ] **Step 2: 확인** — dev 서버(API 키 설정)에서 확인한다.
  - 프로젝트계획서 시트 초안을 만들면 항목이 drafted가 된다.
  - 한 항목의 기준을 모두 지우면 확정 버튼이 비활성되고 이유가 보인다(Review Focus 4).
  - 확정 후 새로고침해도 유지된다.
  - 프로세스 항목 "프로젝트 관리" 하나를 연결 후 확정한다.
  - 산출물 엑셀에서 연결된 행 하나를 지운 사본을 다시 가져오면 그 프로세스 항목이 stale이 되고 "없는 항목" 칩이 보인다.
  - API 키를 빼고 실행하면 실패 메시지가 화면에 나온다.
- [ ] **Step 3: 전체 회귀** — `npm test` PASS, `npm run build` 성공
- [ ] **Step 4: 커밋** — `feat(qa): 체크 항목 확정 화면과 AI 초안 실행`
