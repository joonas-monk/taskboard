---
phase: 05-ai-pipeline-foundation
plan: 02
subsystem: api
tags: [anthropic, ai, pipeline, workers, child_process, sqlite, prisma]

# Dependency graph
requires:
  - phase: 05-01
    provides: "PipelineRun/PipelineMessage schema, Anthropic SDK singleton, pipeline types, ai-schemas"
provides:
  - "startPipeline Server Action: spawns detached tsx worker for background AI processing"
  - "getPipelineStatus Server Action: reads current pipelineStatus + latest PipelineRun with messages"
  - "pipeline-worker.ts: detached OS process that moves card Idea->Suunnittelu, calls Claude API, stores plan"
  - "pipeline-stages.ts: runPlanningStage() calling Anthropic messages API with Finnish planning prompt"
  - "prompts.ts: buildPlanningPrompt() for structured Finnish plan generation"
  - "AI-01 auto-start: createTask auto-calls startPipeline when card created in Idea column"
affects: [06-ui-pipeline, 07-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detached worker pattern: child_process.spawn with detached:true + unref() for background AI tasks"
    - "Worker isolation: worker creates own PrismaClient + Anthropic instance (cannot share Next.js process globals)"
    - "Explicit env passing: spawn passes only required env vars (DATABASE_URL, ANTHROPIC_API_KEY, PIPELINE_MODEL, NODE_ENV, PATH)"
    - "Fire-and-forget auto-start: createTask calls startPipeline().catch() for AI-01 requirement"
    - "Finnish prompt templates: structured output format (Tavoite/Vaiheet/Hyväksymiskriteerit)"

key-files:
  created:
    - src/workers/prompts.ts
    - src/workers/pipeline-stages.ts
    - src/workers/pipeline-worker.ts
    - src/actions/ai.ts
  modified:
    - src/actions/tasks.ts

key-decisions:
  - "Worker creates own PrismaClient with PrismaBetterSqlite3 adapter — separate OS process cannot share Next.js globalThis singleton"
  - "Worker creates own Anthropic instance — pipeline-stages.ts is not imported by Next.js process"
  - "stdio: ignore on spawn — worker has no console output, errors tracked via PipelineRun.error in DB"
  - "ANTHROPIC_API_KEY validated before spawning worker — fail fast with clear Finnish error message"
  - "startPipeline allows retry: IDLE or FAILED are both valid states to start pipeline"

patterns-established:
  - "Detached worker: spawn tsx with detached:true + unref() for background tasks that outlive the request"
  - "Worker receives cardId via process.argv[2] and all config via spawn env option (not dotenv)"
  - "Worker validates state before processing: card must be QUEUED, Suunnittelu column must exist"
  - "PipelineRun created before API call to track attempt even if API fails"
  - "Both user prompt and assistant response stored as PipelineMessages for conversation history"

requirements-completed: [AI-01, AI-08]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 5 Plan 02: AI Pipeline Worker and Server Actions Summary

**Detached tsx worker pipeline: startPipeline spawns background process that calls Claude Haiku, moves card Idea->Suunnittelu, stores plan as PipelineMessage, with auto-start on Idea column card creation (AI-01)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T17:25:16Z
- **Completed:** 2026-02-28T17:27:06Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `src/workers/` directory with three files: prompts.ts (Finnish planning prompt builder), pipeline-stages.ts (Anthropic API caller), and pipeline-worker.ts (detached background worker)
- Implemented `startPipeline` Server Action that validates card state, sets QUEUED, spawns detached tsx worker with explicit env vars, and returns immediately
- Implemented `getPipelineStatus` Server Action returning current pipelineStatus and latest PipelineRun with ordered messages
- Wired AI-01 auto-start: createTask detects Idea column by name and fire-and-forgets startPipeline after card creation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompt builders and planning stage** - `05e8d2f` (feat)
2. **Task 2: Create pipeline worker and Server Actions** - `4346586` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/workers/prompts.ts` - buildPlanningPrompt() for Finnish structured planning prompt (Tavoite/Vaiheet/Hyväksymiskriteerit)
- `src/workers/pipeline-stages.ts` - runPlanningStage() calls Anthropic messages API, extracts text block, throws on missing content
- `src/workers/pipeline-worker.ts` - Self-contained detached worker: validates cardId, creates own PrismaClient, moves card, calls API, stores messages, handles FAILED state
- `src/actions/ai.ts` - startPipeline and getPipelineStatus Server Actions with Finnish error messages
- `src/actions/tasks.ts` - Added startPipeline import and AI-01 auto-start block in createTask

## Decisions Made
- Worker creates own PrismaClient with PrismaBetterSqlite3 adapter — it runs as a separate OS process and cannot access globalThis from the Next.js process
- Worker creates own Anthropic instance in pipeline-stages.ts — same reason; not imported via src/lib/anthropic.ts
- `stdio: 'ignore'` on spawn — worker errors are tracked via PipelineRun.error in DB, not console
- startPipeline validates ANTHROPIC_API_KEY before spawning (fail fast with Finnish error)
- startPipeline allows starting from both IDLE and FAILED states to enable pipeline retry

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**ANTHROPIC_API_KEY must be set in `.env`** before the pipeline can execute. Currently the `.env` file has a placeholder (`sk-ant-...your-key-here`). Set the actual key before testing the pipeline:

```bash
# In .env file:
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

The `startPipeline` Server Action returns a Finnish error message if the key is missing: "ANTHROPIC_API_KEY puuttuu palvelimen ympäristömuuttujista"

## Next Phase Readiness

- Pipeline worker fully implemented and TypeScript-verified
- startPipeline and getPipelineStatus Server Actions ready for UI integration (Phase 6)
- AI-01 auto-start wired — adding a card to Idea column will trigger pipeline automatically once ANTHROPIC_API_KEY is set
- Phase 6 can build pipeline status UI components using getPipelineStatus and PipelineStatusResult type

---
*Phase: 05-ai-pipeline-foundation*
*Completed: 2026-02-28*
