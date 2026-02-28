# Phase 4: Drag and Drop - Research

**Researched:** 2026-02-28
**Domain:** React drag-and-drop with dnd-kit, multi-column Kanban, float-based position persistence, Next.js Server Actions
**Confidence:** HIGH

## Summary

Phase 4 implements drag-and-drop reordering for a Kanban board built on Next.js 16, React 19, and Prisma/SQLite. Cards must move within columns (reorder) and between columns (move), with positions persisted in the database as float values after each drop.

The standard library for this use case in 2025 is **@dnd-kit/core** (v6.3.1) with **@dnd-kit/sortable** (v10.0.0). Both react-beautiful-dnd (deprecated 2022) and its hello-pangea fork are ruled out for new projects. Pragmatic Drag and Drop (Atlassian) is a valid alternative but requires more hand-rolled UI wiring; dnd-kit's sortable preset maps more naturally onto the existing Column/Card component structure.

The critical implementation challenge for this project is preventing the "snap-back flicker" that occurs when async Server Actions are used for persistence. The solution is a local `useState` in Board.tsx that owns the drag-resolved column/card order, updated synchronously on drop, with Server Actions called asynchronously afterward. `revalidatePath('/')` then reconciles the server-authoritative state with the local state transparently. The project's existing float position utilities (`midpoint`, `positionAfterLast`, `rebalancePositions`) in `src/lib/positions.ts` are already suited for computing positions on the client during `onDragEnd`.

**Primary recommendation:** Use `@dnd-kit/core` + `@dnd-kit/sortable` with a local `useState` columns array in Board.tsx for drag state, call `moveTask` / `reorderTasks` Server Actions after drop, and use `DragOverlay` to prevent cross-column visual glitches.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DND-01 | User can drag a card from one column to another | Cross-container sortable pattern: multiple `SortableContext` under shared `DndContext`, `onDragOver` for live preview, `onDragEnd` calls `moveTask` Server Action |
| DND-02 | User can reorder cards within a column by dragging | Single-container sortable: `arrayMove` + `reorderTasks` Server Action with float positions calculated via `midpoint()` from `positions.ts` |
| DND-03 | Card positions persist after page refresh | Float `position` field already in Prisma schema; `moveTask` and `reorderTasks` Server Actions (currently stubs) need full implementations that write positions to SQLite via Prisma |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | DnD context, sensors, collision detection, DragOverlay | Most widely adopted React DnD library post-react-beautiful-dnd deprecation; hooks-based, accessible, ~10 kB |
| @dnd-kit/sortable | 10.0.0 | Sortable preset: `useSortable`, `SortableContext`, `arrayMove` | Abstracts sort index math; handles same-container and cross-container use cases |
| @dnd-kit/utilities | 3.2.2 | `CSS.Transform.toString()` helper | Required to convert dnd-kit transform object to CSS string |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed beyond core) | - | - | No additional packages required for this scope |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/core | @hello-pangea/dnd | hello-pangea is opinionated (vertical/horizontal lists only), simpler setup but less control over position calculation and overlay behavior |
| @dnd-kit/core | pragmatic-drag-and-drop | Headless, built on HTML5 DnD API; more boilerplate, no built-in sortable preset |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. Changes are confined to existing files plus one new hook:

```
src/
├── actions/
│   └── tasks.ts              # Implement moveTask + reorderTasks stubs
├── components/board/
│   ├── Board.tsx              # Add DndContext, local columns state, handlers
│   ├── Column.tsx             # Wrap cards in SortableContext, use useDroppable
│   └── Card.tsx               # Add useSortable hook
└── lib/
    └── positions.ts           # Already implemented — use midpoint(), rebalancePositions()
```

### Pattern 1: DndContext at Board Level

**What:** `DndContext` wraps the entire board. All columns and cards interact through one shared drag context. `DragOverlay` renders inside `DndContext`, outside all columns.

**When to use:** Always for multi-column Kanban. A single `DndContext` enables cross-column drag detection. Multiple `DndContext` instances would isolate columns and prevent cross-column drops.

**Example:**
```typescript
// Source: https://dndkit.com/presets/sortable (verified)
// Board.tsx (simplified)
'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  MouseSensor,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@dnd-kit/core'

export default function Board({ columns: initialColumns, labels }) {
  const [columns, setColumns] = useState(initialColumns)
  const [activeCard, setActiveCard] = useState<SerializedCard | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart(event: DragStartEvent) {
    // find card by event.active.id, set activeCard for DragOverlay
  }

  function handleDragOver(event: DragOverEvent) {
    // live cross-column preview: move card between column arrays in local state
  }

  function handleDragEnd(event: DragEndEvent) {
    // finalize position, call Server Action, clear activeCard
  }

  function handleDragCancel() {
    setColumns(initialColumns) // revert to server state on cancel
    setActiveCard(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-screen overflow-x-auto ...">
        {columns.map(col => (
          <Column key={col.id} column={col} onCardClick={...} />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <Card card={activeCard} /> : null}
      </DragOverlay>
      <CardModal ... />
    </DndContext>
  )
}
```

### Pattern 2: Local Column State for Flicker-Free Optimistic DnD

**What:** Board.tsx holds a `columns` state initialized from server props. This state is mutated synchronously on drop events. Server Actions are called asynchronously after state is already updated. This prevents the snap-back flicker.

**Why it matters:** React 19's `useOptimistic` is designed for async transitions. dnd-kit clears its internal transform synchronously at drop. If you rely solely on `useOptimistic` or server re-validation for the post-drop render, there is a one-frame gap where dnd-kit has cleared its transform but React hasn't rendered the new order yet — producing a visible snap-back.

**The fix:** Update `columns` state synchronously in `onDragEnd` before (or without waiting for) the Server Action. `revalidatePath('/')` fires in the background; when the RSC re-renders, columns from the server match the optimistic state, so no visible change occurs.

```typescript
// onDragEnd handler (Board.tsx)
async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  setActiveCard(null)

  if (!over) return

  const activeCardId = active.id as string
  const overId = over.id as string

  // Determine source and destination column IDs
  const sourceColId = active.data.current?.sortable?.containerId as string
  const destColId = over.data.current?.sortable?.containerId ?? overId

  if (sourceColId === destColId) {
    // Within-column reorder: use arrayMove to reorder cards
    setColumns(prev =>
      prev.map(col => {
        if (col.id !== sourceColId) return col
        const ids = col.cards.map(c => c.id)
        const oldIdx = ids.indexOf(activeCardId)
        const newIdx = ids.indexOf(overId)
        if (oldIdx === newIdx) return col
        const reordered = arrayMove(col.cards, oldIdx, newIdx)
        return { ...col, cards: reordered }
      })
    )
    // Call Server Action asynchronously
    // Compute float positions for moved cards using midpoint()
    // await reorderTasks(updates)
  } else {
    // Cross-column: card was already moved optimistically in onDragOver
    // Call moveTask with target column and computed float position
    // await moveTask({ id: activeCardId, targetColumnId: destColId, position: newPosition })
  }
}
```

### Pattern 3: Cross-Column Live Preview via onDragOver

**What:** When a card is dragged over a different column (detected by comparing `active.data.current?.sortable?.containerId` vs the over element's container), the card is moved between the column arrays immediately in local state to show a preview.

**When to use:** Always for cross-column drag. Without this, the card only visually moves via the DragOverlay; the column contents don't shift until drop.

```typescript
function handleDragOver(event: DragOverEvent) {
  const { active, over } = event
  if (!over) return

  const activeColId = active.data.current?.sortable?.containerId as string
  const overColId = over.data.current?.sortable?.containerId ?? over.id as string

  if (activeColId === overColId) return // same column, no preview needed

  setColumns(prev => {
    const activeCard = prev
      .find(c => c.id === activeColId)?.cards
      .find(c => c.id === active.id)
    if (!activeCard) return prev

    return prev.map(col => {
      if (col.id === activeColId) {
        return { ...col, cards: col.cards.filter(c => c.id !== active.id) }
      }
      if (col.id === overColId) {
        const overIdx = col.cards.findIndex(c => c.id === over.id)
        const insertAt = overIdx >= 0 ? overIdx : col.cards.length
        const newCards = [...col.cards]
        newCards.splice(insertAt, 0, activeCard)
        return { ...col, cards: newCards }
      }
      return col
    })
  })
}
```

### Pattern 4: useSortable in Card Component

**What:** Each Card becomes sortable by adding `useSortable`. The hook provides `setNodeRef`, `attributes`, `listeners`, `transform`, `transition`, and `isDragging`.

**When to use:** For every card rendered inside a `SortableContext`.

```typescript
// Source: https://dndkit.com/presets/sortable (verified)
// Card.tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function Card({ card, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1, // ghost at source during drag
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={!card.id.startsWith('optimistic-') ? onClick : undefined}
      // ...existing classes
    >
      {/* existing card content */}
    </div>
  )
}
```

### Pattern 5: SortableContext in Column Component

**What:** Each Column wraps its card list in `SortableContext` with the sorted card ID array and `verticalListSortingStrategy`.

```typescript
// Column.tsx
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

export default function Column({ column, onCardClick }: Props) {
  const { setNodeRef } = useDroppable({ id: column.id })
  const cardIds = column.cards.map(c => c.id)

  return (
    <div className="...">
      <div className="...header...">{column.name}</div>
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map(card => (
            <Card key={card.id} card={card} onClick={...} />
          ))}
        </SortableContext>
      </div>
      <AddCardForm ... />
    </div>
  )
}
```

### Pattern 6: Float Position Calculation in onDragEnd

**What:** After determining the new array order, compute float positions for the affected cards using the existing utilities in `src/lib/positions.ts`.

**For within-column reorder:** Only the moved card's position changes; use `midpoint()` between its neighbors in the reordered array. If gap is below `REBALANCE_THRESHOLD`, call `rebalancePositions()` and update all cards.

**For cross-column move:** Card is inserted at a specific index in the destination column. Compute position as `midpoint(prevCard.position, nextCard.position)`. If destination is empty, use `positionAfterLast(0)` = 1000.

```typescript
// Example: compute position for card dropped at index `newIdx` in column `col`
function computeNewPosition(col: SerializedColumn, newIdx: number): number {
  const prev = col.cards[newIdx - 1]?.position ?? 0
  const next = col.cards[newIdx + 1]?.position
  if (next === undefined) return positionAfterLast(prev)
  return midpoint(prev, next)
}
```

### Anti-Patterns to Avoid

- **Placing DndContext inside Column:** Prevents cross-column drag. DndContext must be an ancestor of all draggable/droppable components.
- **Relying solely on revalidatePath for post-drop render:** Server re-validation is async; causes one-frame snap-back. Always update local `columns` state synchronously first.
- **Rendering DragOverlay conditionally at the outer level:** `<DragOverlay>` must remain mounted at all times for drop animations to work. Put the condition inside: `<DragOverlay>{activeCard ? <Card card={activeCard}/> : null}</DragOverlay>`.
- **Passing `column.cards` (server prop) directly as SortableContext items:** Use the local `columns` state so live-preview updates during `onDragOver` are reflected.
- **Not using PointerSensor with `activationConstraint: { distance: 8 }`:** Without a distance constraint, clicking a card opens the drag handler before the click event fires, breaking the card modal click handler.
- **Using `@dnd-kit/react` (the new experimental API):** Version 0.3.x is still pre-stable and has known issues where `source` and `target` in `onDragEnd` are always identical. Use the stable `@dnd-kit/core` 6.x API.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag event lifecycle | Custom mouse/touch event handlers | `DndContext` with sensors | Touch, pointer coalescing, keyboard, accessibility—dozens of edge cases |
| Sort order within a list | Custom index-swap logic | `arrayMove` from `@dnd-kit/sortable` | Handles edge cases: dragging to end, dragging to same index |
| Drag visual | CSS `position: fixed` + `mousemove` | `DragOverlay` | Handles viewport scroll, overflow containers, portal rendering |
| Collision detection | Custom geometry math | `closestCorners` from `@dnd-kit/core` | Handles overlapping droppables correctly for stacked Kanban columns |
| Sensor initialization | Raw pointer events | `useSensors` + `PointerSensor` / `KeyboardSensor` | Cross-browser, handles start/cancel/end lifecycle |

**Key insight:** dnd-kit's sortable preset handles ~80% of Kanban DnD complexity. The project's main custom work is: (1) computing float positions for Prisma updates, (2) integrating with Server Actions.

---

## Common Pitfalls

### Pitfall 1: Snap-Back Flicker on Drop
**What goes wrong:** Card visually returns to its original position for 1-2 frames immediately after drop.
**Why it happens:** dnd-kit clears its CSS `transform` synchronously when `onDragEnd` fires. If the component's rendered order is still from the server (not yet updated), React renders the old order briefly.
**How to avoid:** Maintain a local `columns` state in Board.tsx that is updated synchronously inside `onDragEnd` before the Server Action is called. The Server Action's `revalidatePath` will then re-render from server data that matches the local state.
**Warning signs:** Card snaps back to original column for one frame, then moves to new column.

### Pitfall 2: Click Handler Conflict with Drag Handler
**What goes wrong:** Clicking a card immediately starts a drag instead of opening the modal, or clicking never fires because drag starts too quickly.
**Why it happens:** `useSortable` attaches `listeners` (which include `onPointerDown`) to the card element. If the card also has an `onClick`, the pointer events interfere.
**How to avoid:** Use `PointerSensor` with `activationConstraint: { distance: 8 }`. This requires the pointer to move at least 8px before initiating drag, allowing clicks to register normally. Alternatively, use a dedicated drag handle (a grab icon element) and only attach `listeners` to that element.
**Warning signs:** Modal doesn't open when clicking cards; or dragging starts on any touch.

### Pitfall 3: SortableContext items Out of Sync with Rendered Cards
**What goes wrong:** dnd-kit shows incorrect sort ghost positions or cross-column preview doesn't work.
**Why it happens:** `SortableContext items={cardIds}` must be in the same order as the rendered cards, and must reflect the live-preview state during drag. If Column.tsx reads `column.cards` from the original server prop instead of the local `columns` state passed down, the live preview from `onDragOver` won't be reflected.
**How to avoid:** Board.tsx owns the `columns` state; pass the updated column (with live-preview cards) down to Column.tsx as props. Column renders `column.cards` from props, which are always current.
**Warning signs:** Ghost card appears in wrong position; drop zone doesn't show where card will land.

### Pitfall 4: Float Position Exhaustion
**What goes wrong:** After many reorders, the gap between adjacent cards' positions shrinks below `REBALANCE_THRESHOLD` (0.001), causing `midpoint()` to return the same value as one of the neighbors.
**Why it happens:** Floating-point midpoint repeatedly halves the gap.
**How to avoid:** Check `needsRebalance(gap)` after computing `midpoint()`. If true, rebalance all cards in the column using `rebalancePositions(count)` and include all position updates in the Server Action call.
**Warning signs:** Cards stop moving to expected positions after many reorders; `position` values in DB become identical.

### Pitfall 5: Adding DragOverlay Inside SortableContext
**What goes wrong:** DragOverlay may not render correctly; drop animation may fail.
**Why it happens:** DragOverlay must be a sibling of the sortable areas, not nested inside them.
**How to avoid:** Place `<DragOverlay>` directly inside `<DndContext>` but outside all `<SortableContext>` columns.
**Warning signs:** DragOverlay renders at wrong position; no drop animation.

### Pitfall 6: Using New @dnd-kit/react API (v0.3.x)
**What goes wrong:** `onDragEnd` `operation.source` and `operation.target` are always identical; can't detect where card was dropped.
**Why it happens:** Known bug in the pre-stable `@dnd-kit/react` package (different from `@dnd-kit/core`).
**How to avoid:** Use `@dnd-kit/core` (v6.3.1) + `@dnd-kit/sortable` (v10.0.0). The `@dnd-kit/react` package is an entirely different (new) API that is not production-ready.
**Warning signs:** `active.id === over.id` always, regardless of where you drop.

---

## Code Examples

Verified patterns from official sources and cross-referenced community usage:

### Sensor Configuration with Click Protection
```typescript
// Source: https://dndkit.com (official docs, verified)
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // prevents accidental drag on click
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
)
```

### useSortable Pattern
```typescript
// Source: https://dndkit.com/presets/sortable (verified)
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: card.id })

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
}
```

### arrayMove for Within-Column Reorder
```typescript
// Source: @dnd-kit/sortable (verified by npm docs)
import { arrayMove } from '@dnd-kit/sortable'

// In onDragEnd, same column:
const reordered = arrayMove(col.cards, oldIndex, newIndex)
```

### Implementing moveTask Server Action
```typescript
// tasks.ts — replace the existing stub
export async function moveTask(input: MoveTaskInput): Promise<ActionResult<CardWithLabels>> {
  const parsed = moveTaskSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) }

  try {
    const card = await prisma.card.update({
      where: { id: parsed.data.id },
      data: {
        columnId: parsed.data.targetColumnId,
        position: parsed.data.position,
      },
      include: { labels: { include: { label: true } } },
    })
    revalidatePath('/')
    return { success: true, data: card }
  } catch {
    return { success: false, error: 'Kortin siirto epaonnistui' }
  }
}
```

### Implementing reorderTasks Server Action
```typescript
// tasks.ts — replace the existing stub
export async function reorderTasks(updates: ReorderTasksInput): Promise<ActionResult<void>> {
  const parsed = reorderTasksSchema.safeParse(updates)
  if (!parsed.success) return { success: false, error: formatZodError(parsed.error) }

  try {
    await prisma.$transaction(
      parsed.data.map(({ id, position }) =>
        prisma.card.update({ where: { id }, data: { position } })
      )
    )
    revalidatePath('/')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Jarjestyksen tallennus epaonnistui' }
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/core + sortable | 2022 (deprecation) | dnd-kit is the default for new projects |
| Per-column DndContext | Single DndContext for board | - | Single context required for cross-column drag |
| Custom position integers | Float midpoint positions | This project (Phase 1) | Already done; no positional re-index needed on every reorder |
| Mutating DOM directly | DragOverlay for visual feedback | dnd-kit v4+ | Prevents layout shift and unmount/remount issues |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Deprecated by Atlassian 2022. Do not use.
- `@dnd-kit/react` v0.x: Pre-stable new API with known bugs. Use `@dnd-kit/core` 6.x instead.
- `onDragOver(id, overId)` positional params: Replaced by `onDragOver({ active, over })` in @dnd-kit/core 6.x.

---

## Open Questions

1. **Drag handle vs. full-card drag area**
   - What we know: Attaching `listeners` to the entire card div causes pointer conflicts with the modal click handler. `activationConstraint: { distance: 8 }` mitigates this for pointer devices.
   - What's unclear: Whether keyboard users will find a distance-constrained card intuitive vs. a visible grab handle.
   - Recommendation: Use `activationConstraint: { distance: 8 }` for pointer sensors (simpler implementation). The existing `onKeyDown` handler in Card.tsx (Enter opens modal) coexists with keyboard DnD since dnd-kit uses Space/Enter for drag initiation differently. Verify behavior in UAT.

2. **Rebalance strategy: client-side vs. server-side**
   - What we know: `needsRebalance()` and `rebalancePositions()` exist in `positions.ts`. The rebalance case is rare (requires many reorders of the same adjacent pair).
   - What's unclear: Whether to detect and rebalance on the client in `onDragEnd` (send all positions) or check in the Server Action and rebalance there.
   - Recommendation: Detect on client in `onDragEnd` (client knows the current order array), send all positions when rebalance is needed. Server Action already accepts `ReorderTasksInput` as an array, so this is just sending a larger payload.

3. **useOptimistic vs. local useState for Board**
   - What we know: Column.tsx currently uses `useOptimistic` for card creation (add card). Board.tsx needs a local `columns` state for drag. These are separate concerns.
   - What's unclear: Whether the existing `useOptimistic` in Column.tsx for add-card will conflict with Board-level local state.
   - Recommendation: Keep Column.tsx's `useOptimistic` for add-card (it appends to the column's optimistic state). Board.tsx's local `columns` state drives what Column receives as `column` prop. These don't conflict as long as Board.tsx initializes from server props and Column.tsx derives its `optimisticCards` from the `column.cards` prop (which it currently does).

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — only `workflow.research`, `workflow.plan_check`, and `workflow.verifier` are defined. Nyquist validation is not enabled; skipping this section.

---

## Sources

### Primary (HIGH confidence)
- [dndkit.com](https://dndkit.com) — Official dnd-kit documentation (presets/sortable, sensors, DragOverlay)
- `npm info @dnd-kit/core version` → **6.3.1** (verified locally)
- `npm info @dnd-kit/sortable version` → **10.0.0** (verified locally)
- `npm info @dnd-kit/utilities version` → **3.2.2** (verified locally)
- `/Users/harimaa/Documents/src/lib/positions.ts` — Existing position utilities (midpoint, rebalance)
- `/Users/harimaa/Documents/src/actions/tasks.ts` — moveTask and reorderTasks stubs confirmed
- `/Users/harimaa/Documents/prisma/schema.prisma` — `position Float` confirmed on Card model

### Secondary (MEDIUM confidence)
- [blog.logrocket.com/build-kanban-board-dnd-kit-react/](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/) — Kanban with dnd-kit pattern (cross-referenced with official docs)
- [radzion.com/blog/kanban/](https://radzion.com/blog/kanban/) — onDragStart/onDragOver/onDragEnd pattern, DragOverlay (cross-referenced)
- [dndkit.com/presets/sortable](https://dndkit.com/presets/sortable) — useSortable, SortableContext, arrayMove APIs
- [github.com/clauderic/dnd-kit/discussions/1522](https://github.com/clauderic/dnd-kit/discussions/1522) — Snap-back flicker diagnosis and local state solution
- [puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — Library comparison 2026 edition

### Tertiary (LOW confidence)
- GitHub issues on @dnd-kit/react v0.3.x bugs (source/target identical in onDragEnd) — community reports, not officially documented

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified locally; official docs confirm APIs
- Architecture: HIGH — cross-referenced across 3+ independent sources; aligns with existing project patterns
- Pitfalls: MEDIUM-HIGH — flicker/snap-back and click-conflict pitfalls verified by multiple GitHub issues and community posts; rebalance pitfall is from project's own code analysis

**Research date:** 2026-02-28
**Valid until:** 2026-08-28 (dnd-kit stable; 6-month estimate)
