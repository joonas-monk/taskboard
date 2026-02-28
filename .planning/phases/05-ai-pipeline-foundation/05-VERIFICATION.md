---
phase: 05-ai-pipeline-foundation
verified: 2026-02-28T00:00:00Z
status: human_needed
score: 4/4 automated must-haves verified
re_verification: false
human_verification:
  - test: "Create a card in the Idea column via the board UI"
    expected: "Card appears immediately in Idea column (optimistic UI), then within ~15 seconds card moves to Suunnittelu column and its pipelineStatus becomes COMPLETED — visible after page refresh. A PipelineRun and two PipelineMessages (user + assistant) exist in the database."
    why_human: "Requires a real ANTHROPIC_API_KEY to be set in .env. The .env file currently contains only the placeholder value 'sk-ant-...your-key-here'. The end-to-end pipeline path (worker spawn, API call, DB write, card move) cannot be verified programmatically without live credentials."
  - test: "Check that ANTHROPIC_API_KEY is configured with a real key"
    expected: "startPipeline succeeds and returns { success: true } — not the error 'ANTHROPIC_API_KEY puuttuu palvelimen ympäristömuuttujista'"
    why_human: "The .env file contains a placeholder key. This is a user-setup step documented in both SUMMARYs. Without it the worker will authenticate against Anthropic and fail immediately, setting pipelineStatus=FAILED."
---

# Phase 5: AI Pipeline Foundation Verification Report

**Phase Goal:** Database schema supports AI pipeline data, Anthropic SDK integrated, background worker runs planning stage and moves card from Idea to Suunnittelu
**Verified:** 2026-02-28
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                       | Status     | Evidence                                                                                                                                                                                             |
|----|-------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | PipelineRun and PipelineMessage models exist in the database after migration                                 | VERIFIED   | `prisma/schema.prisma` defines both models. Migration `20260228172026_add_pipeline_models/migration.sql` creates the tables. `prisma migrate status` reports "Database schema is up to date!"        |
| 2  | Card model has cardType and pipelineStatus fields with correct defaults                                      | VERIFIED   | Schema lines 58–60: `cardType CardType @default(GENERAL)` and `pipelineStatus PipelineStatus @default(IDLE)`. Migration SQL confirms `cardType TEXT NOT NULL DEFAULT 'GENERAL'` and `pipelineStatus TEXT NOT NULL DEFAULT 'IDLE'` |
| 3  | WAL mode is enabled on the SQLite database                                                                   | VERIFIED   | `src/lib/prisma.ts` opens raw `better-sqlite3` connection, executes `rawDb.pragma('journal_mode = WAL')`, then closes before creating Prisma adapter. Live DB confirms: `[{"journal_mode":"wal"}]`   |
| 4  | Anthropic client initializes cleanly from process.env.ANTHROPIC_API_KEY and is importable by worker code    | VERIFIED   | `src/lib/anthropic.ts` exports `new Anthropic()`. `src/workers/pipeline-stages.ts` creates its own `new Anthropic()` instance. `@anthropic-ai/sdk@0.78.0` installed. TypeScript compiles with zero errors. |
| 5  | Calling startPipeline on a card in the Idea column spawns a background worker that moves the card to Suunnittelu | HUMAN_NEEDED | `src/actions/ai.ts:startPipeline` spawns a detached tsx worker at `src/workers/pipeline-worker.ts` with `detached:true` and `unref()`. Logic is fully implemented and type-checked. But end-to-end execution requires a real `ANTHROPIC_API_KEY` — currently a placeholder in `.env`. |
| 6  | The plan text is stored as a PipelineMessage in the database                                                 | HUMAN_NEEDED | `pipeline-worker.ts` stores user prompt (role='user') and assistant response (role='assistant', artifactType='plan') via `prisma.pipelineMessage.create`. Code is substantive and wired. Needs live run to confirm. |
| 7  | getPipelineStatus returns the current stage and messages                                                     | VERIFIED   | `src/actions/ai.ts:getPipelineStatus` queries `prisma.card.findUnique` including `pipelineRuns` (latest 1, desc) with `messages` (asc). Returns `{ status, run }`. All code is substantive and type-correct. |
| 8  | The worker exits cleanly after the planning stage                                                            | HUMAN_NEEDED | `pipeline-worker.ts` has `finally { await prisma.$disconnect(); process.exit(0) }`. Correct pattern. Needs live run to confirm clean exit. |

**Automated Score:** 5/8 truths fully verified. 3 truths are code-complete but require live API key for end-to-end confirmation.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | CardType/PipelineStatus enums, PipelineRun/PipelineMessage models, Card fields | VERIFIED | All present: enums at lines 17–33, Card fields at lines 58–60, PipelineRun at lines 79–90, PipelineMessage at lines 92–101 |
| `src/lib/prisma.ts` | WAL mode initialization before Prisma adapter creation | VERIFIED | `rawDb.pragma('journal_mode = WAL')` at line 12; `rawDb.close()` at line 13; adapter created at line 15 |
| `src/lib/anthropic.ts` | Anthropic SDK singleton client | VERIFIED | `export const anthropic = new Anthropic()` at line 5; `PIPELINE_MODEL` constant at line 8 |
| `src/types/index.ts` | Pipeline-related type exports | VERIFIED | Exports `CardType`, `PipelineStatus`, `PipelineRun`, `PipelineMessage`; defines `StartPipelineInput`, `PipelineStatusResult`, `SerializedPipelineRun`, `SerializedPipelineMessage` |
| `src/actions/ai-schemas.ts` | Zod schemas for pipeline Server Actions | VERIFIED | `startPipelineSchema` and `getPipelineStatusSchema` both present |
| `src/actions/ai.ts` | startPipeline and getPipelineStatus Server Actions | VERIFIED | Both exported, fully implemented — spawn with detached:true, validation, Finnish errors |
| `src/workers/pipeline-worker.ts` | Detached background worker entry point | VERIFIED | Reads `process.argv[2]`, creates own PrismaClient, full planning flow, error handling, `process.exit(0)` in finally |
| `src/workers/pipeline-stages.ts` | Planning stage that calls Anthropic API | VERIFIED | `runPlanningStage` calls `anthropic.messages.create`, extracts text block, throws on missing content |
| `src/workers/prompts.ts` | Prompt builder functions | VERIFIED | `buildPlanningPrompt` builds Finnish structured prompt with Tavoite/Vaiheet/Hyväksymiskriteerit |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `prisma/schema.prisma` | `src/generated/prisma` | prisma generate produces typed client | VERIFIED | `src/generated/prisma/models/PipelineRun.ts` and `PipelineMessage.ts` exist with full type exports |
| `src/lib/prisma.ts` | `better-sqlite3` | Raw DB connection sets WAL pragma before adapter | VERIFIED | `import Database from 'better-sqlite3'`; `rawDb.pragma('journal_mode = WAL')` executed before `new PrismaBetterSqlite3(...)` |
| `src/actions/ai.ts` | `src/workers/pipeline-worker.ts` | child_process.spawn with detached:true + unref() | VERIFIED | `spawn(tsxPath, [workerPath, cardId], { detached: true, stdio: 'ignore', ... })` at line 59; `worker.unref()` at line 71 |
| `src/workers/pipeline-worker.ts` | `src/workers/pipeline-stages.ts` | import and call runPlanningStage | VERIFIED | `import { runPlanningStage } from './pipeline-stages'` at line 10; called at line 101 |
| `src/workers/pipeline-stages.ts` | `@anthropic-ai/sdk` | Anthropic SDK for API calls | VERIFIED | `import Anthropic from '@anthropic-ai/sdk'`; `anthropic.messages.create(...)` at line 23 |
| `src/actions/ai.ts` | `prisma` | getPipelineStatus reads card + pipelineRuns + messages | VERIFIED | `prisma.card.findUnique({ ..., pipelineRuns: { include: { messages: ... } } })` at line 95 |
| `src/actions/tasks.ts` | `src/actions/ai.ts` | createTask auto-calls startPipeline for Idea column | VERIFIED | `import { startPipeline } from './ai'` at line 22; `startPipeline({ cardId: card.id }).catch(...)` at line 72 triggered when `column?.name === 'Idea'` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-01 | 05-02-PLAN.md | When user creates a card in Idea column, AI automatically starts planning and moves card to Suunnittelu | SATISFIED (code) / HUMAN_NEEDED (live) | `createTask` in `tasks.ts` detects Idea column by name and fire-and-forgets `startPipeline`. Worker moves card to Suunnittelu column. Requires live API key to confirm end-to-end. |
| AI-08 | 05-01-PLAN.md, 05-02-PLAN.md | AI conversation history and artifacts persist in database | SATISFIED (code) / HUMAN_NEEDED (live) | `PipelineMessage` model stores role, content, artifactType. Worker creates user + assistant messages with `artifactType='plan'`. `getPipelineStatus` returns messages. Requires live run to confirm persistence. |

No orphaned requirements found. Both AI-01 and AI-08 are explicitly claimed in plan frontmatter and implemented.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `.env` | `ANTHROPIC_API_KEY=sk-ant-...your-key-here` (placeholder value) | INFO | Not a code issue — this is correct placeholder behavior. User must set a real key before the pipeline executes. Both SUMMARYs document this as a user-setup step. |

No code stubs, empty implementations, TODO/FIXME comments, or other anti-patterns found in any of the 9 implementation files.

---

### Human Verification Required

#### 1. End-to-End Pipeline Execution

**Test:** Set a real Anthropic API key in `.env` (`ANTHROPIC_API_KEY=sk-ant-api03-...`), restart the dev server, then create a card in the Idea column via the board UI (click "Lisaa kortti" in the Idea column, enter a title, submit).

**Expected:** The card appears immediately in Idea (optimistic UI). Within 5–15 seconds, the card disappears from Idea and reappears in Suunnittelu (after page refresh). The card's `pipelineStatus` in the database is `COMPLETED`. A `PipelineRun` record exists with `stage='PLANNING'` and `status='COMPLETED'`. Two `PipelineMessage` records exist: one with `role='user'` and one with `role='assistant'` and `artifactType='plan'` containing a Finnish structured plan.

**Why human:** The `.env` file currently contains only the placeholder value `sk-ant-...your-key-here`. The end-to-end test requires a live Anthropic API call. All code is correct and type-checked, but only running the pipeline confirms the spawn, worker, API call, DB write, and card column move all work together in production conditions.

#### 2. ANTHROPIC_API_KEY Validation Error Path

**Test:** With the placeholder key still in `.env` (or a deliberately invalid key), create a card in the Idea column.

**Expected:** The card is created successfully in the Idea column. The `startPipeline` call inside `createTask` returns `{ success: false, error: 'ANTHROPIC_API_KEY puuttuu palvelimen ympäristömuuttujista' }` (silently caught). The card remains in Idea with `pipelineStatus='IDLE'` (the QUEUED update would be rolled back if spawn fails — or the worker fails quickly and sets FAILED). Card creation itself succeeds.

**Why human:** The fire-and-forget pattern means the error is swallowed by `.catch(() => {})`. Verifying the exact error state of the card after a failed start requires inspection of the database.

---

### Gaps Summary

No gaps found in the implementation. All 9 artifacts are substantive and correctly wired. TypeScript compiles with zero errors. The Prisma migration ran cleanly. WAL mode is confirmed active on the live database. The `tsx` binary is present at `node_modules/.bin/tsx`.

The phase is blocked on human verification only because the `ANTHROPIC_API_KEY` in `.env` is a placeholder. This is an intentional design — the SUMMARY explicitly calls it out as user-setup. Once a real key is provided, the pipeline should work end-to-end without any code changes.

---

_Verified: 2026-02-28_
_Verifier: Claude (gsd-verifier)_
