# Phase 1: Data Foundation - Research

**Researched:** 2026-02-28
**Domain:** Prisma 7 + SQLite + Next.js 16 Server Actions + TypeScript data layer
**Confidence:** HIGH (all key findings verified against official docs / current sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Multiple labels per card (stored as array/relation, like Trello)
- 4 priority levels: Critical / High / Medium / Low
- Card fields: title, description (plain text), priority, due date, labels (multiple), archived flag, column, position
- Description supports markdown (rendered in UI later, stored as plain text)
- Finnish column names: Idea, Suunnittelu, Toteutus, Testaus, Valmis
- Full UI language is Finnish (buttons, labels, placeholders, all text)

### Claude's Discretion
- Column storage strategy: hardcoded vs database (Claude picks best approach for future v2 flexibility)
- Card position ordering strategy: integer reindex vs float midpoint (Claude picks best for drag & drop)
- Card color: whether labels carry the color or card has a separate color field (Claude decides)
- Database file path on VPS (outside project directory, safe from redeploy)
- Backup strategy (daily cron copy or skip for v1)
- Auto-create database and run migrations on first startup vs manual setup

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | All card data persists in SQLite and survives server restart | Prisma 7 + SQLite with absolute path DATABASE_URL outside project dir ensures persistence across deploys; migration workflow guarantees schema survives restarts |
</phase_requirements>

---

## Summary

Phase 1 establishes the data layer for a Next.js 16 + Prisma 7 + SQLite application. The technical landscape has shifted significantly with Prisma 7's mandatory driver-adapter architecture: SQLite now requires `@prisma/adapter-better-sqlite3`, `prisma.config.ts` replaces the `url` field in `schema.prisma`, and the generator provider changes from `prisma-client-js` to `prisma-client` with a required explicit `output` path. All of these are breaking changes from Prisma 6 and must be implemented from the start.

For the discretion items: columns should live in the database (not hardcoded), because v2 requirements include renaming and reordering columns (BCUST-01, BCUST-02). Float-based position ordering is correct for drag-and-drop but must use well-spaced initial values to avoid early precision exhaustion — start cards at `1000.0`, `2000.0`, `3000.0`, etc., with gaps of 1000. Labels carry the color (no separate card color field) — this matches Trello's model exactly. Database path should be `/var/data/taskboard/taskboard.db` (outside project, survives redeploys). Skip automated backups for v1. Run `prisma migrate deploy` in the deployment script (not on startup) and `prisma migrate dev` locally.

**Primary recommendation:** Implement Prisma 7 with the better-sqlite3 adapter, explicit `prisma.config.ts`, columns stored in the database (5 seeded rows), labels as an explicit many-to-many relation, float positions (initial spacing 1000.0), and a discriminated-union `ActionResult<T>` type for all Server Actions.

---

## Decisions on Claude's Discretion Items

| Item | Decision | Rationale |
|------|----------|-----------|
| Column storage | **Database table** with seeded rows | v2 has BCUST-01/02 rename+reorder; hardcoded strings make that a rewrite |
| Position ordering | **Float, initial gap 1000.0** | Midpoint formula works for ~40+ sequential inserts before needing rebalance; far more than enough for a single-user board |
| Card color | **Labels carry the color** (no card.color field) | Exact Trello model; a card's visual identity comes from its labels |
| DB path | **`/var/data/taskboard/taskboard.db`** | Absolute path outside project dir; survives `git pull` / redeploy |
| Backups | **Skip for v1** | Single user, VPS; add cron in v2 if needed |
| Auto-migrate | **`prisma migrate deploy` in deploy script, not on app startup** | Avoids race conditions; cleaner separation of concerns |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prisma | 7.x | ORM + migration tool | Official ORM for Next.js; Prisma 7 is current stable |
| @prisma/client | 7.x | Generated type-safe query client | Peer of prisma |
| @prisma/adapter-better-sqlite3 | 7.x | Required driver adapter for SQLite in Prisma 7 | Mandatory in v7; `better-sqlite3` is faster than node-sqlite3 |
| better-sqlite3 | latest | Underlying sync SQLite driver | Peer dep of adapter; synchronous API is ideal for single-user |
| @types/better-sqlite3 | latest | TypeScript types for better-sqlite3 | devDependency |
| dotenv | latest | Load .env for DATABASE_URL | Required since Prisma 7 no longer auto-loads .env in CLI |
| zod | 3.x | Runtime validation in Server Actions | Validate all action inputs; pairs with TypeScript types |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prisma (devDep) | 7.x | CLI for migrations, generate | Must be in `dependencies` (not devDeps) on VPS so `prisma migrate deploy` is available |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3 adapter | @prisma/adapter-libsql | libsql is for Bun or Turso cloud; better-sqlite3 is correct for Node.js on VPS |
| Prisma enums | String + TS union | Prisma 7 enums work on SQLite (stored as TEXT, enforced by ORM) — use real enums |
| Float positions | String-based fractional indexing | String approach prevents precision exhaustion but adds complexity; float at 1000-gap spacing is sufficient for a personal board with ~40+ reorders before gap issues |
| Explicit many-to-many | JSON array for labels | JSON array in SQLite is simpler but loses relational integrity and makes label queries harder in Phase 6 (search/filter) |

**Installation:**
```bash
npm install @prisma/client @prisma/adapter-better-sqlite3 dotenv zod
npm install -D prisma @types/better-sqlite3 @types/node
# Note: also add prisma to dependencies (not just devDeps) for production migration
npm install prisma
```

---

## Architecture Patterns

### Recommended Project Structure
```
/
├── prisma/
│   ├── schema.prisma         # data model (no url here in Prisma 7)
│   ├── migrations/           # migration history (commit to git)
│   └── seed.ts               # seed 5 columns + default labels
├── prisma.config.ts          # Prisma 7 config: url, schema path, migrations path
├── src/
│   ├── lib/
│   │   └── prisma.ts         # singleton PrismaClient with better-sqlite3 adapter
│   ├── types/
│   │   └── index.ts          # re-export Prisma types + custom ActionResult<T>
│   └── actions/
│       └── tasks.ts          # Server Actions: createTask, updateTask, moveTask, deleteTask, reorderTasks
├── .env                      # DATABASE_URL=file:/var/data/taskboard/taskboard.db
└── package.json
```

### Pattern 1: Prisma 7 Schema (SQLite)
**What:** `schema.prisma` with no URL (moved to `prisma.config.ts`), `prisma-client` generator with explicit output, enum types (SQLite stores as TEXT), explicit many-to-many for labels.
**When to use:** Every Prisma 7 + SQLite project.

```prisma
// prisma/schema.prisma
// Source: https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/sqlite

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  // No url here in Prisma 7 — moved to prisma.config.ts
}

enum Priority {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

model Column {
  id        String   @id @default(cuid())
  name      String   // "Idea" | "Suunnittelu" | "Toteutus" | "Testaus" | "Valmis"
  order     Float    // column ordering for future v2 drag
  createdAt DateTime @default(now())
  cards     Card[]
}

model Card {
  id          String    @id @default(cuid())
  title       String
  description String    @default("")  // markdown stored as plain text
  priority    Priority  @default(MEDIUM)
  dueDate     DateTime?
  archived    Boolean   @default(false)
  position    Float     // float-based ordering within column (initial: 1000, 2000, 3000...)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  columnId    String
  column      Column    @relation(fields: [columnId], references: [id])

  labels      CardLabel[]
}

model Label {
  id    String      @id @default(cuid())
  name  String
  color String      // hex color string e.g. "#ef4444"
  cards CardLabel[]
}

// Explicit many-to-many join table (Card <-> Label)
// Explicit chosen over implicit to allow future metadata (e.g. assignedAt)
model CardLabel {
  card      Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  cardId    String
  label     Label  @relation(fields: [labelId], references: [id], onDelete: Cascade)
  labelId   String

  @@id([cardId, labelId])
}
```

### Pattern 2: prisma.config.ts (Prisma 7 Required)
**What:** Centralizes database URL and migration path — required in Prisma 7 for `migrate` commands.
**When to use:** Always with Prisma 7.

```typescript
// prisma.config.ts (project root)
// Source: https://www.prisma.io/docs/orm/reference/prisma-config-reference
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
```

### Pattern 3: PrismaClient Singleton with better-sqlite3
**What:** Single shared PrismaClient instance using the required driver adapter, global singleton to survive hot reloads.
**When to use:** Every Next.js + Prisma 7 + SQLite project.

```typescript
// src/lib/prisma.ts
// Source: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL ?? 'file:/var/data/taskboard/taskboard.db'

const adapter = new PrismaBetterSqlite3({ url: connectionString })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### Pattern 4: TypeScript Types from Prisma
**What:** Re-export generated Prisma types and define `ActionResult<T>` discriminated union for Server Actions.
**When to use:** Import from `@/types` everywhere in the app — never from the generated path directly.

```typescript
// src/types/index.ts
// Source: https://www.prisma.io/docs/orm/prisma-client/type-safety
import type { Card, Column, Label, CardLabel, Priority } from '../generated/prisma/client'
import type { Prisma } from '../generated/prisma/client'

// Re-export model types
export type { Card, Column, Label, CardLabel, Priority }

// Card with its labels and column populated
export type CardWithLabels = Prisma.CardGetPayload<{
  include: { labels: { include: { label: true } } }
}>

// Column with all its cards (and their labels)
export type ColumnWithCards = Prisma.ColumnGetPayload<{
  include: {
    cards: {
      include: { labels: { include: { label: true } } }
      orderBy: { position: 'asc' }
    }
  }
}>

// Typed Server Action response — discriminated union, serializable by React
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

// Input types for Server Actions
export type CreateTaskInput = {
  title: string
  columnId: string
  priority?: Priority
  description?: string
  dueDate?: string | null
  labelIds?: string[]
}

export type UpdateTaskInput = {
  id: string
  title?: string
  description?: string
  priority?: Priority
  dueDate?: string | null
  labelIds?: string[]
  archived?: boolean
}

export type MoveTaskInput = {
  id: string
  targetColumnId: string
  position: number
}

export type ReorderTasksInput = {
  id: string
  position: number
}[]
```

### Pattern 5: Server Action Stubs
**What:** Typed, stub Server Actions in a dedicated `'use server'` file, each returning `ActionResult<T>`.
**When to use:** Phase 1 creates stubs; Phase 3 fills in the implementation.

```typescript
// src/actions/tasks.ts
// Source: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import type {
  ActionResult,
  CardWithLabels,
  ColumnWithCards,
  CreateTaskInput,
  UpdateTaskInput,
  MoveTaskInput,
  ReorderTasksInput,
} from '@/types'

export async function createTask(
  input: CreateTaskInput
): Promise<ActionResult<CardWithLabels>> {
  // STUB: Phase 3 implements
  return { success: false, error: 'Not implemented' }
}

export async function updateTask(
  input: UpdateTaskInput
): Promise<ActionResult<CardWithLabels>> {
  // STUB: Phase 3 implements
  return { success: false, error: 'Not implemented' }
}

export async function moveTask(
  input: MoveTaskInput
): Promise<ActionResult<CardWithLabels>> {
  // STUB: Phase 4 implements (drag & drop)
  return { success: false, error: 'Not implemented' }
}

export async function deleteTask(
  id: string
): Promise<ActionResult<void>> {
  // STUB: Phase 3 implements
  return { success: false, error: 'Not implemented' }
}

export async function reorderTasks(
  updates: ReorderTasksInput
): Promise<ActionResult<void>> {
  // STUB: Phase 4 implements (drag & drop reorder within column)
  return { success: false, error: 'Not implemented' }
}
```

### Pattern 6: Float Position Ordering
**What:** Initial positions spaced by 1000.0 to allow many midpoint insertions before precision problems arise.
**When to use:** All card inserts and drag-and-drop reorders.

```typescript
// Position utilities
// Initial card positions: 1000.0, 2000.0, 3000.0...
// Insert between cards A (pos=1000) and B (pos=2000): newPos = (1000 + 2000) / 2 = 1500
// Prepend: newPos = first.position - 1000
// Append: newPos = last.position + 1000

export function midpoint(a: number, b: number): number {
  return (a + b) / 2
}

export function positionAfterLast(lastPosition: number): number {
  return lastPosition + 1000
}

export function positionBeforeFirst(firstPosition: number): number {
  return firstPosition - 1000
}

// When gap between adjacent cards drops below threshold, rebalance the column
export const REBALANCE_THRESHOLD = 0.001
```

**Important:** With 1000-gap initial spacing, a user can insert between two adjacent cards approximately 40 times before the gap falls below ~0.001 (the double-precision limit for this approach). A personal Kanban board will never hit this in normal use. If it does occur, rebalance by reassigning positions as `(index + 1) * 1000.0` to all cards in the column.

### Pattern 7: Column Seed
**What:** The 5 Finnish columns seeded in the first migration (or a separate seed file).
**When to use:** `prisma db seed` during setup.

```typescript
// prisma/seed.ts
import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:/var/data/taskboard/taskboard.db'
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const columns = [
    { name: 'Idea',         order: 1000 },
    { name: 'Suunnittelu',  order: 2000 },
    { name: 'Toteutus',     order: 3000 },
    { name: 'Testaus',      order: 4000 },
    { name: 'Valmis',       order: 5000 },
  ]

  for (const col of columns) {
    await prisma.column.upsert({
      where: { name: col.name },
      update: {},
      create: col,
    })
  }

  // Default label set (can be extended by user)
  const labels = [
    { name: 'Bugi',      color: '#ef4444' },
    { name: 'Ominaisuus', color: '#3b82f6' },
    { name: 'Kiireinen', color: '#f97316' },
    { name: 'Parannus',  color: '#22c55e' },
  ]

  for (const label of labels) {
    await prisma.label.upsert({
      where: { name: label.name },
      update: {},
      create: label,
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Note: `Column.name` must have `@unique` added to the schema for the `upsert` above to work.

### Anti-Patterns to Avoid
- **Using `new PrismaClient()` without an adapter:** Prisma 7 requires `PrismaBetterSqlite3` adapter — omitting it throws at runtime.
- **Keeping `url = env("DATABASE_URL")` in `schema.prisma`:** This field is deprecated in Prisma 7 and ignored; put it in `prisma.config.ts`.
- **Using `prisma-client-js` as generator provider:** Renamed to `prisma-client`; old name may fail or behave unexpectedly.
- **Omitting `output` in generator:** Required in Prisma 7; Prisma no longer generates into `node_modules`.
- **Importing from `@prisma/client`:** In Prisma 7 with custom output, import from the configured output path (e.g. `../generated/prisma/client`).
- **Running `prisma migrate dev` in production:** Use `prisma migrate deploy`; `migrate dev` creates shadow databases and is development-only.
- **Using `any` for Prisma query results:** Use `Prisma.CardGetPayload<...>` for typed includes; Prisma fully infers return types.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ORM + migrations | Custom SQL migration scripts | Prisma migrate | Migration history, rollback, shadow DB, type safety |
| Type-safe DB queries | Raw SQL strings | Prisma Client generated types | Compile-time errors for typos, relation safety |
| Input validation | Manual `typeof` checks | Zod `.safeParse()` | Runtime safety, TypeScript inference, error formatting |
| Position rebalance | Custom sort algorithm | Float midpoint + upsert | One-liner: `(a + b) / 2` covers 99% of cases |
| Action result types | try/catch soup | `ActionResult<T>` discriminated union | Serializable, React-compatible, TypeScript-narrowable |
| Column uniqueness constraint | Application-level check | Prisma `@unique` on Column.name | Database-enforced |

**Key insight:** Prisma 7 handles the hardest parts — schema diffing, migration SQL generation, TypeScript type generation. Don't fight the framework by adding layers it already provides.

---

## Common Pitfalls

### Pitfall 1: Missing `prisma.config.ts` causes migrate to fail
**What goes wrong:** Running `prisma migrate dev` throws `Error: The datasource property is required in your Prisma config file`.
**Why it happens:** Prisma 7 removed the `url` field from `schema.prisma`; it now reads from `prisma.config.ts`.
**How to avoid:** Create `prisma.config.ts` at project root before running any migration commands.
**Warning signs:** Error message mentioning `datasource property is required` or empty `DATABASE_URL`.

### Pitfall 2: SQLite file not found on first run
**What goes wrong:** App starts, connection attempt fails because `/var/data/taskboard/` directory doesn't exist.
**Why it happens:** SQLite creates the file but not parent directories.
**How to avoid:** Create the directory during deploy: `mkdir -p /var/data/taskboard` in the deploy script before `prisma migrate deploy`.
**Warning signs:** `ENOENT: no such file or directory` on startup.

### Pitfall 3: Multiple PrismaClient instances in development
**What goes wrong:** Next.js hot reload creates a new PrismaClient on every file change, exhausting connection pool.
**Why it happens:** Next.js re-imports modules on hot reload; without singleton, a new adapter+client is created.
**How to avoid:** Use the `globalThis` singleton pattern shown in Pattern 3.
**Warning signs:** Increasing memory usage in dev, slow queries, warnings about too many connections.

### Pitfall 4: Float position precision exhaustion
**What goes wrong:** After many inserts between the same two cards, `(a + b) / 2` starts returning `a` because IEEE 754 double loses resolution.
**Why it happens:** JavaScript `number` has 52 bits of mantissa — about 52 halvings before precision is lost in the same gap.
**How to avoid:** Start with 1000-gap spacing; detect when gap < `REBALANCE_THRESHOLD` and reindex the column to multiples of 1000.
**Warning signs:** Cards not reordering correctly after many operations in a small gap.

### Pitfall 5: Prisma enum not supported warning with older docs
**What goes wrong:** Old documentation states SQLite enums are unsupported, causing confusion.
**Why it happens:** Enum support for SQLite was added in Prisma 6.2.0 and is stored as `TEXT` in the DB.
**How to avoid:** Use `enum` in schema normally — Prisma 7 fully supports it for SQLite (ORM-level enforcement, TEXT in DB).
**Warning signs:** None — just ignore outdated docs predating v6.2.

### Pitfall 6: Incorrect import path for PrismaClient in Prisma 7
**What goes wrong:** `import { PrismaClient } from '@prisma/client'` fails or returns stale types.
**Why it happens:** Prisma 7 requires explicit `output` in the generator, so the client is in a custom path, not `node_modules/@prisma/client`.
**How to avoid:** Import from the configured output path: `import { PrismaClient } from '../generated/prisma/client'`.
**Warning signs:** TypeScript errors about missing exports from `@prisma/client`.

### Pitfall 7: `prisma` CLI not available in production
**What goes wrong:** `prisma migrate deploy` fails on VPS because `prisma` is in `devDependencies`.
**Why it happens:** npm prune removes devDependencies in production installs.
**How to avoid:** Put `prisma` in `dependencies` (not `devDependencies`) so it survives `npm install --production`.
**Warning signs:** `prisma: command not found` when deploying.

---

## Code Examples

### Querying the full board (all columns with their cards and labels)
```typescript
// Source: Prisma docs - https://www.prisma.io/docs/orm/prisma-client/type-safety
const board = await prisma.column.findMany({
  orderBy: { order: 'asc' },
  include: {
    cards: {
      where: { archived: false },
      orderBy: { position: 'asc' },
      include: {
        labels: {
          include: { label: true }
        }
      }
    }
  }
})
// Return type: Prisma.ColumnGetPayload<{ include: { cards: { include: { labels: { include: { label: true } } } } } }>[]
```

### Appending a new card to a column
```typescript
// Get last position in column
const lastCard = await prisma.card.findFirst({
  where: { columnId, archived: false },
  orderBy: { position: 'desc' },
  select: { position: true }
})

const position = lastCard ? lastCard.position + 1000 : 1000

const card = await prisma.card.create({
  data: {
    title,
    columnId,
    position,
    priority: 'MEDIUM',
  },
  include: {
    labels: { include: { label: true } }
  }
})
```

### Moving a card between columns (setting new position)
```typescript
// Position comes from client: average of surrounding cards' positions
const card = await prisma.card.update({
  where: { id },
  data: {
    columnId: targetColumnId,
    position: newPosition,
  },
  include: {
    labels: { include: { label: true } }
  }
})
revalidatePath('/')
```

### Assigning labels to a card
```typescript
// Replace all labels on a card (set semantics)
const card = await prisma.card.update({
  where: { id },
  data: {
    labels: {
      deleteMany: {},   // remove existing
      create: labelIds.map(labelId => ({ labelId }))
    }
  },
  include: {
    labels: { include: { label: true } }
  }
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prisma-client-js` generator | `prisma-client` (ESM-first) | Prisma 7 (late 2025) | Must update generator name; new output path required |
| `url = env(...)` in schema.prisma | URL in `prisma.config.ts` | Prisma 7 | Breaking: migrations fail if URL still in schema |
| `new PrismaClient()` directly | `new PrismaClient({ adapter })` | Prisma 7 | Breaking: no adapter = runtime error |
| `@prisma/client` import | Custom output path import | Prisma 7 | Import paths change throughout codebase |
| SQLite enum unsupported | Enums fully supported (TEXT) | Prisma 6.2.0 | Can use `enum Priority` etc. in SQLite schemas |
| `useFormState` | `useActionState` | React 19 / Next.js 15+ | `useFormState` is deprecated |
| `revalidatePath` + `redirect` | `refresh()` from `next/cache` | Next.js 16 | New simpler API for refreshing current page |

**Deprecated/outdated:**
- `prisma-client-js` generator provider: use `prisma-client`
- `url` in datasource block: use `prisma.config.ts`
- `new PrismaClient({ datasources: ... })`: removed in v7
- `new PrismaClient({ datasourceUrl: ... })`: removed in v7
- `previewFeatures = ["driverAdapters"]`: no longer needed, driver adapters are stable

---

## Open Questions

1. **WAL mode with better-sqlite3 adapter in Prisma 7**
   - What we know: WAL mode improves read concurrency; can be set via `PRAGMA journal_mode=WAL` in the first migration file
   - What's unclear: Whether Prisma 7's exclusive locking mode (used internally) conflicts with WAL in the better-sqlite3 adapter specifically (older Prisma versions had this conflict)
   - Recommendation: Enable WAL via a migration PRAGMA (`PRAGMA journal_mode=WAL;` at top of `0_init` migration) and monitor; for a single-user app the impact is low either way

2. **`Column.name` uniqueness for seed upsert**
   - What we know: `upsert` requires a unique field to match on
   - What's unclear: Whether names should be the unique identifier or an internal name field is needed
   - Recommendation: Add `@unique` to `Column.name` — for a fixed 5-column board, names are stable identifiers

3. **Prisma 7 + Turbopack compatibility**
   - What we know: There's a documented issue where `prisma-client-js` (old name) causes Turbopack errors; solved by using `prisma-client`
   - What's unclear: Whether any residual Turbopack issues exist with the current Prisma 7.3.x
   - Recommendation: Use `prisma-client` provider from the start; if Turbopack issues appear in dev, fall back to `next dev --no-turbopack`

---

## Sources

### Primary (HIGH confidence)
- [Prisma 7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7) — Breaking changes: driver adapters, prisma.config.ts, output required
- [Prisma SQLite Quickstart](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/sqlite) — Schema, adapter setup, DATABASE_URL format
- [Prisma Many-to-Many Relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations) — Implicit vs explicit join table
- [Prisma Database Connections Docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections) — Singleton pattern, no explicit $disconnect
- [Prisma Type Safety](https://www.prisma.io/docs/orm/prisma-client/type-safety) — GetPayload, generated types
- [Next.js 16 Server Actions & Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) — Official docs, version 16.1.6, updated 2026-02-27
- [Prisma Connection URL Reference](https://www.prisma.io/docs/orm/reference/connection-urls) — `file:/absolute/path` format for SQLite

### Secondary (MEDIUM confidence)
- [Dev.to: Build Task Management App with Next.js 16 + Prisma 7](https://dev.to/myogeshchavan97/how-to-build-a-task-management-app-using-nextjs-16-and-prisma-7-4mcf) — Full working example of the stack
- [npmjs: @prisma/adapter-better-sqlite3](https://www.npmjs.com/package/@prisma/adapter-better-sqlite3) — Adapter installation and usage
- [Prisma Migrate Deploy Docs](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate) — Production migration workflow
- [SQLite WAL Discussion (prisma/prisma #15966)](https://github.com/prisma/prisma/discussions/15966) — WAL + Prisma connection management
- [Fractional indexing analysis](https://gist.github.com/wolever/3c3fa1f23a7e2e19dcb39e74af3d9282) — Float precision limits (~52 halvings)

### Tertiary (LOW confidence — flagged for validation)
- [GitHub prisma/prisma #28950](https://github.com/prisma/prisma/issues/28950) — Reported `Module not found: Can't resolve 'fs'` with Prisma 7.2.0; resolved in 7.3.0 — verify on target version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official Prisma 7 docs and quickstart (fetched directly)
- Architecture: HIGH — patterns sourced from official Prisma docs and official Next.js 16 docs (fetched Feb 2026)
- Pitfalls: HIGH — most sourced from official upgrade guide and GitHub issues; WAL conflict is MEDIUM (older data, single-user app mitigates risk)
- Float positioning: MEDIUM — technique is well-established; 1000-gap initial spacing is conventional but not officially documented

**Research date:** 2026-02-28
**Valid until:** 2026-04-01 (Prisma moves fast; re-verify adapter API if > 30 days old)
