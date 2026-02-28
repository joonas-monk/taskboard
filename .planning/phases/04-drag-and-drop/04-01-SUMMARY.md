---
phase: 04-drag-and-drop
plan: 01
subsystem: ui
tags: [dnd-kit, drag-and-drop, kanban, react, prisma, server-actions]

# Dependency graph
requires:
  - phase: 03-card-crud
    provides: Card CRUD with Server Actions, SerializedCard/SerializedColumn types, float position utilities
provides:
  - Drag-and-drop card movement between columns with float-based position persistence
  - Within-column card reordering with midpoint insertion and rebalance detection
  - Flicker-free optimistic UI via synchronous local columns state updates
  - moveTask and reorderTasks Server Actions with real Prisma implementations
affects:
  - 05-labels-filters (uses Board.tsx drag context)
  - 06-deployment (bundle size increased by ~20KB for dnd-kit)

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/core@6.3.1"
    - "@dnd-kit/sortable@10.0.0"
    - "@dnd-kit/utilities@3.2.2"
  patterns:
    - DndContext wraps entire board (not individual columns) to enable cross-column drops
    - PointerSensor with activationConstraint.distance=8 prevents click/drag conflicts
    - handleDragOver updates local columns state for live cross-column preview
    - handleDragEnd uses synchronous setColumns before async Server Action to prevent snap-back
    - useEffect syncs local columns state from serverColumns after revalidatePath re-render

key-files:
  created: []
  modified:
    - src/actions/tasks.ts
    - src/components/board/Board.tsx
    - src/components/board/Column.tsx
    - src/components/board/Card.tsx

key-decisions:
  - "Use @dnd-kit/core 6.x + @dnd-kit/sortable 10.x, NOT @dnd-kit/react (experimental, buggy source===target)"
  - "DndContext wraps the full board, not per-column, to support cross-column drags"
  - "PointerSensor activationConstraint distance=8px: allows card clicks to open modal without triggering drag"
  - "Local columns state (useState) updated synchronously in handleDragEnd before awaiting Server Action — prevents snap-back flicker"
  - "useEffect(serverColumns) syncs local state after revalidatePath triggers server re-render"
  - "handleDragOver moves card between column arrays for live cross-column preview during drag"

patterns-established:
  - "DnD state pattern: local useState mirrors server data; optimistic updates before async calls"
  - "Cross-column detection: over.data.current?.sortable?.containerId falls back to overId (column droppable)"
  - "Rebalance check: needsRebalance(gap) triggers full column rebalancePositions() instead of single midpoint update"

requirements-completed: [DND-01, DND-02, DND-03]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 4 Plan 1: Drag-and-Drop Card Movement Summary

**dnd-kit drag-and-drop with cross-column moves, within-column reorder, float position persistence, and flicker-free optimistic UI via synchronous local state**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T14:12:56Z
- **Completed:** 2026-02-28T14:14:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities and replaced moveTask + reorderTasks stubs with real Prisma implementations
- Board.tsx upgraded to drag orchestrator: DndContext, local columns state, four drag handlers, DragOverlay for preview
- Column.tsx wraps cards in SortableContext + useDroppable so empty columns accept drops
- Card.tsx integrates useSortable hook with transform/transition styles and isDragging ghost (opacity 0.4)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dnd-kit and implement moveTask + reorderTasks Server Actions** - `2aa155d` (feat)
2. **Task 2: Wire dnd-kit into Board, Column, and Card components** - `ec5d600` (feat)

## Files Created/Modified
- `src/actions/tasks.ts` - Replaced moveTask + reorderTasks stubs with real Prisma implementations using $transaction
- `src/components/board/Board.tsx` - DndContext orchestrator with sensors, local state, drag handlers, DragOverlay
- `src/components/board/Column.tsx` - SortableContext (verticalListSortingStrategy) + useDroppable for empty column drops
- `src/components/board/Card.tsx` - useSortable hook with CSS.Transform, transition, isDragging ghost, disabled for optimistic cards

## Decisions Made
- Used @dnd-kit/core 6.x (not @dnd-kit/react) per research findings about experimental instability
- DndContext wraps entire board (not columns) to support cross-column drags
- PointerSensor with 8px activationConstraint prevents drag from hijacking card modal clicks
- Local columns state updated synchronously before awaiting Server Action to prevent snap-back flicker
- useEffect syncs local state from serverColumns prop after revalidatePath triggers re-render

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compiled cleanly on first attempt both tasks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Drag-and-drop fully operational: cards move between columns and reorder within columns
- Positions persist to SQLite via float-based midpoint insertion with rebalance detection
- Card modal still accessible (8px drag activation constraint)
- Ready for Phase 5: labels, filters, or Phase 6: deployment

## Self-Check: PASSED

- All 4 modified files exist on disk
- Both task commits confirmed in git log (2aa155d, ec5d600)
- TypeScript compiles with zero errors

---
*Phase: 04-drag-and-drop*
*Completed: 2026-02-28*
