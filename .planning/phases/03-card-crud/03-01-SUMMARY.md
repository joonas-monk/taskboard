---
phase: 03-card-crud
plan: 01
subsystem: ui
tags: [react, nextjs, prisma, server-actions, optimistic-ui, dialog, crud, finnish-locale]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "Prisma schema, getBoard() query, CardWithLabels/ColumnWithCards types, Zod schemas"
  - phase: 02-board-shell
    provides: "Board/Column/Card components, BoardLoader, SerializedCard/SerializedColumn types, page.tsx with data fetching"
provides:
  - "createTask, updateTask, deleteTask Server Actions with real Prisma operations"
  - "getLabels() query for fetching all labels"
  - "AddCardForm component for inline card creation with optimistic UI"
  - "CardModal component with native dialog for editing and deleting cards"
  - "Full CRUD flow: create in any column, edit all fields in modal, delete with confirmation"
affects: [04-drag-drop, 05-deployment, 06-archive]

# Tech tracking
tech-stack:
  added: []
  patterns: [useOptimistic-for-list-append, useActionState-with-form, native-dialog-showModal, deleteMany-create-explicit-m2n, inline-delete-confirmation]

key-files:
  created:
    - src/components/board/AddCardForm.tsx
    - src/components/board/CardModal.tsx
  modified:
    - src/actions/tasks.ts
    - src/components/board/Card.tsx
    - src/components/board/Column.tsx
    - src/components/board/Board.tsx
    - src/components/board/BoardLoader.tsx
    - src/app/page.tsx

key-decisions:
  - "Inline delete confirmation pattern instead of window.confirm for polished UX"
  - "Labels fetched via separate getLabels() query with Promise.all in page.tsx, not merged into getBoard()"
  - "Single CardModal rendered at Board level, not per-Column, for clean DOM"

patterns-established:
  - "Optimistic list append: useOptimistic in parent + onOptimisticAdd callback to child form"
  - "Server Action form: useActionState with form action for edit, useTransition for delete"
  - "Native dialog lifecycle: useEffect syncs showModal/close with prop, onClose on dialog fires on Escape"
  - "Explicit M:N label sync: deleteMany + create in single Prisma update (not set)"
  - "Labels prop flow: page.tsx -> BoardLoader -> Board -> CardModal (not through Column)"

requirements-completed: [CARD-01, CARD-02, CARD-03, CARD-04]

# Metrics
duration: 6min
completed: 2026-02-28
---

# Phase 3 Plan 1: Card CRUD Summary

**Full card CRUD with optimistic inline creation, native dialog modal for editing all fields (title, description, priority, due date, labels), inline delete confirmation, and three Server Actions backed by Prisma with explicit M:N label sync**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T12:39:10Z
- **Completed:** 2026-02-28T12:45:24Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Implemented three Server Actions (createTask, updateTask, deleteTask) with Prisma operations, position calculation, and label management via deleteMany+create pattern
- Built AddCardForm with optimistic card creation using useOptimistic and useTransition for instant feedback
- Built CardModal with native HTML dialog, useActionState for form editing, and inline delete confirmation with pending states
- Wired full prop chain from page.tsx through BoardLoader, Board, Column, Card with labels flowing to CardModal

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement Server Actions and getLabels query** - `03622aa` (feat)
2. **Task 2: Build AddCardForm and CardModal components** - `5c5638b` (feat)
3. **Task 3: Wire components together** - `0e5806f` (feat)

## Files Created/Modified
- `src/actions/tasks.ts` - Filled in createTask, updateTask, deleteTask stubs with Prisma operations; added getLabels() query
- `src/components/board/AddCardForm.tsx` - New: inline quick-add form with optimistic creation
- `src/components/board/CardModal.tsx` - New: native dialog modal with edit form, label checkboxes, inline delete confirmation
- `src/components/board/Card.tsx` - Added onClick prop, keyboard accessibility, optimistic opacity state
- `src/components/board/Column.tsx` - Added useOptimistic cards list, AddCardForm, onCardClick callback
- `src/components/board/Board.tsx` - Added selectedCard state, CardModal rendering, labels prop
- `src/components/board/BoardLoader.tsx` - Added labels prop pass-through
- `src/app/page.tsx` - Added getLabels() fetch with Promise.all, labels passed to BoardLoader

## Decisions Made
- **Inline delete confirmation** instead of window.confirm: The plan specified an inline confirm pattern with "Vahvista poisto" / "Peruuta" buttons, providing a more polished UX than a browser dialog while keeping the confirmation step clear.
- **Separate getLabels() query**: Labels fetched independently from getBoard() via Promise.all in page.tsx, keeping concerns separated and making labels available for future label management without coupling to board data.
- **Single CardModal at Board level**: One CardModal instance in the DOM driven by selectedCard state, rather than per-Column modals. Cleaner DOM, simpler state management, labels prop flows directly without going through Column.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full CRUD operations work end-to-end, ready for Phase 4 drag-and-drop
- Card component has onClick handler infrastructure ready for drag-and-drop event integration
- Position-based ordering is established (positionAfterLast for appending) ready for reorder operations
- Column's useOptimistic pattern can be extended for drag-and-drop optimistic reordering

## Self-Check: PASSED

- All 8 files verified present on disk
- All 3 task commits verified in git log (03622aa, 5c5638b, 0e5806f)
- `next build` exits with code 0

---
*Phase: 03-card-crud*
*Completed: 2026-02-28*
