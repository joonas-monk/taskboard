---
phase: 07-pipeline-ui
plan: 02
subsystem: ui
tags: [react, nextjs, server-actions, pipeline, modal, tabs]

# Dependency graph
requires:
  - phase: 07-pipeline-ui-plan-01
    provides: PipelineIndicator, Board polling, pipelineStatus on SerializedCard
  - phase: 06-pipeline-execution
    provides: getPipelineStatus, startPipeline, pausePipeline Server Actions, PipelineRun/PipelineMessage models
provides:
  - PipelineActions component (pause/retry/start buttons per pipeline status)
  - PipelineLog component (fetches and renders AI conversation with fi-FI timestamps)
  - Tabbed CardModal (Kortti + Tekoaly-loki tabs for non-IDLE cards)
affects: [future UI phases, any phase adding pipeline interaction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useEffect with cancelled flag for async Server Action fetch in client components"
    - "Tab state reset via useEffect dependency on card — prevents stale tab between card switches"
    - "router.refresh() for immediate UI feedback after pipeline mutations"

key-files:
  created:
    - src/components/board/PipelineActions.tsx
    - src/components/board/PipelineLog.tsx
  modified:
    - src/components/board/CardModal.tsx

key-decisions:
  - "PipelineActions committed as part of 07-01 execution — no re-commit needed in 07-02"
  - "onStatusChange calls router.refresh() for immediate feedback after pause/start, while Board polling handles background updates"
  - "Tab resets to 'kortti' in the same useEffect that resets confirmDelete — single effect for all card-change resets"
  - "IDLE cards show no tabs — original single-form layout fully preserved"

patterns-established:
  - "Tab isolation: activeTab reset on card change prevents cross-card tab state contamination"
  - "Cancelled flag pattern: useEffect cleanup sets cancelled=true to prevent setState after unmount"

requirements-completed: [AI-06, AI-07]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 7 Plan 02: Pipeline UI Summary

**Tabbed CardModal with Tekoaly-loki tab showing AI conversation log, pause/retry/start pipeline controls, and fi-FI formatted message timestamps**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T20:56:49Z
- **Completed:** 2026-02-28T21:00:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- PipelineActions component renders correct action button per pipeline status (Pysayta for active, Kaynnista uudelleen for failed/paused, Kaynnista pipeline for idle)
- PipelineLog fetches pipeline run and messages via getPipelineStatus Server Action, re-fetches when currentStatus changes
- CardModal extended with Kortti/Tekoaly-loki tab navigation — IDLE cards get original form layout with no tabs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PipelineActions and PipelineLog components** - `0e1c748` (feat — included in 07-01 commit)
2. **Task 2: Add tab UI to CardModal with Tekoaly-loki integration** - `138f9fb` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/board/PipelineActions.tsx` - Pause/retry/start buttons based on PAUSEABLE/RETRIABLE/STARTABLE sets; uses useTransition; shows error text on failure
- `src/components/board/PipelineLog.tsx` - Fetches pipeline status via Server Action; renders run stage/status badges, error box, message list with Jarjestelma/Tekoaly labels and fi-FI timestamps, PipelineActions at bottom
- `src/components/board/CardModal.tsx` - Added Tab type, activeTab state, tab nav (hidden for IDLE), conditional rendering of form vs PipelineLog; router.refresh() on pipeline action

## Decisions Made
- `onStatusChange` uses `router.refresh()` rather than a no-op — provides immediate feedback after pause/start while Board.tsx polling handles background sync
- Tab reset included in existing `useEffect` on `[card]` alongside `confirmDelete` reset — keeps all card-change resets co-located
- `as unknown as SerializedPipelineRun` cast in PipelineLog — React serializes Date objects from Server Actions automatically; this is the correct pattern per project conventions

## Deviations from Plan

None - plan executed exactly as written.

Note: PipelineActions.tsx and PipelineLog.tsx were created in this plan execution but were committed in the 07-01 commit. This was discovered when git status showed them as already tracked — they were written identically to the 07-01 commit content (same implementation). No re-commit needed; the task deliverables are present and correct.

## Issues Encountered
- Pre-existing TypeScript error in `src/workers/pipeline-worker.ts` line 78 (type string not assignable to PipelineStatus) — out of scope, pre-existing, not caused by 07-02 changes. Logged for deferred resolution.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline UI layer is complete: card indicators, Board polling, and modal tabs with conversation log all wired up
- Full pipeline lifecycle visible in UI: card status indicators on board, Tekoaly-loki tab in modal with message history
- AI-06 and AI-07 requirements satisfied
- Ready for Phase 8 or further polish phases

---
*Phase: 07-pipeline-ui*
*Completed: 2026-02-28*

## Self-Check: PASSED

- FOUND: src/components/board/PipelineActions.tsx
- FOUND: src/components/board/PipelineLog.tsx
- FOUND: src/components/board/CardModal.tsx
- FOUND: .planning/phases/07-pipeline-ui/07-02-SUMMARY.md
- FOUND commit: 0e1c748 (PipelineActions + PipelineLog, included in 07-01)
- FOUND commit: 138f9fb (CardModal tabbed UI)
