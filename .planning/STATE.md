---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-02-28T20:36:16Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 8
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** One place to capture ideas and track them through to completion — from idea to done, visually and with drag & drop.
**Current focus:** Phase 6 - Pipeline Execution (Plan 2 complete)

## Current Position

Phase: 6 of 6 (Pipeline Execution)
Plan: 2 of N in current phase (Plan 02 complete)
Status: Phase 6 in progress — Plan 02 complete
Last activity: 2026-02-28 — Phase 6 Plan 2 executed: Full 3-stage pipeline orchestration, pausePipeline action, retry-from-failed

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 3.9 min
- Total execution time: ~0.47 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Data Foundation | 1/1 | 10 min | 10 min |
| 2. Board Shell | 1/1 | 5 min | 5 min |
| 3. Card CRUD | 1/1 | 6 min | 6 min |
| 4. Drag and Drop | 1/1 | 2 min | 2 min |
| 5. AI Pipeline Foundation | 2/2 | 5 min | 2.5 min |
| 6. Pipeline Execution | 2/? | 4 min | 2 min |

**Recent Trend:**
- Last 5 plans: 5min, 6min, 2min, 3min, 2min
- Trend: fast

*Updated after each plan completion*
| Phase 04-drag-and-drop P01 | 2 | 2 tasks | 4 files |
| Phase 05-ai-pipeline-foundation P01 | 3 | 2 tasks | 7 files |
| Phase 05-ai-pipeline-foundation P02 | 2 | 2 tasks | 5 files |
| Phase 06-pipeline-execution P01 | 2 | 2 tasks | 5 files |
| Phase 06-pipeline-execution P02 | 2 | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Use Prisma 7 (not Drizzle) — stronger DX, schema-first, Prisma Studio; architecture patterns are identical for either ORM
- [Init]: Store SQLite database at absolute path outside project dir (`/var/data/taskboard/tasks.db`) — prevents data loss on redeploy
- [Init]: Use Next.js standalone output mode (not static export) — static export silently breaks Server Actions
- [01-01]: DATABASE_URL uses user-local path for development; production path /var/data/taskboard/ set during Phase 5 deployment
- [01-01]: Prisma 7 seed command configured in prisma.config.ts (not package.json) per Prisma 7 API
- [01-01]: Zod 4 used for validation (installed version); API compatible with plan's Zod 3 patterns
- [01-01]: Next.js 16 project scaffolded as prerequisite (greenfield project had no existing app)
- [Phase 02-01]: BoardLoader client wrapper: Next.js 16 disallows ssr:false in Server Components, dynamic import moved to thin client component
- [Phase 02-01]: Serialized types in src/types/index.ts (not page.tsx) to prevent client components importing from Server Component files
- [Phase 03-01]: Inline delete confirmation (not window.confirm) for polished UX
- [Phase 03-01]: Labels fetched via separate getLabels() with Promise.all, not merged into getBoard()
- [Phase 03-01]: Single CardModal at Board level, not per-Column, for clean DOM
- [Phase 04-drag-and-drop]: Use @dnd-kit/core 6.x (not @dnd-kit/react) — stable library; DndContext wraps full board for cross-column drags; PointerSensor 8px activationConstraint preserves card modal clicks
- [Phase 04-drag-and-drop]: Local columns state (useState) updated synchronously before awaiting Server Action in handleDragEnd — prevents snap-back flicker; useEffect syncs from serverColumns after revalidatePath
- [Phase 05-01]: WAL mode set via raw better-sqlite3 open/pragma/close before Prisma adapter — adapter constructor does not support pragma options
- [Phase 05-01]: PIPELINE_MODEL env var defaults to claude-3-5-haiku-20241022 for cost efficiency; easily changed without code changes
- [Phase 05-01]: Anthropic SDK singleton in src/lib/anthropic.ts (not prisma.ts) for clean separation of concerns
- [Phase 05-02]: Worker creates own PrismaClient + Anthropic instance — separate OS process cannot share Next.js globalThis
- [Phase 05-02]: stdio: ignore on spawn — worker errors tracked via PipelineRun.error in DB, not console
- [Phase 05-02]: startPipeline allows retry from FAILED state — enables re-running pipeline on previously failed cards
- [Phase 05-02]: AI-01 auto-start via fire-and-forget startPipeline().catch() in createTask — pipeline errors don't fail card creation
- [Phase 06-01]: Use @anthropic-ai/claude-agent-sdk query() for CODE execution — typed API, bundles own Claude Code engine, no external CLI needed
- [Phase 06-01]: runExecutionStage consumes all for-await messages without break — prevents orphan Claude Code subprocesses
- [Phase 06-01]: Explicit env: { ANTHROPIC_API_KEY, PATH, HOME } in Agent SDK options — worker spawn env may be restricted
- [Phase 06-01]: runExecutionStageApi uses max_tokens: 8096 — non-CODE cards may produce longer execution output
- [Phase 06-01]: runTestingStage uses max_tokens: 4096 — evaluation output is shorter than execution output
- [Phase 06-02]: checkPaused() always queries DB fresh — never caches — worker sees PAUSED flag the moment it is set
- [Phase 06-02]: advanceToStage() uses $transaction to atomically update PipelineRun stage/status AND Card columnId/position/pipelineStatus
- [Phase 06-02]: Retry point determined by latestRun.stage — worker loads prior messages by artifactType to reconstruct planText and execResult
- [Phase 06-02]: startPipeline accepts PAUSED state alongside IDLE and FAILED — worker determines start stage from previous run
- [Phase 06-02]: HOME passed in worker spawn env — required by WORKSPACE_BASE default in workspace.ts and Agent SDK env option

### Pending Todos

None.

### Blockers/Concerns

- [Phase 1]: ORM inconsistency resolved — committed to Prisma 7 with working schema and migration.
- [Phase 4]: Float ordering edge cases now specified — initial spacing 1000, rebalance threshold 0.001, position utilities implemented.
- [Phase 5-01]: ANTHROPIC_API_KEY must be set in .env before pipeline execution (currently placeholder sk-ant-...your-key-here)

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 06-02-PLAN.md (Pipeline Execution). Plan 02 complete. Full 3-stage pipeline orchestration, pausePipeline action, retry-from-failed-stage implemented.
Resume file: None
