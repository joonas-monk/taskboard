# Architecture Research

**Domain:** Personal Kanban Task Board — Next.js self-hosted app
**Researched:** 2026-02-28
**Confidence:** HIGH (Next.js official docs v16.1.6, updated 2026-02-27; kanban component patterns from domain knowledge cross-checked with Next.js App Router patterns)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX (Reverse Proxy)                       │
│              Port 80/443 → Next.js :3000                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    Next.js Node.js Server                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    App Router (app/)                      │    │
│  │                                                           │    │
│  │   ┌──────────────┐   ┌──────────────┐                   │    │
│  │   │  page.tsx    │   │  layout.tsx  │                   │    │
│  │   │ (Server Comp)│   │ (Root Shell) │                   │    │
│  │   └──────┬───────┘   └──────────────┘                   │    │
│  │          │ renders                                        │    │
│  │   ┌──────▼───────────────────────────────────────┐      │    │
│  │   │              Board (Client Component)          │      │    │
│  │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │      │    │
│  │   │  │ Column   │ │ Column   │ │ Column   │ ... │      │    │
│  │   │  │ (Client) │ │ (Client) │ │ (Client) │     │      │    │
│  │   │  └────┬─────┘ └──────────┘ └──────────┘     │      │    │
│  │   │       │                                       │      │    │
│  │   │  ┌────▼─────┐                                │      │    │
│  │   │  │   Card   │                                │      │    │
│  │   │  │ (Client) │                                │      │    │
│  │   │  └──────────┘                                │      │    │
│  │   └──────────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                 Server Actions (app/actions/)             │    │
│  │   createTask | updateTask | moveTask | deleteTask        │    │
│  │   reorderTasks | updateColumn                            │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                              │                                    │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │                 Data Layer (lib/db/)                       │   │
│  │   Drizzle ORM  →  better-sqlite3  →  tasks.db (SQLite)   │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `app/layout.tsx` | Root HTML shell, global styles, fonts | Server Component, no state |
| `app/page.tsx` | Initial data fetch, render Board | Async Server Component, reads DB directly |
| `Board` | Drag-and-drop context, column layout | `'use client'` — needs browser APIs for DnD |
| `Column` | Renders card list for one pipeline stage, drop target | `'use client'` — receives DnD events |
| `Card` | Displays task data, drag handle, quick actions | `'use client'` — draggable, interactive |
| `CardModal` | Full task edit form (title, desc, priority, dates, labels) | `'use client'` — form with controlled inputs |
| `app/actions/tasks.ts` | All task mutations (create, update, move, delete) | Server Actions with `'use server'` directive |
| `lib/db/schema.ts` | Drizzle table definitions | TypeScript schema, shared between server and types |
| `lib/db/index.ts` | Database connection singleton | `better-sqlite3` instance, server-only |
| `lib/db/queries.ts` | Typed query functions (getTasks, getColumns) | Wrapped with React `cache()` for deduplication |

---

## Recommended Project Structure

```
taskboard/
├── app/
│   ├── layout.tsx               # Root layout: html/body, global CSS
│   ├── page.tsx                 # Main page: fetches board data, renders Board
│   ├── loading.tsx              # Skeleton shown while page.tsx loads
│   ├── error.tsx                # Error boundary for board crashes
│   ├── globals.css              # Tailwind directives + CSS variables
│   └── actions/
│       └── tasks.ts             # 'use server' — all task mutations
│
├── components/
│   ├── Board.tsx                # 'use client' — DnD context, column layout
│   ├── Column.tsx               # 'use client' — drop target, card list
│   ├── Card.tsx                 # 'use client' — draggable task card
│   ├── CardModal.tsx            # 'use client' — task detail/edit form
│   ├── AddCardButton.tsx        # 'use client' — inline card creation trigger
│   └── ui/
│       ├── PriorityBadge.tsx    # Shared priority indicator
│       ├── LabelChip.tsx        # Color-coded label pill
│       └── DateDisplay.tsx      # Formatted due date with overdue highlight
│
├── lib/
│   ├── db/
│   │   ├── index.ts             # Database connection singleton (server-only)
│   │   ├── schema.ts            # Drizzle schema: tasks, labels tables
│   │   ├── queries.ts           # Typed read queries wrapped in React cache()
│   │   └── migrate.ts           # Migration runner called at app startup
│   ├── types.ts                 # Shared TypeScript types (Task, Column, Label)
│   └── utils.ts                 # Shared helpers (date formatting, etc.)
│
├── drizzle/
│   └── migrations/              # Drizzle-generated SQL migration files
│
├── public/                      # Static assets (favicon, etc.)
├── next.config.ts               # Next.js config: standalone output for VPS
├── drizzle.config.ts            # Drizzle Kit config pointing to tasks.db
├── package.json
├── tsconfig.json
└── .env.local                   # DATABASE_PATH=/data/tasks.db (not committed)
```

### Structure Rationale

- **`app/actions/tasks.ts`:** Centralizing all mutations in one file makes the data contract explicit. Every state change in the UI maps to a named function here.
- **`components/` at root:** Keeps non-routing components flat and easy to discover. Avoids deeply nested `app/_components` hierarchies that obscure the component tree.
- **`lib/db/`:** Isolates all database concerns. `index.ts` exports a single `db` instance; nothing outside this folder imports `better-sqlite3` directly. This is the only folder that is truly server-only.
- **`lib/types.ts`:** Single source of truth for the `Task`, `Column`, and `Label` types. Server actions, queries, and client components all import from here — no type drift.
- **`drizzle/migrations/`:** Checked into version control. Migrations are the audit log of schema changes; losing them on VPS would require manual recovery.

---

## Architectural Patterns

### Pattern 1: Server Component Page + Client Island Board

**What:** `app/page.tsx` is an async Server Component that reads the database directly (no fetch, no API route). It passes the fully loaded task data as props to `<Board>`, which is a Client Component that owns all drag-and-drop interactivity.

**When to use:** Always. This is the correct Next.js App Router pattern for a data-driven interactive page. Server Components handle initial data load with zero round-trips; Client Components handle events.

**Trade-offs:** Board state (position of cards mid-drag) lives in the client. After a mutation via Server Action, `revalidatePath('/')` causes the Server Component to re-render and push fresh data down. This means no separate client-side state store (no Zustand, no Redux) is needed.

**Example:**
```typescript
// app/page.tsx — Server Component
import { getTasks } from '@/lib/db/queries'
import Board from '@/components/Board'

export default async function Page() {
  const tasks = await getTasks()  // direct DB read, no fetch()
  return <Board initialTasks={tasks} />
}

// components/Board.tsx — Client Component
'use client'
import { DndContext } from '@dnd-kit/core'

export default function Board({ initialTasks }: { initialTasks: Task[] }) {
  // DnD state lives here
}
```

### Pattern 2: Server Actions for All Mutations

**What:** Every write operation (create, update, move, delete task) is a Server Action in `app/actions/tasks.ts`. Client Components call these functions directly — no REST API, no fetch, no API routes needed.

**When to use:** This project has no external consumers of its data. API routes would add indirection with no benefit. Server Actions are the correct choice for a single-user, self-contained app.

**Trade-offs:** Server Actions serialize one at a time on the client (current Next.js implementation). For drag-and-drop reordering this is fine — moves are sequential and fast. If bulk operations are needed later, they should be batched into a single action.

**Example:**
```typescript
// app/actions/tasks.ts
'use server'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

export async function moveTask(taskId: number, toColumn: string, newOrder: number) {
  await db.update(tasks)
    .set({ columnId: toColumn, order: newOrder })
    .where(eq(tasks.id, taskId))
  revalidatePath('/')  // re-renders page.tsx with fresh data
}
```

### Pattern 3: Optimistic UI for Drag-and-Drop

**What:** When a card is dragged to a new column, update the local Board state immediately (optimistic), then call the Server Action in the background. If the action fails, revert the local state.

**When to use:** Drag-and-drop interactions. The 50-200ms Server Action round-trip makes drag feel laggy if you wait for the server before rendering the new position.

**Trade-offs:** Requires local state management inside Board component. The pattern is: `startTransition` + `useOptimistic` from React, or manual state + error rollback. Keep the optimistic state minimal — only column assignment and order, not full task data.

**Example:**
```typescript
'use client'
import { useOptimistic, startTransition } from 'react'
import { moveTask } from '@/app/actions/tasks'

function Board({ initialTasks }: { initialTasks: Task[] }) {
  const [optimisticTasks, setOptimisticTasks] = useOptimistic(initialTasks)

  function handleDragEnd(event: DragEndEvent) {
    const { taskId, toColumn, newOrder } = resolveMove(event)
    startTransition(async () => {
      setOptimisticTasks(applyMove(optimisticTasks, taskId, toColumn, newOrder))
      await moveTask(taskId, toColumn, newOrder)
    })
  }
}
```

---

## Data Flow

### Request Flow (Initial Page Load)

```
Browser navigates to /
    ↓
Next.js Node.js server receives request
    ↓
app/layout.tsx renders HTML shell
    ↓
app/page.tsx (async Server Component) executes
    ↓
getTasks() → lib/db/queries.ts → Drizzle ORM → SQLite file (tasks.db)
    ↓
Task[] returned synchronously (SQLite in-process, no network)
    ↓
<Board initialTasks={tasks} /> serialized and streamed to client
    ↓
Client hydrates Board, Column, Card Client Components
    ↓
DnD library activates, UI is interactive
```

### Mutation Flow (User Drags Card / Edits Task)

```
User action (drag drop / form submit) in Client Component
    ↓
[Optimistic UI update — Board state updated immediately]
    ↓
Server Action called (POST request to Next.js server, auto-managed)
    ↓
Server Action body: validate input → Drizzle query → SQLite write
    ↓
revalidatePath('/') called inside Server Action
    ↓
Next.js re-renders app/page.tsx on server with fresh DB data
    ↓
Updated Task[] streamed to client, React reconciles Board state
    ↓
[Optimistic state replaced with server-confirmed state]
```

### State Management

```
SQLite (tasks.db) — source of truth for all task data
    ↓ (initial load via getTasks())
app/page.tsx Server Component — reads and passes to Board
    ↓ (initialTasks prop)
Board Client Component — holds DnD state + optimistic state
    ↑ (revalidatePath after Server Action)
Server Actions (moveTask, createTask, etc.) — write to SQLite
```

There is no separate client-side state store. React's `useOptimistic` covers the transient drag state. All persistent state lives in SQLite.

### Key Data Flows

1. **Card move (drag-drop):** `Board.handleDragEnd` → `useOptimistic` update → `moveTask()` Server Action → SQLite UPDATE → `revalidatePath('/')` → Server Component re-render → Board reconciled
2. **Card create:** `AddCardButton` form → `createTask()` Server Action → SQLite INSERT → `revalidatePath('/')` → new card appears in column
3. **Card edit (modal):** `CardModal` form submit → `updateTask()` Server Action → SQLite UPDATE → `revalidatePath('/')` → modal closes, card reflects new data
4. **Card delete:** Delete button → `deleteTask()` Server Action → SQLite DELETE → `revalidatePath('/')` → card removed from board

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (this project) | SQLite on local disk — fastest possible read/write, zero config, zero network latency |
| 1-10 concurrent users | SQLite with WAL mode enabled — handles concurrent reads, serializes writes, still no config needed |
| 100+ concurrent users | Switch to PostgreSQL (Drizzle schema is portable); add connection pooling (PgBouncer); keep Next.js monolith |
| 1000+ users | Add Redis for session/cache; split read replicas; consider moving to separate API service |

### Scaling Priorities for This Project

1. **First bottleneck (not expected):** SQLite write contention — mitigated by WAL mode. For a single-user personal tool, this will never be hit.
2. **If scaling becomes needed:** Drizzle ORM supports PostgreSQL with schema changes only (no application logic changes). The Server Action pattern and component architecture remain unchanged.

---

## Anti-Patterns

### Anti-Pattern 1: Using API Routes Instead of Server Actions

**What people do:** Create `app/api/tasks/route.ts` with GET/POST/PUT/DELETE handlers, then fetch from Client Components with `fetch('/api/tasks')`.

**Why it's wrong:** This project has no external API consumers. API routes add a serialization layer (JSON encode/decode), an extra HTTP round-trip within the same process, and boilerplate CRUD for zero benefit. Server Actions make the mutation a direct function call.

**Do this instead:** Server Actions in `app/actions/tasks.ts`. Call them like functions from Client Components. No fetch, no JSON, no error wrapping.

### Anti-Pattern 2: Client-Side State Store for Task Data

**What people do:** Pull all tasks into Zustand or Redux on the client, then sync mutations back to the server with fetch calls.

**Why it's wrong:** Introduces a second source of truth. Cache invalidation becomes a problem: when does the client-side store go stale? Next.js App Router's `revalidatePath` + Server Components already solve this correctly — the database is the store, and re-renders propagate fresh data automatically.

**Do this instead:** Keep persistent state in SQLite, accessed via Server Component re-renders triggered by `revalidatePath`. Use `useOptimistic` only for the brief optimistic window during drag-and-drop.

### Anti-Pattern 3: Putting the Database Connection in a Client Component

**What people do:** Import `better-sqlite3` or Drizzle's `db` instance anywhere in the component tree, not realizing Client Components are bundled for the browser.

**Why it's wrong:** Build will fail or produce unexpected behavior. `better-sqlite3` is a native Node.js module and cannot run in the browser. The `db` instance must only exist in server-only code.

**Do this instead:** Database imports stay in `lib/db/index.ts` (mark with `import 'server-only'` package for safety). Server Components and Server Actions are the only callers. Use the TypeScript type `Task` (from `lib/types.ts`) in Client Components — never the raw DB query functions.

### Anti-Pattern 4: Making the Board a Server Component

**What people do:** Try to make `Board` a Server Component to co-locate data fetching, then discover that drag-and-drop requires browser APIs unavailable on the server.

**Why it's wrong:** DnD libraries (dnd-kit, react-beautiful-dnd) rely on pointer events, DOM positions, and `useRef` — all browser-only. Server Components cannot have event handlers or client-side state.

**Do this instead:** `app/page.tsx` is the Server Component that fetches data. `Board` is the Client Component boundary (`'use client'`). Pass fetched data as props to Board. This is the canonical Server/Client boundary pattern in Next.js App Router.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None required | — | Personal app with no external dependencies |

This project is intentionally self-contained. No email, no auth, no third-party APIs.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app/page.tsx` → `components/Board.tsx` | Props (serialized Task[]) | Server → Client boundary; only serializable data crosses this line (no functions, no class instances) |
| `components/Board.tsx` → `app/actions/tasks.ts` | Direct function import (Server Action) | Next.js handles the POST transport internally; from the developer's view, it's a function call |
| `app/actions/tasks.ts` → `lib/db/` | Direct import | Both are server-only; Drizzle query functions called directly |
| `lib/db/index.ts` → SQLite file | `better-sqlite3` synchronous API | File path from `DATABASE_PATH` env var; synchronous reads acceptable for single-user load |

### Deployment Boundary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Reverse proxy | nginx | Required for HTTPS termination, streaming support needs `X-Accel-Buffering: no` header |
| App server | `next start` (Node.js) | `output: 'standalone'` in next.config.ts minimizes deployment size |
| Process manager | PM2 or systemd | Ensures Next.js restarts on crash; handles SIGTERM gracefully for Server Action cleanup |
| Database file | SQLite at `/data/tasks.db` | Path configured via env var; must be on persistent VPS disk (not ephemeral) |

---

## Build Order Implications

The component dependency graph determines safe build order:

```
Phase 1 — Data Foundation (everything depends on this)
  lib/db/schema.ts          → defines Task, Column types
  lib/db/index.ts           → DB connection
  lib/db/queries.ts         → getTasks() and related reads
  lib/types.ts              → shared TypeScript interfaces
  app/actions/tasks.ts      → mutations (depends on db, types)

Phase 2 — UI Primitives (no DnD, no state)
  components/ui/PriorityBadge.tsx
  components/ui/LabelChip.tsx
  components/ui/DateDisplay.tsx

Phase 3 — Board Components (DnD, Client state)
  components/Card.tsx       → depends on ui/ primitives
  components/CardModal.tsx  → depends on Card types + Server Actions
  components/Column.tsx     → depends on Card
  components/Board.tsx      → depends on Column + DnD library

Phase 4 — Pages and Layout
  app/layout.tsx            → root shell (no deps)
  app/page.tsx              → depends on getTasks() + Board component
  app/loading.tsx           → skeleton UI for page.tsx

Phase 5 — Deployment Configuration
  next.config.ts            → standalone output mode
  nginx config              → reverse proxy with buffering disabled
  PM2/systemd               → process management
  Drizzle migrations        → must run before first start
```

**Critical dependency:** Drizzle migrations (`drizzle-kit migrate`) must run before `next start` on any new environment. The app will crash on first DB query if the schema doesn't exist. Build a startup script that runs migrations then starts Next.js.

---

## Sources

- Next.js Official Docs — Layouts and Pages: https://nextjs.org/docs/app/getting-started/layouts-and-pages (v16.1.6, updated 2026-02-27) — HIGH confidence
- Next.js Official Docs — Fetching Data: https://nextjs.org/docs/app/getting-started/fetching-data (v16.1.6, updated 2026-02-27) — HIGH confidence
- Next.js Official Docs — Updating Data (Server Actions): https://nextjs.org/docs/app/getting-started/updating-data (v16.1.6, updated 2026-02-27) — HIGH confidence
- Next.js Official Docs — Self-Hosting: https://nextjs.org/docs/app/guides/self-hosting (v16.1.6, updated 2026-02-27) — HIGH confidence
- Next.js Official Docs — Project Structure: https://nextjs.org/docs/app/getting-started/project-structure (v16.1.6, updated 2026-02-27) — HIGH confidence
- Next.js Official Docs — Route Handlers: https://nextjs.org/docs/app/api-reference/file-conventions/route (v16.1.6, updated 2026-02-27) — HIGH confidence
- Next.js Official Docs — Deploying: https://nextjs.org/docs/app/getting-started/deploying (v16.1.6, updated 2026-02-27) — HIGH confidence
- Hostinger Next.js Deploy Template mentioned in official Next.js docs: https://github.com/hostinger/deploy-nextjs — MEDIUM confidence (referenced by official docs, not directly verified)

---

*Architecture research for: Personal Kanban Task Board (Next.js, self-hosted VPS)*
*Researched: 2026-02-28*
