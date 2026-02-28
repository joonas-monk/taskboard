---
phase: 05-ai-pipeline-foundation
plan: 01
subsystem: database
tags: [prisma, sqlite, wal, anthropic-sdk, typescript, zod]

# Dependency graph
requires:
  - phase: 04-drag-and-drop
    provides: Stable Card model with position/float ordering, Column model, working board UI
provides:
  - PipelineRun and PipelineMessage models migrated to SQLite
  - CardType and PipelineStatus enums in Prisma schema and generated client
  - WAL mode enabled on SQLite database for concurrent read/write
  - Anthropic SDK singleton at src/lib/anthropic.ts
  - Pipeline TypeScript types exported from src/types/index.ts
  - Zod validation schemas for pipeline Server Actions
affects:
  - 05-02-pipeline-worker
  - 05-03-pipeline-ui

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk@0.78.0 — Claude API client"
    - "better-sqlite3 (direct import for WAL pragma) — raw DB access before Prisma adapter"
  patterns:
    - "WAL mode via raw better-sqlite3 connection before Prisma adapter initialization"
    - "Anthropic SDK singleton exported from src/lib/anthropic.ts with PIPELINE_MODEL env override"
    - "Pipeline type re-exports from src/types/index.ts (consistent with existing Card/Column exports)"
    - "Finnish Zod error messages for pipeline Server Action schemas"

key-files:
  created:
    - src/lib/anthropic.ts
    - src/actions/ai-schemas.ts
    - prisma/migrations/20260228172026_add_pipeline_models/migration.sql
  modified:
    - prisma/schema.prisma
    - src/lib/prisma.ts
    - src/types/index.ts
    - src/components/board/AddCardForm.tsx
    - .env
    - package.json

key-decisions:
  - "WAL mode set via raw better-sqlite3 open/pragma/close before Prisma adapter — adapter constructor does not support pragma options"
  - "PIPELINE_MODEL env var allows model switching without code changes; defaults to claude-3-5-haiku-20241022 for fast/cheap planning"
  - "Anthropic SDK singleton in separate file (not prisma.ts) for clean separation of concerns"

patterns-established:
  - "Pipeline models use onDelete: Cascade (PipelineRun->Card, PipelineMessage->PipelineRun)"
  - "SerializedPipelineRun/SerializedPipelineMessage parallel the existing SerializedCard pattern"
  - "Optimistic cards in AddCardForm must include all SerializedCard fields including new enum defaults"

requirements-completed: [AI-08]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 5 Plan 1: AI Pipeline Foundation Summary

**SQLite WAL mode, Anthropic SDK singleton, PipelineRun/PipelineMessage schema migration, and pipeline TypeScript types enabling the Plan 02 worker process**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T17:19:49Z
- **Completed:** 2026-02-28T17:22:45Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Migrated SQLite database with PipelineRun and PipelineMessage tables, CardType/PipelineStatus enums, and Card.cardType/pipelineStatus fields (defaults GENERAL/IDLE)
- Enabled WAL journal mode on SQLite for concurrent Next.js + pipeline worker access
- Created Anthropic SDK singleton with model override support via PIPELINE_MODEL env var
- Added pipeline TypeScript types and Zod schemas for downstream pipeline Server Actions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Anthropic SDK and run Prisma migration** - `d6397b9` (feat)
2. **Task 1 auto-fix: Add cardType/pipelineStatus to optimistic card** - `ec5fbec` (fix)
3. **Task 2: Enable WAL mode, Anthropic singleton, types, schemas** - `e17cfcc` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added CardType/PipelineStatus enums, PipelineRun/PipelineMessage models, cardType/pipelineStatus fields on Card
- `prisma/migrations/20260228172026_add_pipeline_models/migration.sql` - Migration SQL
- `src/lib/prisma.ts` - Added WAL pragma via raw better-sqlite3 before Prisma adapter creation
- `src/lib/anthropic.ts` - New: Anthropic SDK singleton + PIPELINE_MODEL constant
- `src/types/index.ts` - Added CardType, PipelineStatus, PipelineRun, PipelineMessage re-exports; StartPipelineInput, PipelineStatusResult, SerializedPipelineRun, SerializedPipelineMessage types
- `src/actions/ai-schemas.ts` - New: startPipelineSchema and getPipelineStatusSchema Zod validators
- `src/components/board/AddCardForm.tsx` - Added cardType/pipelineStatus defaults to optimistic card
- `.env` - Added ANTHROPIC_API_KEY placeholder and PIPELINE_MODEL
- `package.json` / `package-lock.json` - Added @anthropic-ai/sdk dependency

## Decisions Made
- WAL mode set by opening a raw `better-sqlite3` connection, executing `pragma journal_mode = WAL`, then closing before creating the Prisma adapter. The Prisma adapter's constructor does not support pragma options.
- `PIPELINE_MODEL` env var defaults to `claude-3-5-haiku-20241022` for cost efficiency during Phase 5 development; easily changed for production without code changes.
- Anthropic singleton lives in `src/lib/anthropic.ts` (not prisma.ts) for clean separation of concerns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added cardType/pipelineStatus defaults to optimistic card in AddCardForm**
- **Found during:** Task 1 (after Prisma migration and TypeScript check)
- **Issue:** `SerializedCard` type now requires `cardType` and `pipelineStatus` fields (from new schema), but the optimistic card object in `AddCardForm.tsx` was missing these fields, causing TypeScript error TS2322
- **Fix:** Added `cardType: 'GENERAL'` and `pipelineStatus: 'IDLE'` defaults to the optimistic card object, matching the DB column defaults
- **Files modified:** `src/components/board/AddCardForm.tsx`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `ec5fbec` (separate fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for correctness — optimistic cards must match the SerializedCard type contract. No scope creep.

## Issues Encountered
- **Database locked during migration:** Dev server was running with open DB connection. Killed the process (PID 90277) and re-ran migration successfully. Not a code issue.

## User Setup Required

**External service requires manual configuration before Plan 02 can run the pipeline:**

1. Visit [console.anthropic.com](https://console.anthropic.com) -> API Keys -> Create Key
2. Copy the key and replace the placeholder in `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...your-actual-key...
   ```
3. Verify: `node -e "const Anthropic = require('@anthropic-ai/sdk'); const a = new Anthropic(); console.log('OK:', a.apiKey ? 'key set' : 'MISSING')"` — should print `OK: key set`

Without a valid API key, Plan 02 pipeline worker will throw authentication errors.

## Next Phase Readiness
- Database schema and Prisma client ready — Plan 02 can import PipelineRun/PipelineMessage models immediately
- WAL mode active — safe for concurrent Next.js + worker process DB access
- Anthropic singleton ready for import in worker code
- Type safety established — all pipeline types exported from canonical `src/types/index.ts`
- Zod schemas ready for pipeline Server Actions that Plan 02 will create
- Blocker: ANTHROPIC_API_KEY must be set before pipeline execution works

---
*Phase: 05-ai-pipeline-foundation*
*Completed: 2026-02-28*
