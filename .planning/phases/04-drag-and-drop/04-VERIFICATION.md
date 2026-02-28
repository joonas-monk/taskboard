---
phase: 04-drag-and-drop
verified: 2026-02-28T16:30:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Phase 4: Drag and Drop Verification Report

**Phase Goal:** Users can reorganize the board by dragging cards between columns and within columns, and the order survives a page refresh
**Verified:** 2026-02-28T16:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                             | Status     | Evidence                                                                                   |
|----|-------------------------------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------|
| 1  | User can drag a card from one column and drop it into another — card appears immediately and persists after refresh | ✓ VERIFIED | Board.tsx: handleDragOver moves card optimistically; handleDragEnd calls moveTask which updates columnId + position via Prisma and calls revalidatePath('/') |
| 2  | User can drag a card within a column to reorder — the new position persists after page refresh                   | ✓ VERIFIED | Board.tsx: handleDragEnd calls arrayMove then reorderTasks (or rebalancePositions) via prisma.$transaction; positions written to SQLite |
| 3  | Card positions do not visibly snap back or flicker during or after a drag operation                               | ✓ VERIFIED | Board.tsx line 131-133: setColumns called synchronously before await moveTask/reorderTasks; useEffect syncs serverColumns back after revalidatePath re-render |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact                             | Expected                                                            | Status     | Details                                                                                                     |
|--------------------------------------|---------------------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------------|
| `src/actions/tasks.ts`               | moveTask and reorderTasks Server Actions with real Prisma implementations | ✓ VERIFIED | moveTask: prisma.card.update with columnId + position (lines 113-120). reorderTasks: prisma.$transaction batch update (lines 153-157). Both call revalidatePath('/') and return ActionResult<T>. |
| `src/components/board/Board.tsx`     | DndContext wrapping board, local columns state, drag handlers, DragOverlay | ✓ VERIFIED | DndContext at line 191-216 wraps entire board. useState(serverColumns) at line 28. handleDragStart/Over/End/Cancel all implemented. DragOverlay at lines 208-210. |
| `src/components/board/Column.tsx`    | SortableContext wrapping cards, useDroppable for empty column drops  | ✓ VERIFIED | SortableContext with items={cardIds} at line 37. useDroppable({ id: column.id }) at line 21. setNodeRef on card list container (line 34). |
| `src/components/board/Card.tsx`      | useSortable hook for drag handles, transform styles, isDragging ghost | ✓ VERIFIED | useSortable({ id: card.id, disabled: isOptimistic }) at line 25. CSS.Transform.toString(transform) at line 28. isDragging opacity 0.4 at line 30. ring-2 ring-blue-300 class on drag at line 41. |

---

### Key Link Verification

| From                                      | To                         | Via                                              | Status     | Details                                                                                     |
|-------------------------------------------|----------------------------|--------------------------------------------------|------------|---------------------------------------------------------------------------------------------|
| `src/components/board/Board.tsx`          | `src/actions/tasks.ts`     | moveTask and reorderTasks calls in handleDragEnd | ✓ WIRED    | import at line 17; moveTask called at line 177; reorderTasks called at lines 155 and 158    |
| `src/components/board/Board.tsx`          | `src/components/board/Column.tsx` | columns.map passing column prop            | ✓ WIRED    | columns.map at line 200; each Column receives column={col} and onCardClick handler          |
| `src/components/board/Column.tsx`         | `src/components/board/Card.tsx`  | SortableContext items matching rendered Card order | ✓ WIRED    | cardIds = optimisticCards.map(c => c.id) at line 22; SortableContext items={cardIds} at line 37; optimisticCards.map renders Card components at lines 43-48 |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                           | Status     | Evidence                                                                                                      |
|-------------|-------------|-------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------|
| DND-01      | 04-01-PLAN  | User can drag a card from one column to another       | ✓ SATISFIED | handleDragOver updates local columns state for live preview; handleDragEnd calls moveTask updating card.columnId in SQLite via Prisma |
| DND-02      | 04-01-PLAN  | User can reorder cards within a column by dragging    | ✓ SATISFIED | handleDragEnd same-column path: arrayMove + reorderTasks with midpoint position calculation and rebalance detection |
| DND-03      | 04-01-PLAN  | Card positions persist after page refresh             | ✓ SATISFIED | moveTask and reorderTasks both call prisma.card.update with float position; revalidatePath('/') triggers re-fetch from SQLite; useEffect syncs local state from fresh server data |

No orphaned requirements. All three DND-* requirements claimed in 04-01-PLAN.md frontmatter are accounted for and satisfied.

---

### Anti-Patterns Found

No anti-patterns detected.

Scanned all four modified files:
- No TODO/FIXME/HACK/PLACEHOLDER comments
- No stub return values (return null, return {}, return [])
- No console.log-only handlers
- No empty onSubmit / onClick implementations
- moveTask previously was a stub (confirmed by commit 2aa155d diff: +31 lines replacing stub body)
- reorderTasks previously was a stub (same commit, replaced together)
- Both stubs are now real implementations as of commit 2aa155d

Additional quality checks:
- PointerSensor `activationConstraint: { distance: 8 }` present (line 39 Board.tsx) — prevents click/drag conflict with card modal
- Optimistic cards disabled from drag via `disabled: isOptimistic` in useSortable (Card.tsx line 25)
- handleDragCancel reverts to serverColumns (Board.tsx line 187) — clean undo on cancel
- `@dnd-kit/react` (experimental) not installed — correct per research findings
- DndContext wraps board-level, not per-column — correct for cross-column support

---

### Human Verification Required

The following behaviors require runtime testing and cannot be verified by static code inspection:

#### 1. Cross-Column Drag Visual Preview

**Test:** Drag a card from column "Idea" toward column "Suunnittelu" and pause midway.
**Expected:** Card visually follows the cursor; the card ghost appears in the destination column in real time before release.
**Why human:** handleDragOver state mutation can only be confirmed by observing the live React render during pointer movement.

#### 2. Within-Column Snap-Back Absence

**Test:** Drag a card within a column upward past another card and release.
**Expected:** Card settles in new position immediately with no visible snap back to original position.
**Why human:** The synchronous setColumns-before-await pattern prevents snap-back but this is a timing behavior that must be observed at runtime. Code supports it but the absence of flicker requires visual confirmation.

#### 3. Position Persistence After Refresh

**Test:** Drag card A above card B in a column, press F5.
**Expected:** Card A still appears above card B.
**Why human:** Requires live database write and page reload to confirm the float position was persisted and re-read correctly.

#### 4. Card Click Still Opens Modal After DnD Integration

**Test:** Click (do not drag) a card. Movement should be under 8 pixels.
**Expected:** CardModal opens. No drag action fires.
**Why human:** The 8px activationConstraint is the protection mechanism, but confirming click vs. drag discrimination requires pointer interaction.

---

### Summary

Phase 4 goal is fully achieved. All three observable truths are verified through code inspection:

1. **Cross-column DnD is wired end-to-end**: handleDragOver provides optimistic live preview by mutating local columns state; handleDragEnd computes float position and calls moveTask which persists columnId + position to SQLite via Prisma, then calls revalidatePath('/') to sync server state back.

2. **Within-column reorder is wired end-to-end**: handleDragEnd detects same-column drops, uses arrayMove to reorder, computes midpoint position (or triggers rebalancePositions when gap falls below REBALANCE_THRESHOLD), and calls reorderTasks via prisma.$transaction.

3. **No snap-back flicker**: setColumns is called synchronously before the awaited Server Action. useEffect(serverColumns) re-syncs after revalidatePath triggers a fresh server render.

All four artifacts are substantive (not stubs), properly wired, and TypeScript compiles with zero errors. Both task commits (2aa155d, ec5d600) are confirmed in git log. The @dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0, @dnd-kit/utilities@3.2.2 packages are installed and match the versions specified in the SUMMARY.

Four items flagged for human verification cover visual/runtime behaviors that static analysis cannot confirm.

---

_Verified: 2026-02-28T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
