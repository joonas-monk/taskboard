---
phase: 07-pipeline-ui
plan: 01
subsystem: ui
tags: [react, nextjs, polling, pipeline, kanban, tailwind]

# Dependency graph
requires:
  - phase: 06-pipeline-execution
    provides: pipelineStatus on Card model, PipelineRun orchestration
  - phase: 05-ai-pipeline-foundation
    provides: CardType and PipelineStatus enums in Prisma schema
provides:
  - Card type dropdown in AddCardForm (Idea column only) with 4 Finnish options
  - PipelineIndicator component showing spinner/badge for non-IDLE pipeline statuses
  - Board auto-polling every 5s via router.refresh() when active pipelines exist
  - createTask stores selected cardType in database
affects: [pipeline-ux, board-refresh, card-creation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - isIdeaColumn prop pattern for column-conditional UI
    - Inline styles for status colors (Tailwind v4 dynamic class limitation)
    - setInterval polling with useEffect + columns dependency for auto-stop

key-files:
  created:
    - src/components/board/PipelineIndicator.tsx
  modified:
    - src/types/index.ts
    - src/actions/schemas.ts
    - src/actions/tasks.ts
    - src/components/board/Column.tsx
    - src/components/board/AddCardForm.tsx
    - src/components/board/Card.tsx
    - src/components/board/Board.tsx

key-decisions:
  - "isIdeaColumn prop passed from Column to AddCardForm - column name check done once at Column level, not repeated in child"
  - "Polling uses columns as useEffect dependency so interval re-evaluates on every server data refresh, stopping when no active pipelines remain"
  - "PipelineIndicator returns null for IDLE status - zero overhead for non-pipeline cards"
  - "cardType defaults to GENERAL in createTask - schema validates enum but permits omission from non-Idea columns"

patterns-established:
  - "PipelineIndicator pattern: inline styles for dynamic status colors, animate-spin class for spinner"
  - "Column-conditional UI: pass boolean prop from Column to child components instead of checking column name inside children"

requirements-completed: [AI-04, AI-05]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 7 Plan 1: Pipeline UI Summary

**Card type dropdown in Idea column + PipelineIndicator spinner/badge on card faces + 5s Board auto-polling when active pipelines exist**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T20:56:47Z
- **Completed:** 2026-02-28T20:58:55Z
- **Tasks:** 2
- **Files modified:** 7 (1 created)

## Accomplishments
- Card type dropdown visible only in Idea column with 4 Finnish options (Yleinen default), resets on form close
- PipelineIndicator renders animated spinner for active statuses (QUEUED/PLANNING/EXECUTING/TESTING) and colored badge for terminal statuses
- Board polls every 5s via router.refresh() when active pipelines exist, automatically stops when all return to IDLE/terminal
- createTask now stores selected cardType to database (defaults to GENERAL for non-Idea columns)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cardType to types, schema, and AddCardForm selector** - `0e1c748` (feat)
2. **Task 2: Create PipelineIndicator, embed in Card, add Board polling** - `3a4cfcf` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/types/index.ts` - Added `cardType?: CardType` to CreateTaskInput
- `src/actions/schemas.ts` - Added `cardType` z.enum validation to createTaskSchema
- `src/actions/tasks.ts` - Pass `cardType` (default GENERAL) to prisma.card.create
- `src/components/board/Column.tsx` - Pass `isIdeaColumn={column.name === 'Idea'}` to AddCardForm
- `src/components/board/AddCardForm.tsx` - Added isIdeaColumn prop, cardType state, select dropdown, reset on close
- `src/components/board/PipelineIndicator.tsx` - New component: spinner + Finnish status labels (inline styles)
- `src/components/board/Card.tsx` - Import and render PipelineIndicator below card title
- `src/components/board/Board.tsx` - Add useRouter + polling useEffect with 5s interval

## Decisions Made
- `isIdeaColumn` prop computed at Column level (checking `column.name === 'Idea'`) and passed down — keeps child components unaware of column semantics
- Polling useEffect depends on `[columns, router]` — re-runs on every server refresh so polling stops automatically when active statuses clear
- `PipelineIndicator` returns `null` for IDLE — zero DOM cost for the common case
- Spinner uses `border-2 animate-spin` with inline style for `borderTopColor: 'transparent'` — Tailwind v4 can't compose dynamic class names for specific border sides

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `src/workers/pipeline-worker.ts` line 78 (Type 'string' not assignable to PipelineStatus). This error predates this plan and is out of scope per deviation rules. Logged here for awareness.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PipelineIndicator is ready for real pipeline status updates
- Board polling will automatically activate when pipeline worker advances card status to QUEUED/PLANNING/EXECUTING/TESTING
- No additional setup required — cards created in Idea column will auto-start pipeline and board will show live progress

## Self-Check: PASSED

- FOUND: src/components/board/PipelineIndicator.tsx
- FOUND: src/components/board/AddCardForm.tsx
- FOUND: .planning/phases/07-pipeline-ui/07-01-SUMMARY.md
- FOUND commit 0e1c748: feat(07-01): add cardType to types, schema, createTask, and AddCardForm selector
- FOUND commit 3a4cfcf: feat(07-01): add PipelineIndicator component, embed in Card, add Board polling

---
*Phase: 07-pipeline-ui*
*Completed: 2026-02-28*
