# Phase 6: Pipeline Execution - Research

**Researched:** 2026-02-28
**Domain:** Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), multi-stage pipeline orchestration, pause/retry state machine, workspace management
**Confidence:** HIGH

## Summary

Phase 6 extends the existing Phase 5 pipeline worker to run the full three-stage pipeline: plan (Anthropic API, already implemented), execute (Claude Agent SDK for CODE cards, Anthropic API for others), and test (Anthropic API reviewing output). The key architectural decision — confirmed in the additional context — is to use the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) for CODE execution rather than shelling out to a `claude` CLI binary. This is the correct choice: the Agent SDK bundles its own Claude Code engine, requires only `npm install`, and provides a typed TypeScript interface with `permissionMode: 'bypassPermissions'` for autonomous file operations.

The phase also implements two control flows: **pause** (worker checks a DB flag between stages and exits without advancing) and **retry** (worker resumes from the failed stage rather than replaying from the beginning). Both are achievable with the existing schema — `PipelineStatus.PAUSED` and `PipelineStatus.FAILED` already exist, and a `currentStage` field on `PipelineRun` lets the worker know where to resume.

The existing worker architecture (detached tsx process, own PrismaClient, env passed via spawn) is the right foundation. Phase 6 extends it — it does not replace it.

**Primary recommendation:** Install `@anthropic-ai/claude-agent-sdk`, extend `pipeline-worker.ts` with execution and testing stages, add pause-check between stages, and pass `planText` from the planning stage into the execution prompt. One new PipelineRun per pipeline attempt; stages are tracked by updating `PipelineRun.stage`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-02 | AI executes the plan (Claude Code CLI for code, Claude API for others) and moves card to Toteutus → Testaus | Verified: Claude Agent SDK provides `query()` with `cwd`, `permissionMode: 'bypassPermissions'` for CODE cards; Anthropic `messages.create` for RESEARCH/BUSINESS/GENERAL; column movement uses existing Prisma pattern from Phase 5 |
| AI-03 | AI verifies/tests the output and moves card to Valmis when complete | Verified: Testing stage uses Anthropic `messages.create` passing execution output; moves card to Valmis on success; existing PipelineMessage model stores test report |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/claude-agent-sdk` | latest (0.1.x) | CODE execution stage — autonomous file ops, Bash | Official SDK; bundles Claude Code engine; typed TypeScript; no external CLI needed |
| `@anthropic-ai/sdk` | 0.78.0 (already installed) | Planning + testing stages (all non-CODE types) | Already in use for Phase 5 planning stage |
| `tsx` | 4.21.0 (already installed) | Run the worker TypeScript file as detached process | Already in use from Phase 5 |
| `better-sqlite3` + `@prisma/adapter-better-sqlite3` | existing | Worker's PrismaClient for stage tracking and pause checks | Already established pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` (built-in) | Node 24 | Create/read workspace directory | When setting up per-card workspace for CODE execution |
| `node:path` (built-in) | Node 24 | Construct workspace paths | Throughout worker for absolute path handling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@anthropic-ai/claude-agent-sdk` | `child_process.spawn('claude', ...)` | CLI must be installed globally; no typed API; harder to collect output; Agent SDK is the canonical way to run Claude Code programmatically |
| `@anthropic-ai/claude-agent-sdk` | `claude --print --output-format json` via spawn | Same as above — Agent SDK is the replacement for this pattern |
| Separate PipelineRun per stage | One PipelineRun tracking current stage | Per-stage runs increase complexity; one run with `stage` field update is simpler and matches existing schema |

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk
```

Note: `@anthropic-ai/claude-agent-sdk` bundles its own Claude Code engine via `@anthropic-ai/claude-code` dependency. No external `claude` CLI installation required. Requires only `ANTHROPIC_API_KEY`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── actions/
│   └── ai.ts                   # MODIFIED: pausePipeline action, update startPipeline for FAILED retry
├── workers/
│   ├── pipeline-worker.ts      # MODIFIED: add execution + testing stages, pause checks
│   ├── pipeline-stages.ts      # MODIFIED: add runExecutionStage(), runTestingStage()
│   └── prompts.ts              # MODIFIED: add buildExecutionPrompt(), buildTestingPrompt()
└── lib/
    └── workspace.ts            # NEW: createWorkspace(cardId), getWorkspacePath(cardId)
```

Workspace per card: `~/data/taskboard/workspaces/{cardId}/`

### Pattern 1: Full Pipeline State Machine in Worker

**What:** The worker runs three stages in sequence, checking for pause between each. Stage transitions update both `PipelineRun.stage` and `Card.pipelineStatus` and move the card to the appropriate column.

**Stage → Column mapping:**
- PLANNING → Suunnittelu (already implemented in Phase 5)
- EXECUTING → Toteutus
- TESTING → Testaus
- COMPLETED → Valmis

**State machine:**
```
QUEUED → PLANNING → (pause check) → EXECUTING → (pause check) → TESTING → COMPLETED
                                                                          ↓
                                                                       FAILED (any stage)
                PAUSED (pause flag set between stages)
```

**Example:**
```typescript
// src/workers/pipeline-worker.ts (Phase 6 extension)
async function main() {
  // ... load card, create PipelineRun (from Phase 5) ...

  // Stage 1: Planning (already exists from Phase 5)
  const planText = await runPlanningStage(card)
  await savePipelineMessage(run.id, 'user', planPrompt)
  await savePipelineMessage(run.id, 'assistant', planText, 'plan')
  await updateStage(run.id, card.id, 'EXECUTING', toteutusColumnId, newPosition)

  // Pause check before execution
  if (await isPaused(card.id)) {
    await prisma.card.update({ where: { id: card.id }, data: { pipelineStatus: 'PAUSED' } })
    await prisma.pipelineRun.update({ where: { id: run.id }, data: { status: 'PAUSED' } })
    return
  }

  // Stage 2: Execution
  const execResult = await runExecutionStage(card, planText, workspacePath)
  await savePipelineMessage(run.id, 'assistant', execResult, 'code')
  await updateStage(run.id, card.id, 'TESTING', testausColumnId, newPosition)

  // Pause check before testing
  if (await isPaused(card.id)) {
    await prisma.card.update({ where: { id: card.id }, data: { pipelineStatus: 'PAUSED' } })
    await prisma.pipelineRun.update({ where: { id: run.id }, data: { status: 'PAUSED' } })
    return
  }

  // Stage 3: Testing
  const testResult = await runTestingStage(card, planText, execResult)
  await savePipelineMessage(run.id, 'assistant', testResult, 'test_report')
  await updateStage(run.id, card.id, 'COMPLETED', valmisColumnId, newPosition)
}
```

### Pattern 2: Claude Agent SDK for CODE Execution

**What:** Use `@anthropic-ai/claude-agent-sdk`'s `query()` function with `permissionMode: 'bypassPermissions'` and `cwd` set to the card's workspace directory. Collect assistant text messages to form the execution report.

**Key options:**
- `cwd`: card workspace directory (`~/data/taskboard/workspaces/{cardId}/`)
- `permissionMode: 'bypassPermissions'`: autonomous execution, no prompts
- `allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']`: full code tools
- `maxTurns: 30`: prevent runaway agents (within 10-minute timeout)
- `env: { ANTHROPIC_API_KEY: ... }`: pass API key explicitly

**Example:**
```typescript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

export async function runExecutionStage(
  card: { id: string; title: string; cardType: CardType },
  planText: string,
  workspacePath: string,
): Promise<string> {
  const prompt = buildExecutionPrompt(card.title, planText)
  const outputParts: string[] = []

  for await (const message of query({
    prompt,
    options: {
      cwd: workspacePath,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      maxTurns: 30,
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        PATH: process.env.PATH!,
      },
    },
  })) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if ('text' in block && block.text) {
          outputParts.push(block.text)
        }
      }
    } else if (message.type === 'result') {
      // Final result — check for errors
      if (message.subtype !== 'success') {
        throw new Error(`Suoritus epäonnistui: ${message.subtype}`)
      }
    }
  }

  return outputParts.join('\n\n') || 'Suoritus valmis (ei tekstituotosta)'
}
```

### Pattern 3: Anthropic API for Non-CODE Execution (RESEARCH, BUSINESS, GENERAL)

**What:** For non-CODE cards, execution means calling `messages.create` with the plan and asking Claude to execute/research/analyze the task in text. No file operations needed.

**Example:**
```typescript
// Source: Phase 5 planning stage pattern (verified working)
export async function runExecutionStageApi(
  card: { title: string; description: string },
  planText: string,
): Promise<string> {
  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: PIPELINE_MODEL,
    max_tokens: 8096,
    messages: [
      { role: 'user', content: buildExecutionPrompt(card.title, planText) },
    ],
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Ei tekstisisältöä API-vastauksessa')
  }
  return textBlock.text
}
```

### Pattern 4: Pause Check Between Stages

**What:** Before advancing to the next stage, the worker re-reads the card's `pipelineStatus` from the database. If it is `PAUSED`, the worker exits cleanly without advancing.

**The pause is set by a `pausePipeline` Server Action** (new in Phase 6) that updates `pipelineStatus` to `PAUSED`. The worker checks this DB flag — no IPC, no signals needed.

**Example:**
```typescript
async function checkPaused(cardId: string): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { pipelineStatus: true },
  })
  return card?.pipelineStatus === 'PAUSED'
}
```

**Pause action:**
```typescript
// src/actions/ai.ts
export async function pausePipeline(input: { cardId: string }): Promise<ActionResult<void>> {
  // Can only pause PLANNING, EXECUTING, or TESTING states
  const card = await prisma.card.findUnique({ where: { id: input.cardId }, select: { pipelineStatus: true } })
  const pauseable = ['PLANNING', 'EXECUTING', 'TESTING']
  if (!card || !pauseable.includes(card.pipelineStatus)) {
    return { success: false, error: 'Pipeline ei ole käynnissä' }
  }
  await prisma.card.update({ where: { id: input.cardId }, data: { pipelineStatus: 'PAUSED' } })
  revalidatePath('/')
  return { success: true, data: undefined }
}
```

**How retry from failed stage works:** The existing `startPipeline` already allows retry from `FAILED` state. For Phase 6, the worker needs to detect the last completed stage from the previous `PipelineRun` and skip to the next one. The simplest approach: read the latest `PipelineRun.stage` for this card — if it was `PLANNING` and status is `FAILED`, start from execution stage. This avoids re-running the planning API call.

### Pattern 5: Workspace Directory Creation

**What:** For CODE cards, create a workspace directory before the execution stage. Each card gets its own isolated directory.

**Example:**
```typescript
// src/lib/workspace.ts
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const WORKSPACE_BASE = process.env.WORKSPACE_BASE ?? `${process.env.HOME}/data/taskboard/workspaces`

export function getWorkspacePath(cardId: string): string {
  return path.join(WORKSPACE_BASE, cardId)
}

export async function ensureWorkspace(cardId: string): Promise<string> {
  const workspacePath = getWorkspacePath(cardId)
  await mkdir(workspacePath, { recursive: true })
  return workspacePath
}
```

### Anti-Patterns to Avoid

- **Spawning `claude` CLI directly via `child_process.exec`:** The `claude` binary may not be installed on the system. Use `@anthropic-ai/claude-agent-sdk` which bundles its own engine.
- **Sharing the Agent SDK query() across stages:** Each stage should be a fresh `query()` call. Stages are logically independent.
- **Blocking the main process with Agent SDK:** The `for await` loop must be in the worker process, not in a Next.js Server Action. Worker is already detached — this is fine.
- **Not awaiting all Agent SDK messages:** If you `break` out of the `for await` loop early, the underlying process may not terminate. Always consume or call `.return()`.
- **Using `PAUSED` as the only pause mechanism without a check loop:** The worker only checks for pause BETWEEN stages, not mid-stage. A stage that runs for 10 minutes will complete before the pause takes effect. This is by design — document it.
- **Re-running all stages on retry:** Retry should resume from the last failed stage. The worker should read `PipelineRun.stage` of the last run to determine the resume point.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Autonomous code execution | Custom shell executor | `@anthropic-ai/claude-agent-sdk` | Agent SDK handles tool dispatch, context window, multi-turn, error recovery |
| Claude Code CLI subprocess parsing | Parse `claude --print --output-format json` output | `@anthropic-ai/claude-agent-sdk` `query()` | Typed TypeScript API; no CLI parsing; handles streaming; official replacement |
| Per-stage retry state | Custom stage table | `PipelineRun.stage` field (already in schema) | Schema already has `stage: String` on PipelineRun; use it |
| API timeout logic | Custom timeout wrapper | Agent SDK `maxTurns` + Anthropic SDK auto-retry | SDK handles retries; `maxTurns: 30` prevents runaway; process-level 10-minute timeout via stage orchestration |

**Key insight:** The Agent SDK is purpose-built for exactly this use case — autonomous code execution with tool access. Building a custom executor would replicate what the SDK already handles (tool dispatch, context management, permission modes, streaming).

---

## Common Pitfalls

### Pitfall 1: `allowDangerouslySkipPermissions` is Required Alongside `bypassPermissions`

**What goes wrong:** Setting `permissionMode: 'bypassPermissions'` alone may not skip all permission prompts. In some SDK versions, `allowDangerouslySkipPermissions: true` must also be set.

**Why it happens:** The SDK has a safety gate that requires explicitly opting in to dangerous permission bypass.

**How to avoid:** Always set both:
```typescript
options: {
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
}
```

**Warning signs:** Agent SDK hangs waiting for user input in a detached process; worker times out.

### Pitfall 2: Agent SDK Requires ANTHROPIC_API_KEY in the env Option

**What goes wrong:** The Agent SDK's subprocess does not automatically inherit the parent process's environment when spawned by `query()`. Must explicitly pass `ANTHROPIC_API_KEY` via the `env` option.

**Why it happens:** Agent SDK spawns a child Claude Code process. The `env` option controls what environment that child process receives. If omitted, it defaults to `process.env` — but the worker already received a restricted env via spawn. Explicitly passing is safer.

**How to avoid:**
```typescript
options: {
  env: {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
    PATH: process.env.PATH!,
    HOME: process.env.HOME!,
  },
}
```

**Warning signs:** Authentication error from within Agent SDK; worker sets card to FAILED.

### Pitfall 3: Workspace Directory Must Exist Before Agent SDK Call

**What goes wrong:** Agent SDK with `cwd` pointing to a nonexistent directory fails immediately.

**Why it happens:** The underlying Claude Code process uses `cwd` as the working directory. If the directory doesn't exist, `spawn` fails.

**How to avoid:** Always call `ensureWorkspace(cardId)` before calling `runExecutionStage()`. Use `mkdir({ recursive: true })` — idempotent.

**Warning signs:** `ENOENT` error in PipelineRun; card goes to FAILED immediately on execution stage.

### Pitfall 4: For Await Loop Must Consume All Messages

**What goes wrong:** Breaking out of the `for await` loop on the first result message leaves the Agent SDK process running. Worker exits, SDK process becomes orphan.

**Why it happens:** `query()` returns an async generator. If not fully consumed, the underlying process is not terminated.

**How to avoid:** Never `break` or `return` inside the loop. Let the loop run to completion. The `result` message indicates the final outcome — note it but continue iterating (there may be cleanup messages after).

**Warning signs:** Orphan `claude` processes accumulate; system resource usage grows.

### Pitfall 5: cardType Must Be Checked Before Stage Routing

**What goes wrong:** `cardType` is `GENERAL` by default (Phase 6 scope — Phase 7 adds UI for card type selection). Using Agent SDK for all cards would run code execution unnecessarily for RESEARCH tasks.

**Why it happens:** Not all card types need the Agent SDK. Only `CODE` cards need workspace + Agent SDK execution.

**How to avoid:**
```typescript
if (card.cardType === 'CODE') {
  execResult = await runExecutionStage(card, planText, workspacePath)
} else {
  execResult = await runExecutionStageApi(card, planText)
}
```

**Warning signs:** Agent SDK creating files for research tasks; workspace directories created for all card types.

### Pitfall 6: Pause Check Reads Stale DB State

**What goes wrong:** Pause check happens between stages. If the worker cached the card object at startup, it will always see `pipelineStatus: QUEUED` and never detect the pause.

**Why it happens:** The card object was loaded once at worker startup and not re-fetched.

**How to avoid:** The `checkPaused()` helper must always call `prisma.card.findUnique()` — never cache the card status. Always read from DB.

**Warning signs:** Pause action runs, card shows PAUSED in UI (from the Server Action), but worker continues to next stage.

### Pitfall 7: Agent SDK Node.js/Runtime Version

**What goes wrong:** `@anthropic-ai/claude-agent-sdk` requires Node.js 18+. The project uses Node 24 (fine), but if the worker's PATH includes a different Node version, the SDK's bundled process may fail.

**Why it happens:** Agent SDK bundles Claude Code which requires a modern Node.js runtime. The `PATH` env var passed to the worker controls which `node` binary is used.

**How to avoid:** Always pass `PATH: process.env.PATH!` in the worker spawn env AND in the Agent SDK `env` option.

**Warning signs:** `spawn ENOENT` or Node version error in Agent SDK subprocess.

---

## Code Examples

Verified patterns from official sources:

### Agent SDK for CODE Execution

```typescript
// Source: https://platform.claude.com/docs/en/agent-sdk/typescript
import { query } from '@anthropic-ai/claude-agent-sdk'

export async function runExecutionStage(
  card: { id: string; title: string },
  planText: string,
  workspacePath: string,
): Promise<string> {
  const prompt = buildExecutionPrompt(card.title, planText)
  const outputParts: string[] = []

  for await (const message of query({
    prompt,
    options: {
      cwd: workspacePath,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      maxTurns: 30,
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
        PATH: process.env.PATH!,
        HOME: process.env.HOME!,
      },
    },
  })) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if ('text' in block && block.text) {
          outputParts.push(block.text)
        }
      }
    }
    // Consume all messages — do not break early
  }

  return outputParts.join('\n\n') || 'Suoritus valmis'
}
```

### Anthropic API for Testing Stage (All Card Types)

```typescript
// Source: Phase 5 pipeline-stages.ts pattern (verified working)
import Anthropic from '@anthropic-ai/sdk'

export async function runTestingStage(
  card: { title: string },
  planText: string,
  executionResult: string,
): Promise<string> {
  const anthropic = new Anthropic()
  const prompt = buildTestingPrompt(card.title, planText, executionResult)

  const response = await anthropic.messages.create({
    model: PIPELINE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Ei tekstisisältöä testausvastauksessa')
  }
  return textBlock.text
}
```

### Stage Transition Helper

```typescript
// Updates PipelineRun.stage + Card.pipelineStatus + Card.columnId atomically
async function advanceToStage(
  runId: string,
  cardId: string,
  newStage: string,
  newStatus: PipelineStatus,
  columnId: string,
  position: number,
): Promise<void> {
  await prisma.$transaction([
    prisma.pipelineRun.update({
      where: { id: runId },
      data: { stage: newStage, status: newStatus },
    }),
    prisma.card.update({
      where: { id: cardId },
      data: { columnId, position, pipelineStatus: newStatus },
    }),
  ])
}
```

### Execution Prompt Builders

```typescript
// src/workers/prompts.ts additions

export function buildExecutionPrompt(title: string, planText: string): string {
  return `Olet koodisuorittaja. Sinulle on annettu tehtävä ja suunnitelma sen toteuttamiseksi.

Tehtävä: ${title}

Suunnitelma:
${planText}

Toteuta suunnitelma käyttäen saatavillasi olevia työkaluja. Luo tarvittavat tiedostot työhakemistoon.
Kun olet valmis, kirjoita lyhyt yhteenveto siitä mitä teit ja mitä tiedostoja loit.`
}

export function buildExecutionPromptApi(title: string, planText: string): string {
  // For RESEARCH/BUSINESS/GENERAL — no file ops
  return `Olet tehtävien suorittaja. Sinulle on annettu tehtävä ja suunnitelma.

Tehtävä: ${title}

Suunnitelma:
${planText}

Suorita tämä tehtävä suunnitelman mukaisesti. Tuota kattava, laadukas tulos.
Vastaa suomeksi.`
}

export function buildTestingPrompt(
  title: string,
  planText: string,
  executionResult: string,
): string {
  return `Olet laadunvarmistaja. Arvioi, onko tehtävä suoritettu hyväksymiskriteerien mukaisesti.

Tehtävä: ${title}

Alkuperäinen suunnitelma ja hyväksymiskriteerit:
${planText}

Suorituksen tulos:
${executionResult}

Arvioi:
1. Onko kaikki hyväksymiskriteerit täytetty?
2. Onko lopputulos laadukas?
3. Mikä on yhteenvetosi: HYVÄKSYTTY tai HYLÄTTY?

Vastaa suomeksi. Aloita yhteenvedolla (HYVÄKSYTTY/HYLÄTTY), sitten perustele.`
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `claude --print --output-format json` via subprocess | `@anthropic-ai/claude-agent-sdk` `query()` | 2025 (SDK release) | Typed API, no CLI binary needed, handles streaming natively |
| `claude-code` npm package (SDK v0.x) | `@anthropic-ai/claude-agent-sdk` | Late 2025 | Package renamed; same capabilities; updated import |
| Manual tool loop with Client SDK | Agent SDK handles tool dispatch | 2025 | No need to implement tool execution — SDK handles it |

**Deprecated/outdated:**
- Direct `claude` CLI subprocess for programmatic use: replaced by Agent SDK; CLI is for interactive developer use.
- Checking `stop_reason === 'tool_use'` and implementing tool execution manually: Agent SDK handles this internally.

---

## Open Questions

1. **Retry from failed stage — schema support**
   - What we know: `PipelineRun.stage` records the current stage when it failed. The existing `startPipeline` allows retry from `FAILED`. Worker needs to read the last run's stage to determine where to resume.
   - What's unclear: The current worker always starts from `PLANNING`. If a card failed during `EXECUTING`, re-running will redo the planning call. This is wasteful but safe.
   - Recommendation: Read `latestRun.stage` at worker startup. If `latestRun.status === 'FAILED'` and `latestRun.stage === 'EXECUTING'`, skip planning and go straight to execution using stored plan text from the previous run's PipelineMessages. This requires reading the last `assistant` message with `artifactType === 'plan'` from the previous run.

2. **Agent SDK subprocess count and resource usage**
   - What we know: `query()` spawns a subprocess per call. For CODE cards, this is one subprocess per execution stage.
   - What's unclear: How long does the subprocess linger after the `for await` loop completes?
   - Recommendation: Agent SDK handles cleanup when the generator is fully consumed. Trust the SDK. If orphan processes become a concern, track with `ps aux | grep claude` during testing.

3. **Agent SDK version compatibility**
   - What we know: `@anthropic-ai/claude-agent-sdk` is actively developed. The `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true` combination is documented but had a known issue in some versions.
   - What's unclear: The exact version that fixes the bypass permissions issue.
   - Recommendation: Install latest version, pin it in `package.json`. If bypass permissions still requires approval prompts, add a `canUseTool` callback that always returns `{ behavior: 'allow' }`.

4. **Pause timing — mid-stage cannot pause**
   - What we know: Pause is a DB flag checked between stages. A stage running for up to 10 minutes will finish before the pause takes effect.
   - What's unclear: The success criteria says "a running pipeline can be paused and does not continue to the next stage." This means the pause prevents *advancing* to the next stage, not stopping mid-stage.
   - Recommendation: This is the correct interpretation — document it clearly. The pause check between stages satisfies the requirement.

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not set in `.planning/config.json` (no `nyquist_validation` key present, defaults to disabled).

---

## Sources

### Primary (HIGH confidence)
- `https://platform.claude.com/docs/en/agent-sdk/typescript` — `query()` API, Options type, SDKMessage types, `SDKResultMessage` structure, `permissionMode`, `cwd`, `allowedTools`
- `https://platform.claude.com/docs/en/agent-sdk/quickstart` — Prerequisites confirmed (Node 18+, ANTHROPIC_API_KEY only; no external CLI needed); SDK bundles own engine
- `https://code.claude.com/docs/en/cli-reference` — CLI flags reference (confirms `--print`, `--output-format json`; confirms Agent SDK is the programmatic replacement)
- Phase 5 research and implementation (`05-RESEARCH.md`, `pipeline-stages.ts`) — Anthropic `messages.create` pattern verified working; worker spawn pattern verified

### Secondary (MEDIUM confidence)
- `https://claudelog.com/faqs/what-is-output-format-in-claude-code/` — confirms `--output-format json` wrapper structure; verified by CLI reference
- `https://github.com/anthropics/claude-code/issues/14279` — `bypassPermissions` + `allowDangerouslySkipPermissions` known issue; mitigation via `canUseTool` fallback
- Node.js v25 docs (child_process) — `AbortController` signal for process termination; `spawn` timeout option

### Tertiary (LOW confidence)
- None — all critical claims verified with primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Agent SDK docs verified; existing Anthropic SDK verified working from Phase 5
- Architecture: HIGH — Stage machine based on existing Phase 5 pattern; pause/retry patterns are simple DB flag checks
- Pitfalls: MEDIUM-HIGH — `bypassPermissions` issue from GitHub issue (MEDIUM); workspace/env pitfalls are standard Node.js patterns (HIGH)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (Agent SDK is actively developed; re-verify `bypassPermissions` behavior at implementation time)
