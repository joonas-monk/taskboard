---
phase: 08-polish
plan: 01
subsystem: api
tags: [pipeline, sqlite, concurrency, reliability, prisma]

# Dependency graph
requires:
  - phase: 05-ai-pipeline-foundation
    provides: startPipeline Server Action, PrismaClient singleton
  - phase: 06-pipeline-execution
    provides: PipelineRun model, pipeline worker execution
provides:
  - Concurrent pipeline guard in startPipeline (one pipeline active at a time)
  - Stale pipeline recovery on server start (QUEUED/PLANNING/EXECUTING/TESTING -> FAILED)
affects: [future pipeline plans, pipeline-worker]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Check-then-set concurrency guard for SQLite single-writer safety"
    - "Fire-and-forget async IIFE for server startup side effects"

key-files:
  created: []
  modified:
    - src/actions/ai.ts
    - src/lib/prisma.ts

key-decisions:
  - "Concurrent guard uses findFirst check-then-set (not transaction lock) -- safe for single-user SQLite, no real race conditions"
  - "Stale recovery uses findMany + individual updates (not updateMany) to also update associated PipelineRun per card"
  - "Stale recovery runs in fire-and-forget IIFE after prisma singleton -- errors are caught and logged, never block server start"
  - "In dev with hot reload, globalForPrisma check prevents re-running recovery on every reload (prisma instance reused)"

patterns-established:
  - "Startup IIFE pattern: fire-and-forget async block after prisma export for one-time initialization side effects"

requirements-completed: []

# Metrics
duration: 1min
completed: 2026-03-01
---

# Phase 8 Plan 1: Pipeline State Guards Summary

**Concurrent pipeline guard (findFirst check before QUEUED set) and stale pipeline recovery IIFE (server-start reset of QUEUED/PLANNING/EXECUTING/TESTING to FAILED) for SQLite reliability**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-01T07:48:36Z
- **Completed:** 2026-03-01T07:49:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- startPipeline now queries for any active pipeline before spawning a worker, returning a Finnish error if one exists
- Stale pipelines from crashed workers are reset to FAILED on every server start (module load)
- Each stale card's latest PipelineRun is also marked FAILED with a Finnish error message for user feedback
- All error messages are in Finnish, TypeScript compiles without new errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add concurrent pipeline guard to startPipeline** - `69f537b` (feat)
2. **Task 2: Add stale pipeline recovery on server start** - `d02a3c7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/actions/ai.ts` - Added findFirst concurrency guard before setting card to QUEUED
- `src/lib/prisma.ts` - Added stale pipeline recovery IIFE after prisma singleton assignment

## Decisions Made
- Concurrent guard uses check-then-set without a transaction lock: single-user SQLite has no real race conditions, a simple findFirst is sufficient
- Stale recovery uses individual card updates (not updateMany) so each card's associated PipelineRun can also be updated with the Finnish error message
- Recovery errors are caught and logged to console without rethrowing -- a failed recovery must not prevent the server from starting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in src/workers/pipeline-worker.ts line 78 (string not assignable to PipelineStatus) was already noted in STATE.md as out of scope and predates this plan. No new TypeScript errors were introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Pipeline state management is now hardened for production: concurrent requests are rejected gracefully, and server restarts clean up stuck pipelines
- Phase 8 Plan 2 can proceed

---
*Phase: 08-polish*
*Completed: 2026-03-01*
