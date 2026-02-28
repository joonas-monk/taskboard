# Phase 5: AI Pipeline Foundation - Research

**Researched:** 2026-02-28
**Domain:** Anthropic SDK, background worker (detached child_process), Prisma 7 schema migration, SQLite WAL mode
**Confidence:** HIGH

## Summary

Phase 5 introduces the first AI capability to TaskBoard: a detached background worker that calls the Anthropic API for planning and moves a card from Idea to Suunnittelu. The architecture in the approved plan (`glistening-inventing-giraffe.md`) is sound and fully verified against current library versions. All three major pillars — Anthropic SDK, child_process spawning, and Prisma schema migration — are confirmed to work correctly together.

The key implementation constraint discovered during research is that the worker script **must live inside the project directory** (`src/workers/`) for Node.js module resolution to work. When tsx is used to run a script located inside the project, it automatically discovers `tsconfig.json`, resolves `@/` path aliases, and finds `node_modules`. A script in `/tmp` cannot resolve project packages. The server action spawns the worker with `cwd: process.cwd()` and the absolute path to `src/workers/pipeline-worker.ts`.

WAL mode is currently **not enabled** on the development database (confirmed: `journal_mode = delete`). It must be set as part of Phase 5 setup. The cleanest approach is a thin `better-sqlite3` connection in `lib/prisma.ts` that sets `PRAGMA journal_mode = WAL` before the Prisma adapter is created — WAL mode persists in the database file so only needs to be set once per DB file lifetime.

**Primary recommendation:** Follow the approved architecture exactly. The detached tsx worker pattern is verified working. Install `@anthropic-ai/sdk@0.78.0`, set WAL mode in `lib/prisma.ts`, add `ANTHROPIC_API_KEY` to `.env`, run Prisma migration for new schema models, and implement the worker with relative/`@/` imports inside `src/workers/`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | When user creates a card in Idea column, AI automatically starts planning and moves card to Suunnittelu | Verified: Server Action spawns detached tsx worker; worker reads card, calls Anthropic API, moves card via Prisma; all patterns confirmed working |
| AI-08 | AI conversation history and artifacts persist in database | Verified: PipelineMessage model stores role/content pairs; Prisma migration adds table cleanly; existing data unaffected |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.78.0 (latest) | Anthropic API client | Official SDK, TypeScript-native, auto-retries, handles streaming |
| `child_process` (Node built-in) | Node 24.x | Spawn detached background worker | No queue infra needed; single-user app; tsx worker pattern verified |
| `tsx` | 4.21.0 (already installed) | Run TypeScript worker without compilation | Already in devDependencies; auto-discovers tsconfig paths |
| `better-sqlite3` | 12.6.2 (already installed via adapter) | Set WAL pragma before Prisma adapter | Adapter doesn't expose WAL config; raw connection sets it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@prisma/adapter-better-sqlite3` | 7.4.2 (already installed) | Prisma + SQLite | Already in use; worker creates its own PrismaClient instance |
| `dotenv` | 17.x (already installed) | Env loading | Not needed in worker (env passed explicitly via spawn); still used in lib/prisma.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Detached child_process | Node worker_threads | Workers share process memory — no isolation; crash kills Next.js |
| Detached child_process | BullMQ + Redis | Overkill for single-user; adds Redis dependency and ops complexity |
| tsx | ts-node | tsx is 10-100x faster, already installed, handles ESM/CJS transparently |
| stdio: 'ignore' | Redirect to log file | Log file approach requires openSync fd (not stream), adds complexity; DB-based error state is sufficient for Phase 5 |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── actions/
│   ├── ai.ts              # startPipeline, getPipelineStatus Server Actions
│   └── ai-schemas.ts      # Zod validation for pipeline actions
├── lib/
│   ├── prisma.ts          # MODIFIED: add WAL pragma init before adapter
│   └── anthropic.ts       # NEW: Anthropic singleton
└── workers/
    ├── pipeline-worker.ts  # Entry point (receives cardId via argv[2])
    ├── pipeline-stages.ts  # Planning stage logic
    └── prompts.ts          # Prompt builders
```

### Pattern 1: WAL Mode Initialization in lib/prisma.ts

**What:** Open a raw better-sqlite3 connection before creating the Prisma adapter, set WAL pragma, close it. WAL mode persists in the database file.

**When to use:** App startup — ensures concurrent Next.js + worker access works safely.

**Example:**
```typescript
// src/lib/prisma.ts
import 'dotenv/config'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL ?? 'file:/var/data/taskboard/taskboard.db'
const dbPath = connectionString.replace(/^file:/, '')

// Set WAL mode once — persists in DB file across connections
const rawDb = new Database(dbPath)
rawDb.pragma('journal_mode = WAL')
rawDb.close()

const adapter = new PrismaBetterSqlite3({ url: connectionString })

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Verified:** `better-sqlite3` WAL pragma works; mode persists after close/reopen; two concurrent processes can read simultaneously in WAL mode.

### Pattern 2: Detached Worker Spawn in Server Action

**What:** `child_process.spawn` with `detached: true` + `unref()` spawns an independent tsx process that survives the Server Action returning.

**When to use:** `startPipeline` Server Action — fire-and-forget; Next.js process continues normally.

**Example:**
```typescript
// src/actions/ai.ts
'use server'
import { spawn } from 'child_process'
import path from 'path'

export async function startPipeline(cardId: string): Promise<ActionResult<void>> {
  // Update card pipelineStatus to QUEUED first
  await prisma.card.update({ where: { id: cardId }, data: { pipelineStatus: 'QUEUED' } })

  const workerPath = path.resolve(process.cwd(), 'src/workers/pipeline-worker.ts')
  const tsxPath = path.resolve(process.cwd(), 'node_modules/.bin/tsx')

  const worker = spawn(tsxPath, [workerPath, cardId], {
    cwd: process.cwd(),          // CRITICAL: enables @/ alias resolution and node_modules
    detached: true,
    stdio: 'ignore',             // worker logs go to DB via PipelineMessage
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
      NODE_ENV: process.env.NODE_ENV ?? 'production',
      PATH: process.env.PATH,   // needed for system tools in later phases
    }
  })
  worker.unref()  // parent (Next.js) exits independently of worker

  revalidatePath('/')
  return { success: true, data: undefined }
}
```

**Verified:** Spawn + unref pattern works on macOS/Linux. Parent returns immediately. Worker continues in background.

### Pattern 3: Anthropic SDK Singleton

**What:** Export a single `Anthropic` instance from `src/lib/anthropic.ts`. Worker imports it — no globalThis sharing needed since worker is a separate process.

**Example:**
```typescript
// src/lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Automatically reads ANTHROPIC_API_KEY from env if not provided
})
```

### Pattern 4: Worker with Own PrismaClient

**What:** The detached worker creates its own PrismaClient — it cannot share the globalThis singleton with Next.js. No WAL init needed in worker since prisma.ts already set it.

**Example:**
```typescript
// src/workers/pipeline-worker.ts
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

const cardId = process.argv[2]
if (!cardId) { console.error('No cardId provided'); process.exit(1) }

async function main() {
  try {
    // 1. Find Suunnittelu column by name
    const column = await prisma.column.findFirst({ where: { name: 'Suunnittelu' } })
    // 2. Move card to Suunnittelu
    await prisma.card.update({ where: { id: cardId }, data: { columnId: column.id, pipelineStatus: 'PLANNING' } })
    // 3. Call Anthropic API (planning stage)
    // 4. Store result as PipelineMessage
    // 5. Update pipelineStatus to COMPLETED (Phase 5 scope: just planning stage)
  } catch (err) {
    await prisma.card.update({ where: { id: cardId }, data: { pipelineStatus: 'FAILED' } })
  } finally {
    await prisma.$disconnect()
  }
}

main()
```

**Verified:** `@/` aliases resolve correctly when tsx runs from `cwd: process.cwd()` — tsconfig.json is auto-discovered and paths config is applied.

### Pattern 5: Anthropic API Call for Planning

**What:** Non-streaming `messages.create` for simplicity in Phase 5. The response is a text block.

**Example:**
```typescript
// src/workers/pipeline-stages.ts
import Anthropic from '@anthropic-ai/sdk'
import type { Message } from '@anthropic-ai/sdk/resources'

const anthropic = new Anthropic()  // reads ANTHROPIC_API_KEY from env

export async function runPlanningStage(card: { title: string; description: string }): Promise<string> {
  const response: Message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',    // fast + cheap for planning; Sonnet for higher quality
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: buildPlanningPrompt(card.title, card.description)
      }
    ]
  })

  // Extract text from response content array
  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')
  return textBlock.text
}
```

**Verified:** Response content is `Array<ContentBlock>` where text blocks have `{ type: 'text', text: string }`. Stop reason is `end_turn` for normal completion.

### Anti-Patterns to Avoid

- **Worker script in /tmp or outside project:** tsx cannot resolve `node_modules` or `@/` aliases when the script is outside the project tree. Worker MUST be at `src/workers/pipeline-worker.ts`.
- **Passing stream object to stdio in spawn:** `stdio: [stream, stream, stream]` fails for detached processes. Use `stdio: 'ignore'` or file descriptors from `openSync()`.
- **Sharing globalThis Prisma singleton with worker:** The detached worker is a separate OS process — globalThis is fresh. Worker always creates its own PrismaClient.
- **Setting `dotenv/config` in worker:** The worker receives env vars via the spawn `env` option from the Server Action. Calling `import 'dotenv/config'` in the worker will fail if the script is not adjacent to `.env`. Pass env explicitly.
- **Calling `prisma.$executeRawUnsafe` for WAL:** The adapter creates its own connection. Setting WAL via raw db before the adapter is created ensures it takes effect.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API retry on rate limit | Custom retry loop | SDK built-in retry | SDK auto-retries 408, 409, 429, 5xx with exponential backoff |
| TypeScript worker runner | Compile + run compiled JS | tsx | Already installed; zero-config TS execution; auto-discovers tsconfig |
| WAL mode detection | Check pragma each startup | Set-then-close pattern | WAL persists in file; cheap to re-set; idempotent |
| Background job queue | BullMQ / agenda / custom | detached child_process | Single user, SQLite, no Redis; overkill avoided |

**Key insight:** The Anthropic SDK handles retry, timeout, and connection management. Never build custom HTTP retry logic around the API.

---

## Common Pitfalls

### Pitfall 1: Worker Script Must Be In Project Directory

**What goes wrong:** Worker spawned with a path to `/tmp/pipeline-worker.ts` — module resolution fails with `Cannot find module 'zod'` / `Cannot find module '@anthropic-ai/sdk'`.

**Why it happens:** Node.js resolves `node_modules` by walking up the directory tree from the script's location. Scripts outside the project tree never find the project's `node_modules`.

**How to avoid:** Always use `path.resolve(process.cwd(), 'src/workers/pipeline-worker.ts')` as the worker path. The Server Action's `process.cwd()` is the project root.

**Warning signs:** `ERR_MODULE_NOT_FOUND` for packages that clearly exist in `node_modules`.

### Pitfall 2: WAL Mode Not Set (Database Locked Errors)

**What goes wrong:** Next.js (Prisma) writes while the worker is also writing — `SQLITE_BUSY: database is locked` errors.

**Why it happens:** Default SQLite journal mode (`delete`) blocks all readers during writes and vice versa. Two processes simultaneously accessing the file causes locking.

**How to avoid:** Set `PRAGMA journal_mode = WAL` in `lib/prisma.ts` before creating the Prisma adapter. WAL allows concurrent reads and one writer without blocking readers.

**Warning signs:** Intermittent `SQLITE_BUSY` errors only when pipeline is running alongside UI interaction.

### Pitfall 3: Missing ANTHROPIC_API_KEY in Worker Environment

**What goes wrong:** Worker spawned without `ANTHROPIC_API_KEY` in env — SDK throws `AuthenticationError`.

**Why it happens:** `spawn({ env: {...} })` replaces the entire environment. If you spread `process.env` fully, the key is included. If you omit it, it's not there.

**How to avoid:** Explicitly include `ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!` in the spawn env object. Validate the key exists before spawning (fail fast in Server Action).

**Warning signs:** Worker immediately sets card to FAILED; `AuthenticationError` message in PipelineMessage error field.

### Pitfall 4: PrismaBetterSqlite3 Adapter Options Don't Include WAL

**What goes wrong:** Developer assumes `PrismaBetterSqlite3({ url, journalMode: 'WAL' })` — this option doesn't exist.

**Why it happens:** The adapter's `BetterSQLite3InputParams` type extends `better-sqlite3`'s `Options`, which only has `readonly`, `fileMustExist`, `timeout`, `verbose`, `nativeBinding` — no pragma option.

**How to avoid:** Use the raw better-sqlite3 connection to set WAL before creating the adapter (Pattern 1 above).

**Warning signs:** TypeScript type error if you try to pass an unknown option; WAL stays unset even though you thought you set it.

### Pitfall 5: Worker Exits Before Prisma Operations Complete

**What goes wrong:** Worker script's `main()` promise is not awaited at the top level — the worker exits before DB writes complete.

**Why it happens:** Node.js will exit when the event loop is empty. If the async chain isn't properly awaited, process exits prematurely.

**How to avoid:** Always call `main()` (no `await` at top level is fine) but ensure the worker calls `process.exit(0)` explicitly after `prisma.$disconnect()` — or the Prisma connection pool keeps the event loop alive until timeout.

**Warning signs:** Card stuck in PLANNING status; PipelineMessage never created.

### Pitfall 6: Model ID Must Be Full Version String

**What goes wrong:** Using `model: 'claude-3-5-haiku'` without date suffix — API returns `invalid_request_error`.

**Why it happens:** The Messages API requires full version IDs. Short aliases are deprecated and not supported.

**How to avoid:** Always use full model IDs: `claude-3-5-haiku-20241022` or `claude-sonnet-4-5-20250929`.

**Warning signs:** `invalid_request_error: model not found` from the API.

---

## Code Examples

Verified patterns from official sources and local testing:

### Anthropic SDK Initialization (Singleton)

```typescript
// Source: https://github.com/anthropics/anthropic-sdk-typescript
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic()
// Reads ANTHROPIC_API_KEY from process.env automatically
// Built-in retry: 429, 408, 409, 5xx auto-retried with backoff
```

### Non-Streaming API Call with Text Extraction

```typescript
// Source: Anthropic official docs, platform.claude.com/docs/en/api/messages
const response = await anthropic.messages.create({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 4096,
  messages: [{ role: 'user', content: userPrompt }]
})

// Extract text from content array
const textBlock = response.content.find(b => b.type === 'text')
const text = textBlock?.type === 'text' ? textBlock.text : ''
// response.stop_reason === 'end_turn' for normal completion
// response.usage.input_tokens / output_tokens for cost tracking
```

### Prisma Schema for PipelineRun and PipelineMessage

```prisma
// prisma/schema.prisma additions (verified: Prisma 7 + SQLite stores enums as TEXT)
enum CardType {
  CODE
  RESEARCH
  BUSINESS
  GENERAL
}

enum PipelineStatus {
  IDLE
  QUEUED
  PLANNING
  EXECUTING
  TESTING
  COMPLETED
  FAILED
  PAUSED
}

model Card {
  // ... existing fields ...
  cardType       CardType       @default(GENERAL)
  pipelineStatus PipelineStatus @default(IDLE)
  pipelineRuns   PipelineRun[]
}

model PipelineRun {
  id        String         @id @default(cuid())
  stage     String
  status    PipelineStatus
  error     String?
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  cardId   String
  card     Card             @relation(fields: [cardId], references: [id], onDelete: Cascade)
  messages PipelineMessage[]
}

model PipelineMessage {
  id           String   @id @default(cuid())
  role         String   // 'user' | 'assistant'
  content      String
  artifactType String?  // 'plan' | 'code' | 'test_report' | null
  createdAt    DateTime @default(now())

  pipelineRunId String
  pipelineRun   PipelineRun @relation(fields: [pipelineRunId], references: [id], onDelete: Cascade)
}
```

### getPipelineStatus Server Action

```typescript
// src/actions/ai.ts
export async function getPipelineStatus(cardId: string): Promise<ActionResult<PipelineStatusResult>> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      pipelineRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      }
    }
  })
  if (!card) return { success: false, error: 'Card not found' }
  return { success: true, data: { status: card.pipelineStatus, run: card.pipelineRuns[0] ?? null } }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `anthropic` package (v0.x) | `@anthropic-ai/sdk` (official) | 2023 | Use `@anthropic-ai/sdk` — only official SDK |
| `claude-2`, `claude-instant` model IDs | Full version IDs like `claude-3-5-haiku-20241022` | 2024 | Short aliases removed; always use full ID |
| `new Anthropic({ apiKey })` required | `ANTHROPIC_API_KEY` env auto-read | SDK ≥0.9 | Can omit `apiKey` param if env var set |
| Prisma `prisma-client-js` generator | `prisma-client` generator + `prisma.config.ts` | Prisma 7 | Already in use in this project |

**Deprecated/outdated:**
- `claude-2` model alias: replaced by versioned IDs, do not use
- `datasourceUrl` option in PrismaClient constructor: removed in Prisma 7
- `prisma migrate` in worker: worker should NOT run migrations; only Next.js startup path runs migrations

---

## Open Questions

1. **Model selection for planning stage**
   - What we know: Both `claude-3-5-haiku-20241022` (fast/cheap) and `claude-sonnet-4-5-20250929` (higher quality) work for planning
   - What's unclear: User hasn't specified preferred model; cost vs. quality tradeoff depends on use case
   - Recommendation: Use `claude-3-5-haiku-20241022` as default for Phase 5 (fastest iteration); make model configurable via env var `PIPELINE_MODEL` for easy switching

2. **Worker log visibility during development**
   - What we know: `stdio: 'ignore'` means no console output from detached worker; errors tracked via `pipelineStatus: FAILED` in DB
   - What's unclear: Debugging worker failures during development is harder without console output
   - Recommendation: In Phase 5, use `stdio: 'inherit'` (non-detached) during manual testing, then switch to `stdio: 'ignore'` with `detached: true` for the real implementation; OR write worker errors to a `~/data/taskboard/worker.log` file

3. **PipelineRun vs direct PipelineMessage on Card**
   - What we know: Approved plan has `PipelineRun` (per pipeline attempt) and `PipelineMessage` (per message in a run)
   - What's unclear: Phase 5 success criteria only requires storing plan text — do we need full PipelineRun in Phase 5 or can we defer to Phase 6?
   - Recommendation: Implement full PipelineRun + PipelineMessage schema in Phase 5 (as specified in approved plan) since Phase 6 and 7 both depend on it; it's just a schema migration

---

## Sources

### Primary (HIGH confidence)

- Local npm registry + `npm show @anthropic-ai/sdk` — version 0.78.0 confirmed latest stable
- Local `@prisma/adapter-better-sqlite3/dist/index.d.ts` — adapter constructor type confirmed: extends `better-sqlite3` Options (no WAL config option)
- Local `better-sqlite3@12.6.2` live testing — WAL pragma works; persists across connections; concurrent reads confirmed
- Local child_process spawn testing — detached + unref pattern verified; tsx worker with `cwd=project` resolves `@/` aliases and node_modules
- `platform.claude.com/docs/en/api/messages` — current model IDs, required params, response content array structure
- `github.com/anthropics/anthropic-sdk-typescript` README — client instantiation, TypeScript imports, error handling

### Secondary (MEDIUM confidence)

- WebSearch: "Anthropic SDK TypeScript messages.create streaming 2025" — confirmed streaming patterns, non-streaming API shape, retry behavior
- WebSearch: "Node.js child_process spawn detached SQLite WAL concurrent reads 2025" — confirmed WAL concurrent access patterns
- WebSearch: "Prisma SQLite add column migration ALTER TABLE 2025" — confirmed `ALTER TABLE ... ADD COLUMN` with default value works; migration safety for existing rows

### Tertiary (LOW confidence)

- None — all critical claims verified with primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries version-checked against npm; SDK tested against official docs
- Architecture: HIGH — every pattern locally verified with actual code execution in project environment
- Pitfalls: HIGH — Pitfalls 1, 2, 3, 4 directly observed during research; Pitfalls 5, 6 from official docs

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable APIs; SDK releases frequently but API shape is stable)
