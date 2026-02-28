# TaskBoard

Personal kanban board (Trello-like) built with Next.js 16 + Prisma 7 + SQLite. Single-user, no auth. Finnish UI.

## GSD Workflow

This project uses **Claude Get Shit Done** (`/gsd:*`) for structured development.

### Quick Reference
- `/gsd:progress` — Check where we are and what's next
- `/gsd:plan-phase <N>` — Plan the next phase (research → plan → verify loop)
- `/gsd:execute-phase <N>` — Execute a planned phase
- `/gsd:verify-work` — Verify completed work via conversational UAT
- `/gsd:discuss-phase <N>` — Gather context decisions before planning

### Current State
- Planning directory: `.planning/`
- Roadmap: `.planning/ROADMAP.md`
- State: `.planning/STATE.md`
- Config: `.planning/config.json` (yolo mode, balanced profile)

## Tech Stack

- **Next.js 16.1.6** (App Router, Server Components, Server Actions)
- **React 19** (useOptimistic, useActionState, useTransition)
- **Prisma 7** with SQLite via `@prisma/adapter-better-sqlite3`
- **Tailwind CSS v4** (CSS-based config, `@import "tailwindcss"`)
- **Zod 4** for Server Action validation
- **TypeScript 5**

## Dev Server

```bash
# Uses --webpack flag (Turbopack crashes due to nvm PATH issue with PostCSS)
# Config in .claude/launch.json
/gsd:progress  # or start manually:
export PATH="/Users/harimaa/.nvm/versions/node/v24.14.0/bin:$PATH"
cd /Users/harimaa/Documents && node node_modules/.bin/next dev --webpack
```

Port: 3000

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Server Component: fetches board + labels, serializes dates
│   ├── layout.tsx        # Root layout, lang="fi"
│   └── loading.tsx       # Loading skeleton
├── actions/
│   ├── tasks.ts          # Server Actions: createTask, updateTask, deleteTask, moveTask(stub), reorderTasks(stub)
│   └── schemas.ts        # Zod validation schemas
├── components/board/
│   ├── Board.tsx          # Client: selectedCard state, renders CardModal
│   ├── BoardLoader.tsx    # Client wrapper for dynamic({ ssr: false })
│   ├── Column.tsx         # Client: useOptimistic cards, renders AddCardForm
│   ├── Card.tsx           # Card face with priority/labels/date
│   ├── CardModal.tsx      # Native <dialog> edit/delete modal
│   ├── AddCardForm.tsx    # Inline quick-add with optimistic UI
│   ├── PriorityBadge.tsx  # Finnish priority labels
│   ├── LabelChip.tsx      # Color chip (inline style)
│   └── DateDisplay.tsx    # fi-FI date format, overdue detection
├── lib/
│   ├── prisma.ts          # Singleton with better-sqlite3 adapter
│   └── positions.ts       # Float position utilities (1000-gap)
├── types/
│   └── index.ts           # All types: Card, Column, Serialized*, ActionResult<T>
└── generated/prisma/      # Prisma generated client (git-ignored)

prisma/
├── schema.prisma          # Column, Card, Label, CardLabel models
├── seed.ts                # 5 Finnish columns + 4 default labels
```

## Critical Patterns

### Date Serialization (RSC → Client boundary)
Prisma returns Date objects. Convert to ISO strings before passing to client components:
```typescript
// page.tsx serializeColumn() handles this
card.dueDate?.toISOString()
card.createdAt.toISOString()
```

### Explicit Many-to-Many Labels
CardLabel is an explicit join table. Use `deleteMany + create`, NOT `set`:
```typescript
labels: { deleteMany: {}, create: labelIds.map(id => ({ label: { connect: { id } } })) }
```

### Optimistic UI
- `useOptimistic` in Column.tsx for card creation
- Optimistic cards have `id.startsWith('optimistic-')` — disable onClick for these
- Always wrap `addOptimistic` calls inside `startTransition`

### Server Actions
- All mutations use `ActionResult<T>` discriminated union
- Always call `revalidatePath('/')` after mutations
- Import `revalidatePath` from `next/cache` (not `next/navigation`)

### BoardLoader Pattern
Next.js 16 disallows `dynamic({ ssr: false })` in Server Components. Use a thin client wrapper (BoardLoader.tsx).

## Database

- Dev path: `file:/Users/harimaa/data/taskboard/taskboard.db`
- Prod path (Phase 5): `/var/data/taskboard/tasks.db`
- Prisma 7 requires `prisma.config.ts` + `generator prisma-client` (not `prisma-client-js`)
- Generated client output: `src/generated/prisma`

## Finnish UI

All user-facing text is Finnish:
- Columns: Idea, Suunnittelu, Toteutus, Testaus, Valmis
- Priorities: Kriittinen, Korkea, Keskitaso, Matala
- Actions: Tallenna, Peruuta, Poista kortti, Lisaa kortti
- Errors: Finnish error messages in Server Actions

## Conventions

- No `any` types in the data layer
- Server Components for data loading, Server Actions for mutations
- Native `<dialog>` for modals (no portal libraries)
- Float-based card ordering (1000 initial gap, midpoint insertion)
- Inline styles for dynamic colors (Tailwind v4 can't do dynamic class names)
- Commit message format: `feat(phase-task): description` or `docs(phase): description`
