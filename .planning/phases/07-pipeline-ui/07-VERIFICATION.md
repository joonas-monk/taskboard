---
phase: 07-pipeline-ui
verified: 2026-02-28T21:30:00Z
status: passed
score: 11/11 must-haves verified
---

# Phase 7: Pipeline UI Verification Report

**Phase Goal:** Users see pipeline progress on cards, view AI conversation logs, control the pipeline, and select card types
**Verified:** 2026-02-28T21:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees card type dropdown (Koodiprojekti, Tutkimus, Liiketoiminta, Yleinen) when adding a card in Idea column only | VERIFIED | `AddCardForm.tsx` lines 90-101: `{isIdeaColumn && (<select ...>)}` with 4 Finnish options; `Column.tsx` line 57: `isIdeaColumn={column.name === 'Idea'}` |
| 2 | User sees spinner and Finnish status text on cards with active pipeline (QUEUED, PLANNING, EXECUTING, TESTING) | VERIFIED | `PipelineIndicator.tsx`: ACTIVE_STATUSES set, animate-spin spinner with inline borderTopColor, Finnish labels (Jonossa, Suunnitellaan, Toteutetaan, Testataan) |
| 3 | User sees terminal status badges (Valmis, Virhe, Pysaytetty) on completed/failed/paused cards | VERIFIED | `PipelineIndicator.tsx` STATUS_LABELS map with colored inline styles (green for COMPLETED, red for FAILED, gray for PAUSED) |
| 4 | Board auto-refreshes every 5 seconds while any card has active pipeline status | VERIFIED | `Board.tsx` lines 40-50: `setInterval(() => { router.refresh() }, 5000)` inside useEffect that checks ACTIVE_STATUSES |
| 5 | Board stops polling when no cards have active pipeline status | VERIFIED | `Board.tsx` line 43: `if (!allCards.some(c => ACTIVE_STATUSES.has(c.pipelineStatus))) return` — early return prevents interval creation |
| 6 | User can click a card and see a 'Tekoaly-loki' tab when card has non-IDLE pipeline status | VERIFIED | `CardModal.tsx` line 111: `{card.pipelineStatus !== 'IDLE' && (` tab nav block with 'Tekoaly-loki' button |
| 7 | User sees full AI conversation (all PipelineMessages) in loki tab, formatted with timestamps | VERIFIED | `PipelineLog.tsx`: fetches via `getPipelineStatus`, renders `run.messages` with `Intl.DateTimeFormat('fi-FI', ...)`, role labels Jarjestelma/Tekoaly |
| 8 | User can pause a running pipeline from the modal via a 'Pysayta' button | VERIFIED | `PipelineActions.tsx`: `PAUSEABLE = new Set(['PLANNING', 'EXECUTING', 'TESTING'])`, button calls `pausePipeline({ cardId })` |
| 9 | User can retry a failed or paused pipeline from the modal via a 'Kaynnista uudelleen' button | VERIFIED | `PipelineActions.tsx`: `RETRIABLE = new Set(['FAILED', 'PAUSED'])`, button calls `startPipeline({ cardId })` |
| 10 | Tab resets to 'Kortti' when switching between cards | VERIFIED | `CardModal.tsx` lines 37-41: `useEffect(() => { setActiveTab('kortti') }, [card])` co-located with confirmDelete reset |
| 11 | IDLE cards show no tabs (existing single-form behavior) | VERIFIED | `CardModal.tsx` line 111: tab nav wrapped in `card.pipelineStatus !== 'IDLE'`; form shown when `card.pipelineStatus === 'IDLE' || activeTab === 'kortti'` |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/board/PipelineIndicator.tsx` | Spinner + Finnish status label for pipeline status | VERIFIED | 49 lines, exports default PipelineIndicator, handles all 7 non-IDLE statuses, returns null for IDLE |
| `src/actions/schemas.ts` | createTaskSchema with cardType field | VERIFIED | Line 10: `cardType: z.enum(['CODE', 'RESEARCH', 'BUSINESS', 'GENERAL']).optional()` |
| `src/actions/tasks.ts` | createTask passing cardType to prisma.card.create | VERIFIED | Line 52: `cardType: parsed.data.cardType ?? 'GENERAL'` in prisma.card.create data object |
| `src/types/index.ts` | CreateTaskInput with cardType field | VERIFIED | Line 35: `cardType?: CardType` |
| `src/components/board/PipelineActions.tsx` | Pause/Retry/Start buttons based on pipeline status | VERIFIED | 84 lines, 3 button sets (PAUSEABLE/RETRIABLE/STARTABLE), error state, useTransition |
| `src/components/board/PipelineLog.tsx` | Fetches and renders pipeline conversation log | VERIFIED | 149 lines, useEffect with cancelled flag, getPipelineStatus call, fi-FI timestamps, PipelineActions at bottom |
| `src/components/board/CardModal.tsx` | Tabbed modal with activeTab state | VERIFIED | Tab state `type Tab = 'kortti' | 'loki'`, activeTab state, tab reset on card change, PipelineLog rendered for loki tab |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AddCardForm.tsx` | `actions/tasks.ts` | createTask({ title, columnId, cardType }) | VERIFIED | Lines 49-53: createTask called with `cardType: isIdeaColumn ? cardType : undefined` |
| `actions/tasks.ts` | `types/index.ts` | CreateTaskInput type includes cardType | VERIFIED | `createTask(input: CreateTaskInput)` and `CreateTaskInput.cardType?: CardType` |
| `Column.tsx` | `AddCardForm.tsx` | isIdeaColumn prop | VERIFIED | Column.tsx line 57: `isIdeaColumn={column.name === 'Idea'}` |
| `Card.tsx` | `PipelineIndicator.tsx` | import and render with card.pipelineStatus | VERIFIED | Card.tsx line 9: import, line 51: `<PipelineIndicator status={card.pipelineStatus} />` |
| `Board.tsx` | `router.refresh()` | useEffect + setInterval polling when active pipelines exist | VERIFIED | Board.tsx lines 40-50: setInterval every 5000ms inside useEffect with ACTIVE_STATUSES check |
| `PipelineLog.tsx` | `actions/ai.ts` | getPipelineStatus Server Action call | VERIFIED | PipelineLog.tsx line 4: `import { getPipelineStatus } from '@/actions/ai'`, line 51: `getPipelineStatus({ cardId })` |
| `PipelineActions.tsx` | `actions/ai.ts` | pausePipeline and startPipeline Server Action calls | VERIFIED | Line 4: `import { startPipeline, pausePipeline } from '@/actions/ai'`, lines 23, 35: actual calls |
| `CardModal.tsx` | `PipelineLog.tsx` | Rendered when activeTab === 'loki' | VERIFIED | Line 281: `{card.pipelineStatus !== 'IDLE' && activeTab === 'loki' && (<PipelineLog ...>)}` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-04 | 07-01-PLAN.md | User can select card type (Koodiprojekti, Tutkimus, Liiketoiminta, Yleinen) when creating a card | SATISFIED | AddCardForm.tsx card type select (Idea column only), createTaskSchema validates enum, createTask stores to DB |
| AI-05 | 07-01-PLAN.md | User can see AI pipeline status (spinner, stage progress) on each card | SATISFIED | PipelineIndicator.tsx on every Card, Board 5-second polling via router.refresh() |
| AI-06 | 07-02-PLAN.md | User can view AI conversation log in card modal (Tekoaly-loki tab) | SATISFIED | CardModal tabbed UI, PipelineLog fetches getPipelineStatus, renders messages with fi-FI timestamps and Jarjestelma/Tekoaly role labels |
| AI-07 | 07-02-PLAN.md | User can pause a running pipeline and retry a failed one | SATISFIED | PipelineActions renders Pysayta for PLANNING/EXECUTING/TESTING, Kaynnista uudelleen for FAILED/PAUSED; both call ai.ts Server Actions |

No orphaned requirements: all 4 requirements (AI-04, AI-05, AI-06, AI-07) appear in plan frontmatter and are satisfied.

Note: REQUIREMENTS.md traceability table marks AI-06 and AI-07 as Complete at Phase 7. ROADMAP.md shows `07-02-PLAN.md` with an unchecked checkbox `[ ]` — this is a documentation artifact only; all 07-02 deliverables are present and wired in the codebase (commits `138f9fb`, `0e1c748` confirmed present in git log).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/workers/pipeline-worker.ts` | 78 | `Type 'string' not assignable to PipelineStatus` TypeScript error | Info | Pre-existing error from Phase 6, documented in both 07-01 and 07-02 SUMMARYs as out of scope. Isolated to pipeline-worker.ts — no Phase 7 files have TypeScript errors. |

No stub returns, empty implementations, TODO/FIXME comments, or placeholder patterns found in any Phase 7 files.

### Human Verification Required

#### 1. Card Type Selector Visual — Idea Column Only

**Test:** Open the board, click "+ Lisaa kortti" in the Idea column, observe the form. Then try the same in a different column (e.g., Suunnittelu).
**Expected:** Idea column shows a dropdown with 4 Finnish options (Yleinen, Koodiprojekti, Tutkimus, Liiketoiminta). Other columns show no dropdown.
**Why human:** Column name check (`column.name === 'Idea'`) is a runtime comparison — can't verify the actual column name in DB matches without running the app.

#### 2. PipelineIndicator Spinner Visual

**Test:** Trigger a pipeline on a card (or seed a card with pipelineStatus = 'PLANNING') and observe the card face.
**Expected:** Animated blue spinner appears to the left of "Suunnitellaan..." text below the card title. No spinner for COMPLETED (green "Valmis") or FAILED (red "Virhe").
**Why human:** CSS animation (`animate-spin`) and inline border styles can't be verified programmatically — requires visual inspection.

#### 3. Board Auto-Polling in Action

**Test:** With a card in QUEUED or PLANNING status, watch the board for 5-10 seconds without interacting.
**Expected:** The board silently refreshes every 5 seconds, updating card positions and status labels as the pipeline progresses.
**Why human:** Real-time behavior and the polling start/stop lifecycle require a running server with an active pipeline.

#### 4. Tekoaly-Loki Tab and Conversation Display

**Test:** Click a card with a non-IDLE pipelineStatus. Observe the modal. Switch to "Tekoaly-loki" tab.
**Expected:** Two tabs appear (Kortti, Tekoaly-loki). Loki tab shows messages with Jarjestelma/Tekoaly labels, fi-FI timestamps, and scrollable message list. IDLE cards show no tabs.
**Why human:** Tab rendering, scroll behavior, and message layout require visual inspection with real pipeline data.

#### 5. Pipeline Control Buttons Functional

**Test:** With a card in PLANNING/EXECUTING/TESTING status, open the modal, switch to loki tab, click "Pysayta". Then with a FAILED card, click "Kaynnista uudelleen".
**Expected:** Pause sets card to PAUSED immediately (board refreshes). Retry starts a new pipeline run.
**Why human:** Requires an active pipeline worker and real DB mutations — can't verify Server Action side effects programmatically.

### Gaps Summary

No gaps found. All 11 must-have truths are verified, all 7 artifacts pass level 1 (exists), level 2 (substantive — real implementations, not stubs), and level 3 (wired — imported and used). All 4 requirement IDs (AI-04, AI-05, AI-06, AI-07) are satisfied with direct code evidence.

The single noted issue — a TypeScript error in `pipeline-worker.ts` line 78 — is pre-existing from Phase 6 and was explicitly logged in both Phase 7 SUMMARY files as out of scope. It does not affect any Phase 7 component.

---

_Verified: 2026-02-28T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
