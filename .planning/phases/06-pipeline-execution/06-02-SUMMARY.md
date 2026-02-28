---
phase: 06-pipeline-execution
plan: 02
subsystem: api
tags: [ai, pipeline, worker, anthropic, prisma, server-actions, typescript]

# Dependency graph
requires:
  - phase: 06-01
    provides: runPlanningStage, runExecutionStage, runExecutionStageApi, runTestingStage, ensureWorkspace utilities

provides:
  - Full 3-stage pipeline orchestration (PLANNING -> EXECUTING -> TESTING -> COMPLETED) in pipeline-worker.ts
  - Pause-check DB re-reads between stages for clean pause handling
  - Retry-from-failed-stage logic reading previous PipelineRun messages
  - pausePipeline Server Action setting pipelineStatus to PAUSED
  - startPipeline accepting IDLE, FAILED, or PAUSED states for resume

affects: [ui-pipeline-controls, pipeline-status-polling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - advanceToStage() atomic $transaction for column move + pipeline status update
    - checkPaused() DB re-read pattern for cooperative pause between stages
    - Retry-from-failed by loading PipelineMessages with artifactType from previous run

key-files:
  created: []
  modified:
    - src/workers/pipeline-worker.ts
    - src/actions/ai.ts
    - src/actions/ai-schemas.ts

key-decisions:
  - "checkPaused() always queries DB fresh — never caches — so the worker sees the PAUSED flag the moment it is set"
  - "advanceToStage() uses $transaction to atomically update PipelineRun stage/status AND Card columnId/position/pipelineStatus, preventing split-brain"
  - "Retry point determined by latestRun.stage — worker loads prior messages by artifactType ('plan', 'code'/'execution') to reconstruct state"
  - "startPipeline accepts PAUSED state alongside IDLE and FAILED — worker then detects start stage from previous run"
  - "HOME passed in worker spawn env — required by WORKSPACE_BASE default in workspace.ts and Agent SDK env option"

patterns-established:
  - "Pause check: read DB between stages, if PAUSED then update both run and card to PAUSED and return early"
  - "Stage skip on retry: check latestRun?.status === 'FAILED' and latestRun.stage to determine startStage"

requirements-completed: [AI-02, AI-03]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 6 Plan 02: Pipeline Orchestration Summary

**Full 3-stage AI pipeline (plan -> execute -> test) with cooperative pause via DB re-read and retry-from-failed-stage using previous PipelineRun messages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T20:34:25Z
- **Completed:** 2026-02-28T20:36:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Rewrote pipeline-worker.ts to orchestrate all three stages (PLANNING -> EXECUTING -> TESTING -> COMPLETED) with column moves at each transition
- Implemented cooperative pause: worker re-reads DB between stages and exits cleanly when pipelineStatus is PAUSED
- Added retry-from-failed: worker reads previous run's PipelineMessages by artifactType to skip already-completed stages
- Added pausePipeline Server Action that validates card is running before setting PAUSED
- Updated startPipeline to accept PAUSED state for resume and added HOME to worker spawn env

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite pipeline-worker.ts for full 3-stage pipeline with pause and retry** - `a822304` (feat)
2. **Task 2: Add pausePipeline Server Action and update startPipeline for PAUSED resume** - `c5abf60` (feat)

## Files Created/Modified

- `src/workers/pipeline-worker.ts` - Full orchestration: all 3 stages, pause checks, retry logic, column moves, CODE vs API branching
- `src/actions/ai.ts` - Added pausePipeline action, PAUSED allowed in startPipeline, HOME in spawn env
- `src/actions/ai-schemas.ts` - Added pausePipelineSchema

## Decisions Made

- checkPaused() always queries DB fresh — never caches — so the worker sees the PAUSED flag the moment it is set
- advanceToStage() uses $transaction to atomically update PipelineRun stage/status AND Card columnId/position/pipelineStatus, preventing split-brain state
- Retry point determined by latestRun.stage — worker loads prior messages by artifactType to reconstruct planText and execResult
- startPipeline accepts PAUSED state alongside IDLE and FAILED — the worker then determines start stage from the previous failed/paused run
- HOME passed in worker spawn env — required by WORKSPACE_BASE default in workspace.ts and Agent SDK env option

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. ANTHROPIC_API_KEY must already be set per Phase 5 requirement.

## Next Phase Readiness

- End-to-end pipeline fully wired: card created in Idea column goes through Suunnittelu -> Toteutus -> Testaus -> Valmis with AI processing at each stage
- pausePipeline and startPipeline (resume) ready for UI integration in Phase 6 Plan 3 (pipeline controls UI)
- All pipeline status values (PLANNING, EXECUTING, TESTING, COMPLETED, PAUSED, FAILED) properly handled

---
*Phase: 06-pipeline-execution*
*Completed: 2026-02-28*
