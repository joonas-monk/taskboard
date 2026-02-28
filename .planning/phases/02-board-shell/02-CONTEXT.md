# Phase 2: Board Shell - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see a kanban board with 5 fixed columns and real card data from the database. Cards display title, priority badge, due date (with overdue indicator), and color labels. No interactions beyond viewing — no create, edit, delete, or drag. The board renders without hydration errors after `next build && next start`.

</domain>

<decisions>
## Implementation Decisions

### Board layout
- Horizontal scrolling board with 5 columns side by side
- Each column has a header with the Finnish column name
- Cards stack vertically within columns, ordered by position
- Board fills the viewport height (full-screen kanban experience)

### Card face display
- Card shows: title (primary text), priority badge (colored chip), due date, label chips
- Priority badge uses color coding: Critical = red, High = orange, Medium = blue, Low = gray
- Overdue indicator: due date text turns red when past due
- Labels shown as small colored chips below the title
- Card has a subtle shadow/border for visual separation

### Server/Client component boundary
- `app/page.tsx` is an async Server Component — calls `getBoard()` directly
- Board component is a Client Component (needed for future DnD, imported with `dynamic({ ssr: false })` per RESEARCH.md pitfall)
- Column and Card components are Client Components (children of Board)

### UI primitives
- PriorityBadge: small colored chip showing priority text in Finnish
- LabelChip: small colored dot/chip showing label name
- DateDisplay: shows formatted date, red text if overdue
- All text in Finnish

### Claude's Discretion
- Color palette for priority badges and general UI theme (Claude picks clean, modern look)
- Card density and spacing within columns
- Whether to show empty state message when a column has no cards
- Loading skeleton design for `app/loading.tsx`
- Font choice (keep Geist from scaffold or switch)

</decisions>

<specifics>
## Specific Ideas

- Board should feel like Trello — clean, card-based, scannable at a glance
- Priority text in Finnish: Kriittinen, Korkea, Keskitaso, Matala
- Column headers should be visually distinct from cards

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/actions/tasks.ts`: `getBoard()` — fully implemented, returns `ColumnWithCards[]`
- `src/types/index.ts`: All types ready (CardWithLabels, ColumnWithCards, Priority, etc.)
- `src/app/globals.css`: Tailwind v4 setup with `@import "tailwindcss"`
- `src/app/layout.tsx`: Root layout with Geist fonts

### Established Patterns
- Prisma types re-exported from `src/types/index.ts`
- Server-side data fetching via direct function call (no API routes)
- `@/` path alias configured in tsconfig.json

### Integration Points
- `getBoard()` from `src/actions/tasks.ts` returns ordered columns with cards and labels
- Board component will receive `ColumnWithCards[]` as props from page.tsx
- Phase 3 (Card CRUD) will add click handlers to cards and create buttons to columns
- Phase 4 (Drag and Drop) will wrap Board in DndContext

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-board-shell*
*Context gathered: 2026-02-28*
