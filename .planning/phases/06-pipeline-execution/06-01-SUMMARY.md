---
phase: 06-pipeline-execution
plan: 01
subsystem: ai
tags: [claude-agent-sdk, anthropic-sdk, pipeline, execution, testing, workspace, typescript]

# Dependency graph
requires:
  - phase: 05-ai-pipeline-foundation
    provides: runPlanningStage, Anthropic SDK singleton, pipeline-stages.ts, prompts.ts
provides:
  - "@anthropic-ai/claude-agent-sdk installed and importable"
  - "src/lib/workspace.ts — getWorkspacePath and ensureWorkspace for per-card CODE execution dirs"
  - "Extended src/workers/prompts.ts — buildExecutionPrompt, buildExecutionPromptApi, buildTestingPrompt"
  - "Extended src/workers/pipeline-stages.ts — runExecutionStage (Agent SDK), runExecutionStageApi (Anthropic API), runTestingStage (Anthropic API)"
affects: [06-02, pipeline-worker, ai-pipeline]

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/claude-agent-sdk@0.2.63 — Claude Agent SDK for CODE card autonomous execution"
  patterns:
    - "Agent SDK query() with permissionMode: bypassPermissions + allowDangerouslySkipPermissions: true for CODE cards"
    - "for-await loop must consume all messages — never break early to prevent orphan processes"
    - "Explicit env pass to Agent SDK: ANTHROPIC_API_KEY, PATH, HOME"
    - "Anthropic messages.create pattern for non-CODE execution and testing stages"
    - "Workspace dirs at WORKSPACE_BASE/{cardId}/ created with mkdir recursive before Agent SDK call"

key-files:
  created:
    - src/lib/workspace.ts
  modified:
    - src/workers/prompts.ts
    - src/workers/pipeline-stages.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Use @anthropic-ai/claude-agent-sdk query() for CODE execution — typed API, bundles own Claude Code engine, no external CLI needed"
  - "runExecutionStage consumes all for-await messages without break — prevents orphan Claude Code subprocesses"
  - "Explicit env: { ANTHROPIC_API_KEY, PATH, HOME } in Agent SDK options — worker spawn env may be restricted"
  - "runExecutionStageApi uses Anthropic messages.create at max_tokens: 8096 — non-CODE cards produce comprehensive text output"
  - "runTestingStage uses PIPELINE_MODEL with max_tokens: 4096 — evaluation is shorter than execution"

patterns-established:
  - "Agent SDK pattern: query() with bypassPermissions + allowDangerouslySkipPermissions, consume full message stream"
  - "Workspace utility: getWorkspacePath returns path, ensureWorkspace creates and returns path"
  - "Stage function split: runExecutionStage (CODE, Agent SDK), runExecutionStageApi (non-CODE, Anthropic API)"

requirements-completed: [AI-02, AI-03]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 6 Plan 01: Pipeline Execution Stages Summary

**Claude Agent SDK installed with runExecutionStage (bypassPermissions CODE execution), runExecutionStageApi (Anthropic API for non-CODE), runTestingStage (HYVÄKSYTTY/HYLÄTTY evaluator), and per-card workspace utility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T20:29:06Z
- **Completed:** 2026-02-28T20:31:23Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed `@anthropic-ai/claude-agent-sdk@0.2.63` — autonomous CODE execution stage without external CLI
- Created `src/lib/workspace.ts` with `getWorkspacePath` and `ensureWorkspace` for per-card isolated file operation directories at `~/data/taskboard/workspaces/{cardId}/`
- Extended `prompts.ts` with three new Finnish prompt builders: `buildExecutionPrompt` (CODE), `buildExecutionPromptApi` (RESEARCH/BUSINESS/GENERAL), `buildTestingPrompt` (HYVÄKSYTTY/HYLÄTTY evaluator)
- Extended `pipeline-stages.ts` with `runExecutionStage` (Agent SDK, CODE cards), `runExecutionStageApi` (Anthropic API, non-CODE), and `runTestingStage` (all types)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Agent SDK, create workspace utility, add prompt builders** - `7c34ae8` (feat)
2. **Task 2: Implement execution and testing stage runners in pipeline-stages.ts** - `175ed10` (feat)

## Files Created/Modified
- `src/lib/workspace.ts` — `getWorkspacePath(cardId)` and `ensureWorkspace(cardId)` for per-card CODE workspace dirs
- `src/workers/prompts.ts` — Added `buildExecutionPrompt`, `buildExecutionPromptApi`, `buildTestingPrompt` (Finnish prompts; `buildPlanningPrompt` unchanged)
- `src/workers/pipeline-stages.ts` — Added `runExecutionStage` (Agent SDK + bypassPermissions), `runExecutionStageApi` (Anthropic API), `runTestingStage` (Anthropic API evaluator); `runPlanningStage` unchanged
- `package.json` / `package-lock.json` — Added `@anthropic-ai/claude-agent-sdk@0.2.63`

## Decisions Made
- Agent SDK `query()` chosen over CLI subprocess — types, bundled engine, no global `claude` binary required
- `for await` loop never breaks early — consuming all messages ensures Agent SDK subprocess terminates cleanly
- `env: { ANTHROPIC_API_KEY, PATH, HOME }` explicitly passed to Agent SDK — worker may have restricted environment from spawn
- `runExecutionStageApi` uses `max_tokens: 8096` vs `4096` in testing — execution of non-CODE tasks may produce longer output
- `runExecutionStage` throws on non-success result subtype — caller (pipeline-worker, Plan 02) handles the error and sets card to FAILED

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. ANTHROPIC_API_KEY must remain set in .env (existing requirement from Phase 5).

## Next Phase Readiness
- All three stage functions are importable and typed, ready for Plan 02 to wire into the pipeline-worker orchestration loop
- Workspace utility is ready for Plan 02 to call `ensureWorkspace()` before CODE card execution
- `runExecutionStage` and `runTestingStage` typed correctly for the worker to call with card object, planText, and executionResult

---
*Phase: 06-pipeline-execution*
*Completed: 2026-02-28*
