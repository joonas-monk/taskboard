---
phase: 02-board-shell
plan: 01
subsystem: ui
tags: [nextjs, react, tailwind, kanban, server-components, client-components, finnish-locale]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "Prisma schema, getBoard() query, CardWithLabels/ColumnWithCards types"
provides:
  - "Read-only kanban board rendering 5 Finnish-named columns with cards"
  - "SerializedCard/SerializedColumn types for RSC->Client boundary"
  - "PriorityBadge, LabelChip, DateDisplay UI primitive components"
  - "Board/Column/Card structural client components"
  - "BoardLoader client wrapper for dynamic ssr:false import"
  - "loading.tsx skeleton fallback"
affects: [03-crud-operations, 04-drag-drop, 05-deployment]

# Tech tracking
tech-stack:
  added: [next/dynamic]
  patterns: [server-client-boundary-serialization, client-wrapper-for-dynamic-ssr-false, fi-FI-locale-formatting]

key-files:
  created:
    - src/components/board/PriorityBadge.tsx
    - src/components/board/LabelChip.tsx
    - src/components/board/DateDisplay.tsx
    - src/components/board/Card.tsx
    - src/components/board/Column.tsx
    - src/components/board/Board.tsx
    - src/components/board/BoardLoader.tsx
    - src/app/loading.tsx
  modified:
    - src/app/page.tsx
    - src/app/layout.tsx
    - src/types/index.ts

key-decisions:
  - "BoardLoader client wrapper pattern: Next.js 16 disallows ssr:false in Server Components, so dynamic import moved to a thin client component"
  - "SerializedCard/SerializedColumn types placed in src/types/index.ts (not page.tsx) to prevent client components importing from Server Component files"

patterns-established:
  - "RSC serialization: Date fields converted to ISO strings via serializeColumn() before passing to client tree"
  - "Client wrapper for dynamic: ssr:false must live in a 'use client' component (BoardLoader), not the Server Component page"
  - "Finnish locale: Intl.DateTimeFormat('fi-FI') for dates, Finnish labels throughout UI"

requirements-completed: [BOARD-01, META-01, META-02, META-03]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 2 Plan 1: Board Shell Summary

**Read-only kanban board with 5 Finnish-named columns, priority badges (Kriittinen/Korkea/Keskitaso/Matala), fi-FI date formatting with overdue detection, and color-coded label chips rendered from Prisma data via RSC serialization**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T11:58:43Z
- **Completed:** 2026-02-28T12:03:15Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Built 7 board components (3 UI primitives + 3 structural + 1 client wrapper) with proper Server/Client boundary
- page.tsx fetches real data via getBoard(), serializes Date objects to ISO strings, passes to client tree
- Finnish locale throughout: priority labels, date formatting, empty state text, HTML lang, page metadata
- Production build succeeds with zero errors and no hydration warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create UI primitive components** - `5d624b7` (feat)
2. **Task 2: Create Board, Column, and Card client components** - `bbba2fe` (feat)
3. **Task 3: Wire page.tsx, update layout.tsx, create loading.tsx** - `e5c27d9` (feat)

## Files Created/Modified
- `src/components/board/PriorityBadge.tsx` - Maps Priority enum to Finnish text and Tailwind color classes
- `src/components/board/LabelChip.tsx` - Color-coded label chip using inline backgroundColor style
- `src/components/board/DateDisplay.tsx` - Finnish-formatted date with overdue detection (red text when past)
- `src/components/board/Card.tsx` - Card face composing priority, date, and label primitives
- `src/components/board/Column.tsx` - Column with header, card count badge, and card list with empty state
- `src/components/board/Board.tsx` - Horizontal scrolling board container
- `src/components/board/BoardLoader.tsx` - Client wrapper for dynamic({ ssr: false }) import
- `src/app/page.tsx` - Async Server Component with data fetching and Date serialization
- `src/app/layout.tsx` - Updated lang="fi", title="TaskBoard", Finnish description
- `src/app/loading.tsx` - 5-column skeleton fallback with animate-pulse
- `src/types/index.ts` - Added SerializedCard and SerializedColumn types

## Decisions Made
- **BoardLoader client wrapper pattern:** Next.js 16 does not allow `ssr: false` with `next/dynamic` in Server Components. Created a thin `BoardLoader` client component that wraps the dynamic import, keeping page.tsx as a pure Server Component for data fetching. This is the correct pattern for Next.js 16+ and maintains the planned architecture.
- **Serialized types in src/types/index.ts:** Placed SerializedCard/SerializedColumn in the shared types file rather than in page.tsx, preventing the anti-pattern of client components importing from Server Component files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js 16 disallows ssr:false in Server Components**
- **Found during:** Task 3 (page.tsx wiring)
- **Issue:** `next build` failed with "ssr: false is not allowed with next/dynamic in Server Components"
- **Fix:** Created `BoardLoader.tsx` client wrapper that handles the `dynamic(() => import(...), { ssr: false })` call, and page.tsx imports BoardLoader directly instead
- **Files modified:** src/components/board/BoardLoader.tsx (created), src/app/page.tsx (updated)
- **Verification:** `next build` succeeds with zero errors
- **Committed in:** `e5c27d9` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for Next.js 16 compatibility. No scope creep. The architectural intent (no SSR for the board tree) is preserved exactly as planned.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Board shell renders real data from the database, ready for CRUD operations (Phase 3)
- Server/Client boundary is clean: page.tsx handles data fetching, client components handle rendering
- The `ssr: false` pattern via BoardLoader is ready for Phase 4 drag-and-drop (browser-only APIs)
- Component structure supports adding interaction handlers in future phases

## Self-Check: PASSED

- All 11 files verified present on disk
- All 3 task commits verified in git log (5d624b7, bbba2fe, e5c27d9)
- `next build` exits with code 0

---
*Phase: 02-board-shell*
*Completed: 2026-02-28*
