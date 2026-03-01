---
phase: 08-polish
plan: 02
subsystem: api
tags: [anthropic, retry, exponential-backoff, pipeline, finnish-ui]

# Dependency graph
requires:
  - phase: 06-pipeline-execution
    provides: pipeline-stages.ts with runPlanningStage, runExecutionStageApi, runTestingStage
  - phase: 07-pipeline-ui
    provides: PipelineActions, PipelineLog, PipelineIndicator, CardModal tabs
provides:
  - Exponential backoff retry wrapper (withRetry) for all Anthropic API calls
  - Confirmed Finnish-only user-facing text across all pipeline UI components
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "withRetry<T> generic wrapper: retries async functions on 429 status with delays 2s/8s/32s (base*4^attempt)"
    - "Rate limit detection via duck-typed status property check (err != null && typeof err === 'object' && 'status' in err)"

key-files:
  created: []
  modified:
    - src/workers/pipeline-stages.ts

key-decisions:
  - "withRetry checks 429 via duck-typed status property rather than instanceof check — works across SDK versions and avoids tight coupling to Anthropic error class hierarchy"
  - "runExecutionStage (Agent SDK query()) deliberately excluded from withRetry — query() manages its own error handling internally"
  - "baseDelayMs=2000 with factor 4 produces 2s/8s/32s sequence — matches Anthropic typical rate limit reset window"

patterns-established:
  - "withRetry pattern: generic <T> wrapper, maxAttempts=3, exponential factor 4, Finnish log messages"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 08 Plan 02: Exponential Backoff + Finnish UI Audit Summary

**withRetry<T> generic wrapper added to pipeline-stages.ts, covering all three anthropic.messages.create calls with 2s/8s/32s backoff on 429 rate limit errors; all pipeline UI text confirmed Finnish**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-01T07:49:45Z
- **Completed:** 2026-03-01T07:51:35Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `withRetry<T>` generic function with exponential backoff (2s, 8s, 32s delays) for 429 rate limit errors
- Wrapped all three `anthropic.messages.create` calls: `runPlanningStage`, `runExecutionStageApi`, `runTestingStage`
- Non-429 errors propagate immediately without retry delay
- `runExecutionStage` (Agent SDK `query()`) deliberately NOT wrapped — it manages its own error handling
- Confirmed all user-facing text in PipelineActions, PipelineLog, PipelineIndicator, AddCardForm, CardModal is Finnish
- No English user-facing strings found in phases 5-7 pipeline UI additions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add exponential backoff retry for Anthropic API calls** - `4f22926` (feat)
2. **Task 2: Finnish text audit for phases 5-7 UI additions** - no code changes required (audit confirmed all Finnish)

## Files Created/Modified
- `/Users/harimaa/Documents/src/workers/pipeline-stages.ts` - Added `withRetry<T>` wrapper function and applied it to three `anthropic.messages.create` calls

## Decisions Made
- `withRetry` uses duck-typed status check (`'status' in err && (err as { status: number }).status === 429`) rather than `instanceof Anthropic.APIError` — avoids tight SDK coupling and works reliably
- `runExecutionStage` excluded: Agent SDK `query()` handles errors internally and the for-await loop must consume all messages to prevent orphan processes
- Delays: 2s, 8s, 32s (base 2000ms * 4^attempt) — matches Anthropic's typical rate limit reset window per plan spec

## Deviations from Plan

None - plan executed exactly as written. Task 2 was a pure audit that confirmed all UI text is already Finnish; no file modifications were needed.

## Issues Encountered
- TypeScript compilation reports one pre-existing error in `src/workers/pipeline-worker.ts:78` (string not assignable to PipelineStatus). This is documented in STATE.md Blockers as a pre-existing issue predating Phase 8, out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline resilience complete: 429 rate limit errors now trigger automatic retry with exponential backoff
- Finnish UI fully verified across all pipeline components
- Phase 08 plan 02 complete

---
*Phase: 08-polish*
*Completed: 2026-03-01*
