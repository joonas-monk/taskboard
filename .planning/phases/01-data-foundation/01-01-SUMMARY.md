---
phase: 01-data-foundation
plan: 01
subsystem: database
tags: [prisma, sqlite, better-sqlite3, zod, server-actions, typescript]

# Dependency graph
requires: []
provides:
  - Prisma 7 schema with Column, Card, Label, CardLabel models and Priority enum
  - SQLite database with migration applied and seeded data (5 columns, 4 labels)
  - PrismaClient singleton with better-sqlite3 adapter
  - TypeScript types: Card, Column, Label, CardLabel, Priority, CardWithLabels, ColumnWithCards, ActionResult<T>
  - Input types: CreateTaskInput, UpdateTaskInput, MoveTaskInput, ReorderTasksInput
  - Float position utilities: midpoint, positionAfterLast, positionBeforeFirst, rebalancePositions
  - Server Action stubs with Zod validation (createTask, updateTask, moveTask, deleteTask, reorderTasks)
  - Fully implemented getBoard() query function
affects: [02-board-shell, 03-card-crud, 04-drag-and-drop]

# Tech tracking
tech-stack:
  added: [prisma@7.4.2, @prisma/client@7.4.2, @prisma/adapter-better-sqlite3@7.4.2, dotenv@17.3.1, zod@4.3.6, tsx@4.21.0]
  patterns: [prisma-7-config, better-sqlite3-adapter, globalThis-singleton, discriminated-union-action-result, float-position-ordering, zod-validation-schemas]

key-files:
  created:
    - prisma/schema.prisma
    - prisma.config.ts
    - prisma/seed.ts
    - prisma/migrations/20260228111923_init/migration.sql
    - src/lib/prisma.ts
    - src/types/index.ts
    - src/lib/positions.ts
    - src/actions/schemas.ts
    - src/actions/tasks.ts
  modified:
    - package.json
    - .gitignore

key-decisions:
  - "DATABASE_URL uses user-local path for development; production path /var/data/taskboard/ set during Phase 5 deployment"
  - "Prisma 7 seed command configured in prisma.config.ts (not package.json) per Prisma 7 API"
  - "Zod 4 used for validation (installed version); API compatible with plan's Zod 3 patterns"
  - "Next.js 16 project scaffolded as prerequisite (greenfield project had no existing app)"

patterns-established:
  - "Prisma 7 config: prisma.config.ts at root with defineConfig, env(), seed command"
  - "Import from generated path: '../generated/prisma/client' not '@prisma/client'"
  - "PrismaClient singleton: globalThis pattern with better-sqlite3 adapter"
  - "ActionResult<T> discriminated union for all Server Action responses"
  - "Zod validation in Server Actions: safeParse then return typed error"
  - "Float positions: 1000-gap spacing, midpoint for inserts, rebalance when gap < 0.001"
  - "Finnish error messages in Zod schemas (UI language is Finnish)"

requirements-completed: [DATA-01]

# Metrics
duration: 10min
completed: 2026-02-28
---

# Phase 1 Plan 1: Data Foundation Summary

**Prisma 7 schema with SQLite (Column/Card/Label/CardLabel + Priority enum), typed PrismaClient singleton, ActionResult<T> types, float position utilities, and Server Action stubs with Zod 4 validation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-28T11:15:09Z
- **Completed:** 2026-02-28T11:25:21Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Prisma 7 schema with 4 models (Column, Card, Label, CardLabel) and Priority enum, migration applied to SQLite
- Database seeded with 5 Finnish columns (Idea, Suunnittelu, Toteutus, Testaus, Valmis) and 4 default labels (Bugi, Ominaisuus, Kiireinen, Parannus) using idempotent upserts
- PrismaClient singleton with better-sqlite3 adapter and globalThis hot-reload pattern
- Full TypeScript type system: re-exported Prisma types, composite types (CardWithLabels, ColumnWithCards), ActionResult<T> discriminated union, and 4 input types
- Float position utilities for drag-and-drop card ordering with rebalance detection
- 5 Server Action stubs with Zod validation returning typed ActionResult, plus fully implemented getBoard() query
- Zero `any` types across all data layer files; `npx tsc --noEmit` passes clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema, config, migration, and seed** - `0c5f560` (feat)
2. **Task 2: PrismaClient singleton, TypeScript types, and position utilities** - `d37e135` (feat)
3. **Task 3: Server Action stubs with Zod validation schemas** - `c43de56` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Data model with Column, Card, Label, CardLabel models and Priority enum
- `prisma.config.ts` - Prisma 7 config with DATABASE_URL, migration path, and seed command
- `prisma/seed.ts` - Seed script for 5 columns and 4 default labels (idempotent upsert)
- `prisma/migrations/20260228111923_init/migration.sql` - Initial migration SQL
- `src/lib/prisma.ts` - PrismaClient singleton with better-sqlite3 adapter
- `src/types/index.ts` - Re-exported Prisma types, composite types, ActionResult<T>, input types
- `src/lib/positions.ts` - Float position utilities for card ordering
- `src/actions/schemas.ts` - Zod validation schemas for all Server Action inputs
- `src/actions/tasks.ts` - Server Action stubs and getBoard() query function
- `package.json` - Dependencies added, prisma seed config
- `.gitignore` - Configured for project files, generated Prisma client, personal files

## Decisions Made
- **Dev database path:** Used `file:/Users/harimaa/data/taskboard/taskboard.db` for development since `/var/data/taskboard/` requires sudo; production path set in Phase 5 `.env`
- **Prisma 7 seed location:** Configured seed command in `prisma.config.ts` (not `package.json`) because Prisma 7 changed the seed configuration location
- **Zod 4 compatibility:** Zod 4.3.6 was installed (latest); API is compatible with plan's Zod 3 patterns (safeParse, z.object, z.enum, z.array all work identically)
- **Next.js scaffolding:** Created Next.js 16 project as prerequisite since this was a greenfield project with no existing app structure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js project scaffold required**
- **Found during:** Task 1 (before any Prisma work)
- **Issue:** The project directory contained only `.planning/` and `.git/` with no Next.js app, `package.json`, or `tsconfig.json`. The plan assumed an existing Next.js project.
- **Fix:** Ran `npx create-next-app@latest` with TypeScript, Tailwind, App Router, src directory, then moved contents to project root (where git repo lives).
- **Files modified:** All Next.js scaffold files (package.json, tsconfig.json, next.config.ts, etc.)
- **Verification:** `npm install` and `npx tsc --noEmit` pass; Next.js dev server starts
- **Committed in:** 0c5f560 (Task 1 commit)

**2. [Rule 3 - Blocking] Database directory requires sudo**
- **Found during:** Task 1 (step 1e)
- **Issue:** `/var/data/taskboard/` requires root access to create on macOS; `sudo` not available in sandbox
- **Fix:** Used `~/data/taskboard/` for development; production path `/var/data/taskboard/` configured during Phase 5 deployment
- **Files modified:** .env
- **Verification:** Database file exists and is queryable at the user-accessible path
- **Committed in:** 0c5f560 (Task 1 commit)

**3. [Rule 1 - Bug] Prisma 7 seed command location changed**
- **Found during:** Task 1 (step 1h)
- **Issue:** `npx prisma db seed` failed because Prisma 7 reads seed command from `prisma.config.ts`, not from `package.json`'s `prisma.seed` field
- **Fix:** Added `seed: 'npx tsx prisma/seed.ts'` to the `migrations` section of `prisma.config.ts`
- **Files modified:** prisma.config.ts
- **Verification:** `npx prisma db seed` runs successfully; re-running produces no duplicates
- **Committed in:** 0c5f560 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for execution in the actual environment. No scope creep.

## Issues Encountered
- Top-level `await` not supported by tsx with CJS output format when using `npx tsx -e` inline scripts; worked around by writing verification scripts as files with async `main()` wrapper
- `create-next-app` interactive prompt (React Compiler question) required `--yes` flag for non-interactive execution

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full data foundation is ready for Phase 2 (Board Shell)
- `getBoard()` is fully implemented and returns 5 columns with cards ordered by position
- All Server Action stubs are callable and return typed responses; Phase 3 fills in actual implementations
- TypeScript types are ready for import via `@/types` path alias
- Zero type errors across the project

## Self-Check: PASSED

- All 11 key files verified present on disk
- All 3 task commits verified in git history (0c5f560, d37e135, c43de56)

---
*Phase: 01-data-foundation*
*Completed: 2026-02-28*
