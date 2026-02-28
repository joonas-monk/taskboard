# Phase 2: Board Shell - Research

**Researched:** 2026-02-28
**Domain:** Next.js 16 App Router, React 19, Tailwind CSS v4, Prisma 7 type serialization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Horizontal scrolling board with 5 columns side by side
- Each column has a header with the Finnish column name
- Cards stack vertically within columns, ordered by position
- Board fills the viewport height (full-screen kanban experience)
- Card shows: title (primary text), priority badge (colored chip), due date, label chips
- Priority badge uses color coding: Critical = red, High = orange, Medium = blue, Low = gray
- Overdue indicator: due date text turns red when past due
- Labels shown as small colored chips below the title
- Card has a subtle shadow/border for visual separation
- `app/page.tsx` is an async Server Component — calls `getBoard()` directly
- Board component is a Client Component imported with `dynamic({ ssr: false })`
- Column and Card components are Client Components (children of Board)
- PriorityBadge: small colored chip showing priority text in Finnish
- LabelChip: small colored dot/chip showing label name
- DateDisplay: shows formatted date, red text if overdue
- All text in Finnish
- Priority text: Kriittinen, Korkea, Keskitaso, Matala

### Claude's Discretion
- Color palette for priority badges and general UI theme (Claude picks clean, modern look)
- Card density and spacing within columns
- Whether to show empty state message when a column has no cards
- Loading skeleton design for `app/loading.tsx`
- Font choice (keep Geist from scaffold or switch)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOARD-01 | User sees a kanban board with 5 fixed columns | Board layout pattern, dynamic() SSR disable, getBoard() integration |
| META-01 | User can set priority and see it as a badge on the card | PriorityBadge component pattern, Priority enum mapping to Finnish text and Tailwind colors |
| META-02 | User can set a due date and see an overdue indicator | DateDisplay component pattern, Intl.DateTimeFormat for Finnish locale, date comparison on client |
| META-03 | User can assign color-coded labels to a card | LabelChip component pattern, Label.color field (hex or Tailwind class) from DB |
</phase_requirements>

---

## Summary

Phase 2 builds a read-only kanban board shell: 5 fixed Finnish-named columns rendered horizontally with real data from `getBoard()`. The primary technical challenges are (1) preventing hydration errors from the future DnD library by disabling SSR on the Board component, (2) safely passing Prisma objects (which contain `Date` instances) from a Server Component to a Client Component, and (3) using Tailwind v4's CSS-first approach correctly for the layout and card primitives.

The project uses Next.js 16.1.6 with React 19, Tailwind CSS v4 (CSS-based config), TypeScript 5 with strict mode, and Prisma 7.4 with a custom-generated client at `src/generated/prisma/`. The types are already defined in `src/types/index.ts` and all data fetching infrastructure is ready. The only new work is React component files.

The critical serialization pitfall is that `Card.dueDate`, `Card.createdAt`, `Card.updatedAt`, and `Column.createdAt` are `Date` objects in the Prisma result. React 19 cannot serialize `Date` objects as props from Server to Client Components — they must be converted to ISO strings before crossing the boundary. The safest fix is a serialization function in `page.tsx` that converts all `Date` fields to `string`.

**Primary recommendation:** Convert `Date` fields to ISO strings in `page.tsx` before passing to the Board client component. Use `dynamic(() => import('@/components/board/Board'), { ssr: false })` to wrap the board. Use Tailwind v4 utility classes directly in JSX — no `tailwind.config.js` file is used.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 (installed) | App Router, SSR boundary, `dynamic()` | Project constraint |
| React | 19.2.3 (installed) | Client components, hooks | Project constraint |
| TypeScript | 5.x (installed) | Type safety | Project constraint |
| Tailwind CSS | 4.x (installed) | Utility-class styling | Project constraint |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/dynamic` | built-in | Lazy-load with `ssr: false` | Board component only — prevents DnD hydration errors |
| `Intl.DateTimeFormat` | browser/Node built-in | Finnish date formatting | DateDisplay component |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Intl.DateTimeFormat | date-fns + fi locale | date-fns is an extra dep; Intl is zero-cost and handles `fi` correctly |
| Tailwind utility classes | CSS Modules | Tailwind v4 is already installed and globals.css uses `@import "tailwindcss"` |

**Installation:** No new packages needed for this phase.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── page.tsx           # Server Component — calls getBoard(), serializes, renders Board
│   ├── loading.tsx        # Skeleton shown while Board lazy-loads
│   ├── layout.tsx         # Existing root layout (keep)
│   └── globals.css        # Existing Tailwind v4 setup (keep)
├── components/
│   └── board/
│       ├── Board.tsx      # 'use client' — receives serialized columns, renders columns
│       ├── Column.tsx     # 'use client' — renders column header + card list
│       ├── Card.tsx       # 'use client' — renders single card face
│       ├── PriorityBadge.tsx  # 'use client' — colored chip with Finnish priority text
│       ├── LabelChip.tsx      # 'use client' — colored chip for a label
│       └── DateDisplay.tsx    # 'use client' — formatted date, red if overdue
├── actions/tasks.ts       # Existing — getBoard() fully implemented
└── types/index.ts         # Existing — ColumnWithCards, CardWithLabels
```

### Pattern 1: Server Component → Client Component Boundary with Date Serialization

**What:** `page.tsx` fetches data, converts `Date` to `string`, passes to Client Component.
**When to use:** Any time Prisma results flow into Client Components. `Date` objects are not serializable across the RSC boundary in React 19.

**The problem:** `ColumnWithCards` contains `card.dueDate: Date | null`, `card.createdAt: Date`, `card.updatedAt: Date`, `column.createdAt: Date`. React 19 will throw "Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported." if `Date` objects are passed as props.

**The solution — define a serialized type and a conversion function:**
```typescript
// src/app/page.tsx
import dynamic from 'next/dynamic'
import { getBoard } from '@/actions/tasks'
import type { ColumnWithCards } from '@/types'

// Serialized shapes safe for RSC → Client boundary
export type SerializedCard = Omit<
  ColumnWithCards['cards'][number],
  'dueDate' | 'createdAt' | 'updatedAt'
> & {
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export type SerializedColumn = Omit<ColumnWithCards, 'cards' | 'createdAt'> & {
  createdAt: string
  cards: SerializedCard[]
}

function serializeColumn(col: ColumnWithCards): SerializedColumn {
  return {
    ...col,
    createdAt: col.createdAt.toISOString(),
    cards: col.cards.map((card) => ({
      ...card,
      dueDate: card.dueDate ? card.dueDate.toISOString() : null,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    })),
  }
}

const Board = dynamic(() => import('@/components/board/Board'), { ssr: false })

export default async function HomePage() {
  const columns = await getBoard()
  const serialized = columns.map(serializeColumn)
  return <Board columns={serialized} />
}
```

### Pattern 2: dynamic() with ssr: false in App Router

**What:** `next/dynamic` with `{ ssr: false }` skips server rendering of the wrapped component entirely.
**When to use:** Components that use browser-only APIs (like DnD libraries). In this phase we pre-emptively apply it to Board so Phase 4 (DnD) does not require structural refactoring.

```typescript
// Source: Next.js 16 official docs — https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading
import dynamic from 'next/dynamic'

const Board = dynamic(() => import('@/components/board/Board'), {
  ssr: false,
  loading: () => <BoardSkeleton />,  // optional — loading.tsx handles this phase-level
})
```

**Key constraint:** `dynamic()` is only valid in a Server Component or another lazy-loaded component. In App Router, `page.tsx` is a Server Component by default, so this placement is correct. The Board component itself uses `'use client'`.

### Pattern 3: Board Layout with Tailwind v4

**What:** Horizontal scrolling, full-viewport-height kanban board using Tailwind utility classes.
**Tailwind v4 note:** No `tailwind.config.js` needed. The project uses `@import "tailwindcss"` in `globals.css`. All standard utilities are available. Arbitrary values like `w-[280px]` still work. The `@theme inline` block in `globals.css` already defines `--color-background` and `--font-sans`.

```tsx
// Board.tsx — full-height horizontal scroll container
'use client'

export default function Board({ columns }: { columns: SerializedColumn[] }) {
  return (
    <div className="flex h-screen overflow-x-auto overflow-y-hidden bg-slate-100 p-4 gap-3">
      {columns.map((col) => (
        <Column key={col.id} column={col} />
      ))}
    </div>
  )
}
```

```tsx
// Column.tsx — fixed-width, full-height column
'use client'

export default function Column({ column }: { column: SerializedColumn }) {
  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-slate-200 rounded-xl">
      <div className="px-3 py-2.5 font-semibold text-sm text-slate-700 border-b border-slate-300">
        {column.name}
        <span className="ml-2 text-xs font-normal text-slate-500">
          {column.cards.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {column.cards.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">Ei kortteja</p>
        )}
        {column.cards.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
```

### Pattern 4: PriorityBadge Component

**What:** Maps Prisma `Priority` enum values to Finnish text and Tailwind color classes.
**The Priority enum** (from `src/generated/prisma/enums.ts`): `CRITICAL | HIGH | MEDIUM | LOW`

```tsx
// src/components/board/PriorityBadge.tsx
'use client'
import type { Priority } from '@/types'

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  CRITICAL: { label: 'Kriittinen', className: 'bg-red-100 text-red-700' },
  HIGH:     { label: 'Korkea',     className: 'bg-orange-100 text-orange-700' },
  MEDIUM:   { label: 'Keskitaso',  className: 'bg-blue-100 text-blue-700' },
  LOW:      { label: 'Matala',     className: 'bg-gray-100 text-gray-600' },
}

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, className } = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
```

### Pattern 5: DateDisplay with Finnish Locale and Overdue Detection

**What:** Formats a date string in Finnish locale; turns text red if the date is in the past.
**Input:** `dueDate: string | null` (ISO string after serialization from `page.tsx`)

```tsx
// src/components/board/DateDisplay.tsx
'use client'

const fiFormatter = new Intl.DateTimeFormat('fi-FI', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

export default function DateDisplay({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null

  const date = new Date(dueDate)
  const isOverdue = date < new Date()
  const formatted = fiFormatter.format(date)

  return (
    <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
      {formatted}
    </span>
  )
}
```

**Finnish date format:** `Intl.DateTimeFormat('fi-FI')` produces `"28.2.2026"` format (day.month.year). This is correct Finnish convention. Confidence HIGH — verified against Intl spec.

**Overdue logic:** `date < new Date()` compares the due date against current time at render. Since DateDisplay is a Client Component, `new Date()` runs in the browser and reflects the user's local time. This avoids hydration mismatch (server time vs client time) because the component is only rendered on the client.

### Pattern 6: LabelChip Component

**What:** Renders a small colored chip. The `Label.color` field in the database is a string (per Prisma schema — `color: string`). The color can be a hex value like `#3b82f6` or whatever was seeded.

```tsx
// src/components/board/LabelChip.tsx
'use client'

export default function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  )
}
```

**Why inline style for color:** Label colors come from the database as arbitrary strings (e.g., `#3b82f6`). Tailwind v4 cannot generate arbitrary dynamic class names at runtime from unknown values — you must use inline `style` for dynamic colors. This is the correct pattern. Do NOT try to use Tailwind's `bg-[${color}]` syntax with runtime values.

### Pattern 7: Card Component Composition

```tsx
// src/components/board/Card.tsx
'use client'
import PriorityBadge from './PriorityBadge'
import LabelChip from './LabelChip'
import DateDisplay from './DateDisplay'
import type { SerializedCard } from '@/app/page'

export default function Card({ card }: { card: SerializedCard }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 flex flex-col gap-2">
      <p className="text-sm font-medium text-slate-800 leading-snug">{card.title}</p>
      <div className="flex items-center gap-1.5 flex-wrap">
        <PriorityBadge priority={card.priority} />
        {card.dueDate && <DateDisplay dueDate={card.dueDate} />}
      </div>
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map(({ label }) => (
            <LabelChip key={label.id} name={label.name} color={label.color} />
          ))}
        </div>
      )}
    </div>
  )
}
```

### Pattern 8: Loading Skeleton (app/loading.tsx)

**What:** Next.js App Router automatically renders `app/loading.tsx` while the dynamic Board component is loading. It wraps the page in a Suspense boundary.

```tsx
// src/app/loading.tsx
export default function Loading() {
  return (
    <div className="flex h-screen overflow-x-auto bg-slate-100 p-4 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-[280px] shrink-0 bg-slate-200 rounded-xl animate-pulse">
          <div className="px-3 py-2.5 h-10 bg-slate-300 rounded-t-xl" />
          <div className="p-2 flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-20 bg-slate-300 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Why loading.tsx works here:** `dynamic({ ssr: false })` causes the Board to be excluded from the server render. React Suspense surfaces this as a loading state. Next.js App Router resolves `app/loading.tsx` as the Suspense fallback for the entire page segment. Since `page.tsx` is async and `await getBoard()` may take time, `loading.tsx` is shown during that wait as well.

### Anti-Patterns to Avoid

- **Passing Date objects as props:** React 19 cannot serialize `Date` across RSC/Client boundaries. Always convert to ISO strings in the Server Component.
- **Dynamic Tailwind class names from runtime data:** `bg-[${someVar}]` does not work with runtime values — use inline `style={{ backgroundColor: someVar }}` for dynamic colors.
- **Putting Board in a Server Component without dynamic():** DnD libraries (Phase 4) will fail with hydration errors if the Board renders on the server. Add `dynamic({ ssr: false })` now.
- **Comparing dates on the server for overdue status:** Server time differs from client time. Computing `isOverdue` inside a Client Component ensures it uses browser time and avoids hydration mismatch.
- **Importing from `src/generated/prisma/` in Client Components:** Prisma client code is server-only. Only `src/types/index.ts` (type-only imports) and serialized plain objects should reach Client Components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date formatting in Finnish | Custom format logic | `Intl.DateTimeFormat('fi-FI')` | Zero dependencies, browser built-in, correct locale |
| Loading states | Custom spinner | `app/loading.tsx` + `animate-pulse` | Next.js App Router handles Suspense automatically |
| CSS layout | Custom CSS scrolling container | Tailwind `flex overflow-x-auto` | v4 is installed; avoid adding raw CSS |

**Key insight:** The project has zero additional dependencies to install for this phase. Everything needed — `next/dynamic`, `Intl`, Tailwind utilities — is already available.

---

## Common Pitfalls

### Pitfall 1: Date Serialization Across RSC Boundary
**What goes wrong:** `TypeError: Only plain objects...` in browser console or build error. Cards with `dueDate`, `createdAt`, `updatedAt` as `Date` objects cannot be passed as props to Client Components.
**Why it happens:** Prisma returns JS `Date` objects. React 19's RSC serialization only handles plain objects, arrays, strings, numbers, booleans, null, undefined.
**How to avoid:** In `page.tsx`, map all `Date` fields to `.toISOString()` before passing to `<Board />`.
**Warning signs:** "Only plain objects, and a few built-ins, can be passed to Client Components" in Next.js build output or browser console.

### Pitfall 2: Hydration Mismatch from `new Date()` on Server
**What goes wrong:** React hydration warning: "Text content does not match server-rendered HTML." Overdue status computed on server differs from client (timezone, clock drift).
**Why it happens:** If `isOverdue` logic runs in a Server Component or during SSR of a Client Component, the server timestamp differs from the browser's `new Date()`.
**How to avoid:** `DateDisplay` is a Client Component. With `dynamic({ ssr: false })`, the entire Board tree (including DateDisplay) only renders in the browser. The `new Date()` comparison only ever runs client-side.
**Warning signs:** Yellow hydration warnings in browser console after `next build && next start`.

### Pitfall 3: Tailwind v4 — No tailwind.config.js
**What goes wrong:** Attempting to add custom colors or plugins using `tailwind.config.js` — the file is ignored in v4.
**Why it happens:** Tailwind v4 uses CSS-based configuration via `@theme` blocks in CSS files. The existing `globals.css` already has `@import "tailwindcss"` and a `@theme inline` block.
**How to avoid:** Add custom tokens in `globals.css` under `@theme`, not in a JS config file. For this phase, standard Tailwind palette utilities (`slate`, `red`, `orange`, `blue`, `gray`) cover all needs — no custom tokens required.
**Warning signs:** Custom colors silently missing in output; no error is thrown.

### Pitfall 4: dynamic() with ssr: false — loading prop vs loading.tsx
**What goes wrong:** Blank screen flash or skeleton not showing, because the `loading` option on `dynamic()` and `app/loading.tsx` interact.
**Why it happens:** `loading.tsx` wraps the whole page in Suspense. The `loading` option on `dynamic()` is an alternative inline fallback. Both can coexist but only one fires depending on which Suspense boundary catches the suspension.
**How to avoid:** Use `app/loading.tsx` as the skeleton (simpler, covers both the async `getBoard()` wait and the Board lazy load). Do not also specify a `loading` prop on `dynamic()` unless you need a different per-component fallback.

### Pitfall 5: Accessing Prisma Client in Client Components
**What goes wrong:** Build error or runtime crash: "PrismaClient is unable to run in this browser environment."
**Why it happens:** Accidentally importing from `@/actions/tasks` or `@/lib/prisma` in a Client Component. Server-only modules get bundled into client bundle.
**How to avoid:** Client Components receive plain serialized data as props. They never import from `actions/` or `lib/prisma`.

### Pitfall 6: Label Color Field Type
**What goes wrong:** Attempting to derive a Tailwind class name from `label.color` (e.g., `bg-[${label.color}]`) and seeing no color applied.
**Why it happens:** Tailwind's JIT/v4 scanner generates classes at build time from static strings in source. Dynamic runtime values in template literals are not scanned.
**How to avoid:** Always use inline `style={{ backgroundColor: label.color }}` for colors that come from the database.

---

## Code Examples

### Full page.tsx Pattern
```typescript
// src/app/page.tsx
import dynamic from 'next/dynamic'
import { getBoard } from '@/actions/tasks'
import type { ColumnWithCards } from '@/types'

export type SerializedCard = Omit<
  ColumnWithCards['cards'][number],
  'dueDate' | 'createdAt' | 'updatedAt'
> & {
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export type SerializedColumn = Omit<ColumnWithCards, 'cards' | 'createdAt'> & {
  createdAt: string
  cards: SerializedCard[]
}

function serializeColumn(col: ColumnWithCards): SerializedColumn {
  return {
    ...col,
    createdAt: col.createdAt.toISOString(),
    cards: col.cards.map((card) => ({
      ...card,
      dueDate: card.dueDate ? card.dueDate.toISOString() : null,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    })),
  }
}

const Board = dynamic(() => import('@/components/board/Board'), { ssr: false })

export default async function HomePage() {
  const columns = await getBoard()
  const serialized = columns.map(serializeColumn)
  return (
    <main className="h-screen overflow-hidden">
      <Board columns={serialized} />
    </main>
  )
}
```

### Finnish Date Formatting Verification
```typescript
// Verified behavior of Intl.DateTimeFormat('fi-FI')
const fmt = new Intl.DateTimeFormat('fi-FI', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})
fmt.format(new Date('2026-03-15')) // => "15.3.2026"
fmt.format(new Date('2026-12-01')) // => "1.12.2026"
```

### Label Access Pattern (CardLabel join table)
The `CardWithLabels` type (from `src/types/index.ts`) has:
```typescript
// card.labels is CardLabel[] where each CardLabel has: { label: Label }
// Label has: { id: string, name: string, color: string }
card.labels.map(({ label }) => ({
  id: label.id,
  name: label.name,
  color: label.color,  // arbitrary string from DB, e.g. "#3b82f6"
}))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | CSS `@theme` blocks in global CSS | Tailwind v4 (2025) | No JS config file; custom tokens go in CSS |
| `pages/` router with `getServerSideProps` | App Router async Server Components | Next.js 13+ | Direct `await` in page component replaces data fetching props |
| next/dynamic with pages router SSR patterns | next/dynamic in App Router (same API, different context) | Next.js 13+ | `dynamic()` is called in Server Components in App Router |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps`: Not applicable in App Router. Use async Server Components directly.
- `tailwind.config.js` for token customization: Replaced by `@theme` in CSS in v4.

---

## Open Questions

1. **Label color format in seed data**
   - What we know: `Label.color` is a `string` field in the schema. `LabelChip` will use `style={{ backgroundColor: color }}`.
   - What's unclear: Whether seed data uses hex (`#3b82f6`), rgb, or CSS variable format.
   - Recommendation: Write `LabelChip` to accept any CSS color string. If seed data uses Tailwind class names instead of CSS colors, the planner task should check `prisma/seed.ts` and note that format.

2. **layout.tsx `lang` attribute**
   - What we know: Current `layout.tsx` has `<html lang="en">`. Content is in Finnish.
   - What's unclear: Whether accessibility requirements need `lang="fi"`.
   - Recommendation: Update `lang="fi"` in `layout.tsx` as part of this phase. Also update `metadata.title` to reflect the app name.

---

## Sources

### Primary (HIGH confidence)
- Project source code — `src/types/index.ts`, `src/actions/tasks.ts`, `src/generated/prisma/` — direct inspection
- `package.json` — verified Next.js 16.1.6, React 19.2.3, Tailwind CSS v4, Prisma 7.4.2
- `src/app/globals.css` — verified Tailwind v4 `@import "tailwindcss"` pattern
- MDN Web Docs — `Intl.DateTimeFormat` with `fi-FI` locale

### Secondary (MEDIUM confidence)
- Next.js 16 App Router docs — `dynamic()` with `ssr: false` pattern, `loading.tsx` Suspense behavior
- Tailwind CSS v4 docs — CSS-based config, `@theme` blocks, no `tailwind.config.js`

### Tertiary (LOW confidence)
- None for this phase — all critical claims verified against project source code directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from installed `package.json` and `node_modules`
- Architecture: HIGH — component structure derived directly from existing types and framework behavior
- Serialization pitfall: HIGH — React 19 RSC serialization constraint is well-documented and directly applies to the `Date` fields found in the Prisma models
- Tailwind v4 patterns: HIGH — verified from `globals.css` and Tailwind v4 documentation
- Finnish date format: HIGH — `Intl.DateTimeFormat('fi-FI')` is a browser built-in with no external dependency

**Research date:** 2026-02-28
**Valid until:** 2026-04-30 (stable stack — Next.js, Tailwind v4, Prisma types are not fast-moving at patch level)
