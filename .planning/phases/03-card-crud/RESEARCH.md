# Phase 3: Card CRUD - Research

**Researched:** 2026-02-28
**Domain:** React 19 Server Actions, Next.js 16 App Router, Prisma 7 explicit many-to-many relations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from 03-CONTEXT.md)

### Locked Decisions
- "+" button at the bottom of each column — inline form: text input appears, user types title, press Enter or click to create
- Card created with default priority (MEDIUM), no due date, no labels; appears at bottom of the column (append position)
- Finnish placeholder text: "Uusi kortti..."
- Click on a card opens a modal/dialog
- Modal shows all editable fields: title, description (textarea), priority (select), due date (date input), labels (multi-select checkboxes)
- Save button persists changes, modal closes
- Description stored as plain text (markdown rendering deferred to later)
- Labels shown as checkboxes with color dots (pick from existing 4 default labels: Bugi/red, Ominaisuus/blue, Kiireinen/orange, Parannus/green)
- Delete button in the modal (not on card face)
- Confirmation dialog: "Haluatko varmasti poistaa tämän kortin?"
- Permanent delete (archive is Phase 6)
- Loading/pending indicator while save is in progress
- Error message shown if save fails
- Optimistic: card appears immediately on create, modal shows saved state

### Claude's Discretion
- Modal design and layout (Claude picks clean, functional approach)
- Whether to use a dialog element, portal, or overlay pattern
- Form validation UX (inline errors vs toast)
- How to handle the label multi-select UI
- Whether description field auto-grows or uses fixed height

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-01 | User can create a new card with title in any column | useOptimistic + useTransition + createTask Server Action + positionAfterLast() |
| CARD-02 | User can open a card in a modal to edit all fields | HTML `<dialog>` with showModal(), updateTask Server Action, useActionState for pending/error |
| CARD-03 | User can delete a card with a confirmation dialog | window.confirm() or inline confirm state, deleteTask Server Action, revalidatePath('/') |
| CARD-04 | User can write a description in plain text with markdown rendering | Plain textarea, stored as string — markdown deferred per CONTEXT.md |
</phase_requirements>

---

## Summary

This phase wires up the three Server Action stubs (`createTask`, `updateTask`, `deleteTask`) in `src/actions/tasks.ts` with real Prisma operations and connects the UI components (Column, Card) to drive them. The key technical challenges are: (1) handling the explicit many-to-many CardLabel join table correctly when updating label assignments, (2) showing optimistic UI for card creation so the card appears before the server round-trip completes, and (3) building a clean modal dialog for card editing with proper pending/error feedback.

The stack is already fully chosen: React 19 hooks (`useOptimistic`, `useTransition`, `useActionState`), native HTML `<dialog>` element (via `showModal()`), Tailwind CSS v4 for styling. No additional npm packages are needed for this phase. react-hook-form is explicitly not needed — native `<form>` + controlled state or uncontrolled `FormData` is sufficient for a modal with ~5 fields and no complex validation UX.

For label updates on an explicit many-to-many relation (Card ↔ Label via CardLabel join table), Prisma's implicit `set` operation is unavailable. The correct pattern is `deleteMany: {}` followed by a `create` of each selected label within a single `prisma.card.update()` nested write, which executes atomically.

**Primary recommendation:** Use `useOptimistic` + `useTransition` in Column for card creation, `useActionState` inside the CardModal for edit/delete with the native `<dialog>` element, and the `deleteMany + create` pattern in `updateTask` for label sync.

---

## Standard Stack

### Core (already in project — no installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | `useOptimistic`, `useTransition`, `useActionState` hooks | Project dependency |
| Next.js | 16.1.6 | Server Actions with `revalidatePath('/')` | Project framework |
| Prisma | 7.4.2 | Database ORM — `card.create`, `card.update`, `card.delete` | Project ORM |
| Tailwind CSS | v4 | Styling modal, form, buttons | Project CSS |
| Zod | 4.3.6 | Schema validation in Server Actions | Already wired in stubs |

### No Additional Installs Required
The project has no react-hook-form, no headless UI library, no portal library. The native HTML `<dialog>` element + React refs handles modal natively with zero dependencies. This is the correct choice for this project's scale.

---

## Architecture Patterns

### Recommended File Structure (new files this phase)
```
src/
├── actions/
│   └── tasks.ts          # Fill in createTask, updateTask, deleteTask stubs
├── components/
│   └── board/
│       ├── Column.tsx    # Add "+" button + inline AddCardForm
│       ├── Card.tsx      # Add onClick prop to open modal
│       ├── AddCardForm.tsx  # NEW: inline quick-add input
│       └── CardModal.tsx    # NEW: edit/delete modal dialog
```

### Pattern 1: Inline Quick-Add (Column → AddCardForm)

**What:** A "+" button at the bottom of a column reveals a text input. Pressing Enter or clicking a submit button calls `createTask`. The card appears optimistically while the server round-trip completes.

**When to use:** Card creation — lightweight, minimal UI friction.

```tsx
// src/components/board/AddCardForm.tsx
'use client'

import { useOptimistic, useTransition, useState } from 'react'
import { createTask } from '@/actions/tasks'
import type { SerializedCard } from '@/types'

interface Props {
  columnId: string
  lastPosition: number
  onOptimisticAdd: (card: SerializedCard) => void
}

export function AddCardForm({ columnId, lastPosition, onOptimisticAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const optimistic: SerializedCard = {
      id: `optimistic-${Date.now()}`,
      title: title.trim(),
      description: '',
      priority: 'MEDIUM',
      dueDate: null,
      archived: false,
      position: lastPosition + 1000,
      columnId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labels: [],
    }

    startTransition(async () => {
      onOptimisticAdd(optimistic)       // immediate UI update via useOptimistic in Column
      setTitle('')
      setOpen(false)
      const result = await createTask({ title: optimistic.title, columnId })
      if (!result.success) {
        setError(result.error)
      }
    })
  }

  // ...
}
```

**Key insight:** `onOptimisticAdd` is the `addOptimistic` setter from `useOptimistic` in Column.tsx. The optimistic card uses a temporary `id` that gets replaced when `revalidatePath('/')` triggers a server re-render.

### Pattern 2: useOptimistic in Column for Card List

**What:** Column tracks an optimistic list of cards, appending new ones immediately.

```tsx
// src/components/board/Column.tsx (additions)
'use client'

import { useOptimistic } from 'react'
import type { SerializedCard, SerializedColumn } from '@/types'

export default function Column({ column }: { column: SerializedColumn }) {
  const [optimisticCards, addOptimisticCard] = useOptimistic(
    column.cards,
    (state, newCard: SerializedCard) => [...state, newCard]
  )

  const lastPosition = column.cards.at(-1)?.position ?? 0

  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-slate-200 rounded-xl">
      {/* header */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {optimisticCards.map((card) => (
          <Card key={card.id} card={card} onClick={() => openModal(card)} />
        ))}
      </div>
      <AddCardForm
        columnId={column.id}
        lastPosition={lastPosition}
        onOptimisticAdd={addOptimisticCard}
      />
    </div>
  )
}
```

### Pattern 3: Modal with HTML `<dialog>` + `showModal()`

**What:** A native `<dialog>` element managed via a React ref and `useEffect`. `showModal()` provides built-in focus trapping, backdrop, top-layer stacking, and Escape key dismissal — all with zero dependencies.

**When to use:** Card editing. Native `<dialog>` is the correct modern choice: no z-index issues, Escape key works by default, browser handles focus return to trigger on close.

```tsx
// src/components/board/CardModal.tsx
'use client'

import { useRef, useEffect, useActionState } from 'react'
import { updateTask, deleteTask } from '@/actions/tasks'
import type { SerializedCard } from '@/types'

interface Props {
  card: SerializedCard | null   // null = closed
  labels: { id: string; name: string; color: string }[]
  onClose: () => void
}

export function CardModal({ card, labels, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync dialog open/close state with card prop
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (card) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [card])

  // Close on backdrop click (dialog native close event)
  function handleDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  const [updateState, updateAction, updatePending] = useActionState(
    async (_: unknown, formData: FormData) => {
      if (!card) return null
      const result = await updateTask({
        id: card.id,
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        priority: formData.get('priority') as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        dueDate: formData.get('dueDate') as string || null,
        labelIds: formData.getAll('labelIds') as string[],
      })
      if (result.success) onClose()
      return result
    },
    null
  )

  // ...
}
```

**IMPORTANT caveat:** `useActionState` requires `dispatchAction` to be called within a Transition. When wired to a `<form action={updateAction}>`, React handles this automatically.

### Pattern 4: Delete with Confirmation

**What:** A delete button in the modal uses the browser's `window.confirm()` for the Finnish confirmation dialog, then calls `deleteTask` via `useTransition`.

**Rationale:** `window.confirm()` is synchronous, blocking, and zero-code for the confirmation requirement. The CONTEXT.md specifies a confirmation dialog — the built-in browser dialog satisfies this. Claude's discretion allows an inline confirm state instead for a more polished UX.

```tsx
// Inside CardModal
const [deleteIsPending, startDeleteTransition] = useTransition()

function handleDelete() {
  if (!window.confirm('Haluatko varmasti poistaa tämän kortin?')) return
  startDeleteTransition(async () => {
    const result = await deleteTask(card!.id)
    if (result.success) onClose()
    else setDeleteError(result.error)
  })
}
```

**Alternative (Claude's discretion — cleaner UX):** Inline confirm state — clicking delete shows "Vahvista poisto" / "Peruuta" buttons inline in the modal, avoiding the jarring browser dialog.

### Pattern 5: Server Action Implementation

**What:** Fill in the three stubs in `src/actions/tasks.ts`.

```ts
// src/actions/tasks.ts — createTask implementation
export async function createTask(
  input: CreateTaskInput
): Promise<ActionResult<CardWithLabels>> {
  const parsed = createTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  // Calculate append position
  const last = await prisma.card.findFirst({
    where: { columnId: parsed.data.columnId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const position = positionAfterLast(last?.position ?? 0)

  const card = await prisma.card.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? '',
      priority: parsed.data.priority ?? 'MEDIUM',
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      position,
      columnId: parsed.data.columnId,
      labels: parsed.data.labelIds?.length
        ? {
            create: parsed.data.labelIds.map((labelId) => ({
              label: { connect: { id: labelId } },
            })),
          }
        : undefined,
    },
    include: { labels: { include: { label: true } } },
  })

  revalidatePath('/')
  return { success: true, data: card }
}
```

```ts
// src/actions/tasks.ts — updateTask implementation
// CRITICAL: explicit many-to-many requires deleteMany + create, NOT set
export async function updateTask(
  input: UpdateTaskInput
): Promise<ActionResult<CardWithLabels>> {
  const parsed = updateTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) }
  }

  const { id, labelIds, dueDate, ...rest } = parsed.data

  const card = await prisma.card.update({
    where: { id },
    data: {
      ...rest,
      dueDate: dueDate === undefined ? undefined : dueDate ? new Date(dueDate) : null,
      // Explicit many-to-many: deleteMany + create replaces the set() operation
      ...(labelIds !== undefined && {
        labels: {
          deleteMany: {},
          create: labelIds.map((labelId) => ({
            label: { connect: { id: labelId } },
          })),
        },
      }),
    },
    include: { labels: { include: { label: true } } },
  })

  revalidatePath('/')
  return { success: true, data: card }
}
```

```ts
// src/actions/tasks.ts — deleteTask implementation
export async function deleteTask(id: string): Promise<ActionResult<void>> {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return { success: false, error: 'Tunniste vaaditaan' }
  }

  await prisma.card.delete({ where: { id } })
  // CardLabel rows deleted automatically via onDelete: Cascade in schema
  revalidatePath('/')
  return { success: true, data: undefined }
}
```

### Pattern 6: Label Multi-Select UI

**What:** Checkboxes with a color dot indicator, one per label. Labels are loaded server-side and passed to Column/CardModal as props.

```tsx
// Inside CardModal — label section
{labels.map((label) => (
  <label key={label.id} className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      name="labelIds"
      value={label.id}
      defaultChecked={card?.labels.some(({ label: l }) => l.id === label.id)}
    />
    <span
      className="w-3 h-3 rounded-full shrink-0"
      style={{ backgroundColor: label.color }}
    />
    <span className="text-sm">{label.name}</span>
  </label>
))}
```

**Key insight:** Using `name="labelIds"` on multiple checkboxes means `formData.getAll('labelIds')` returns an array of selected label IDs. This integrates naturally with the native `<form action={updateAction}>` pattern without any JavaScript state management.

### Pattern 7: Date Handling

**What:** The `<input type="date">` always stores/submits in ISO `YYYY-MM-DD` format. The server receives a string, converts to `Date` for Prisma, and the client receives it back as an ISO string (`SerializedCard.dueDate`). For display, `DateDisplay.tsx` already uses `Intl.DateTimeFormat('fi-FI')`.

```tsx
// Date input in CardModal — controlled for pre-population
<input
  type="date"
  name="dueDate"
  defaultValue={card?.dueDate ? card.dueDate.slice(0, 10) : ''}
/>
```

`card.dueDate` is an ISO string like `"2026-03-15T00:00:00.000Z"`. `.slice(0, 10)` extracts `"2026-03-15"` which is the value format `<input type="date">` expects.

**Finnish date label:** Display the label "Eräpäivä" for the due date field. The browser's native date picker renders according to the OS locale — no custom formatting needed in the input itself.

### Anti-Patterns to Avoid

- **Don't use `set` for CardLabel relations:** `set` is for implicit many-to-many. CardLabel is explicit. Use `deleteMany: {} + create`.
- **Don't call `addOptimistic` outside `startTransition`:** This causes a warning and the state briefly reverts. Always wrap in `startTransition(async () => { addOptimistic(...); await serverAction(...) })`.
- **Don't use `dialog.show()` instead of `dialog.showModal()`:** `show()` is non-modal — no focus trapping, no backdrop. Always use `showModal()`.
- **Don't try to use `useActionState` and `useFormStatus` in the same component:** React prohibits this. Keep `useFormStatus` in a child component if needed, or use `useActionState`'s `isPending` instead.
- **Don't forget to import `revalidatePath` from `next/cache`** — not `next/navigation`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap | Custom focus trap code | Native `<dialog showModal()>` | Browser handles focus cycle, Escape, backdrop, top-layer automatically |
| Optimistic list update | Manual setState with rollback | `useOptimistic` | Automatic rollback on action failure, works with React concurrent mode |
| Pending state tracking | `useState(false)` + manual flip | `useTransition` / `useActionState` `isPending` | Atomic with the action, no race conditions |
| Label relation replace | Custom SQL or multiple round-trips | Prisma `deleteMany: {} + create` in single `update()` | Atomic nested write, single DB round-trip |
| Date serialization | Custom serialize/deserialize | `.toISOString()` + `.slice(0, 10)` | Already established in project (serializeColumn in page.tsx) |

---

## Common Pitfalls

### Pitfall 1: Explicit Many-to-Many `set` Doesn't Work
**What goes wrong:** `prisma.card.update({ data: { labels: { set: [...] } } })` throws a type error or silent failure because `labels` in the schema is the `CardLabel[]` relation (explicit join table), not a direct Label connection.
**Why it happens:** `set` is only available on implicit many-to-many relations. CardLabel has its own model with the `@@id([cardId, labelId])` compound key.
**How to avoid:** Always use `labels: { deleteMany: {}, create: labelIds.map(...) }` in `updateTask`.
**Warning signs:** TypeScript error on `set` property, or labels not updating after save.

### Pitfall 2: Optimistic Card ID Collision
**What goes wrong:** An optimistic card gets an `id` like `"optimistic-1234"`. If the user clicks on it before the server responds, `updateTask` is called with a fake ID.
**Why it happens:** `useOptimistic` shows the card immediately, but the real `id` only arrives after `revalidatePath('/')` triggers a re-render.
**How to avoid:** Make Card's `onClick` disabled (or no-op) when `card.id.startsWith('optimistic-')`. The optimistic card should be visually inert.
**Warning signs:** A 404 or Prisma `P2025` error on `updateTask` with a non-existent ID.

### Pitfall 3: Dialog Not Closing After Successful Save
**What goes wrong:** `onClose()` is called in the `useActionState` reducer, but the dialog doesn't close visually.
**Why it happens:** `useEffect` syncs `showModal/close` based on the `card` prop. If the parent state isn't updated to set `card` to null, the `useEffect` never runs `dialog.close()`.
**How to avoid:** `onClose` must set the parent's selected card state to `null`. The `useEffect` in `CardModal` then calls `dialog.close()`.

### Pitfall 4: `dueDate` Type Mismatch
**What goes wrong:** Prisma expects a `Date` object, but the Server Action receives a string from `FormData`. Prisma silently stores a wrong value or throws.
**Why it happens:** `<input type="date">` submits a string. `updateTaskSchema` defines `dueDate` as `z.string().nullable().optional()`.
**How to avoid:** In `updateTask`, convert: `dueDate ? new Date(dueDate) : null` before passing to Prisma. The schema correctly validates the string format; conversion happens in the action body.

### Pitfall 5: Labels Not Loading in Modal
**What goes wrong:** The modal opens but the label checkboxes are empty or missing.
**Why it happens:** The 4 default labels exist only in the database. They need to be fetched server-side and passed down through the component tree.
**How to avoid:** Add a `getLabels()` query in tasks.ts (or alongside `getBoard()`), fetch in `page.tsx`, serialize and pass to `BoardLoader → Board → Column → CardModal`. Alternatively, pass labels alongside column data from `getBoard()` — but that's unnecessary duplication. Simpler: fetch labels once in `page.tsx` and pass as a prop.

### Pitfall 6: Missing `cascade` on CardLabel Delete
**What goes wrong:** `prisma.card.delete()` throws a foreign key constraint error because CardLabel rows still reference the card.
**Why it happens:** Without `onDelete: Cascade`, Prisma/SQLite blocks the delete.
**How to avoid:** The schema already has `onDelete: Cascade` on both CardLabel relations — confirmed in schema.prisma. `deleteTask` can call `prisma.card.delete()` directly without manually deleting CardLabel rows first.

---

## Code Examples

### Verified Pattern: useActionState with Server Action (source: react.dev official docs)

```tsx
'use client'
import { useActionState } from 'react'
import { updateTask } from '@/actions/tasks'

// State is null initially; becomes ActionResult<CardWithLabels> after first submit
const [state, formAction, isPending] = useActionState(
  async (_prevState: unknown, formData: FormData) => {
    return await updateTask({
      id: formData.get('id') as string,
      title: formData.get('title') as string,
      // ...
    })
  },
  null
)

// Wire to form:
<form action={formAction}>
  <button type="submit" disabled={isPending}>
    {isPending ? 'Tallennetaan...' : 'Tallenna'}
  </button>
  {state && !state.success && (
    <p className="text-red-600 text-sm">{state.error}</p>
  )}
</form>
```

### Verified Pattern: useOptimistic for card list (source: react.dev official docs)

```tsx
const [optimisticCards, addOptimisticCard] = useOptimistic(
  column.cards,
  (current: SerializedCard[], newCard: SerializedCard) => [...current, newCard]
)

// In AddCardForm:
startTransition(async () => {
  addOptimisticCard(optimisticCard)          // instant
  const result = await createTask(input)    // server round-trip
  if (!result.success) setError(result.error)
  // on success: revalidatePath('/') replaces optimistic with real data
})
```

### Verified Pattern: dialog showModal/close via useEffect (source: MDN + CSS-Tricks)

```tsx
const dialogRef = useRef<HTMLDialogElement>(null)

useEffect(() => {
  const dialog = dialogRef.current
  if (!dialog) return
  if (isOpen) {
    if (!dialog.open) dialog.showModal()  // guard: don't call if already open
  } else {
    if (dialog.open) dialog.close()
  }
}, [isOpen])

<dialog
  ref={dialogRef}
  onClose={onClose}          // fires on Escape key or dialog.close()
  onClick={(e) => {
    if (e.target === dialogRef.current) onClose()  // backdrop click
  }}
  className="rounded-xl p-0 shadow-xl backdrop:bg-black/40 max-w-lg w-full"
>
  {/* content */}
</dialog>
```

### Verified Pattern: Prisma explicit M:N replace (source: Prisma GitHub Discussion #10048)

```ts
// Replace ALL labels for a card in one atomic update
await prisma.card.update({
  where: { id: cardId },
  data: {
    labels: {
      deleteMany: {},                        // remove all existing CardLabel rows
      create: labelIds.map((labelId) => ({   // create new CardLabel rows
        label: { connect: { id: labelId } },
      })),
    },
  },
  include: { labels: { include: { label: true } } },
})
```

### Verified Pattern: Labels passed from page.tsx

```tsx
// src/app/page.tsx
import { getBoard, getLabels } from '@/actions/tasks'

export default async function HomePage() {
  const [columns, labels] = await Promise.all([getBoard(), getLabels()])
  const serialized = columns.map(serializeColumn)

  return (
    <main className="h-screen overflow-hidden">
      <BoardLoader columns={serialized} labels={labels} />
    </main>
  )
}
```

```ts
// src/actions/tasks.ts — add this query
export async function getLabels() {
  return prisma.label.findMany({ orderBy: { name: 'asc' } })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormState` (React DOM) | `useActionState` (React core) | React 19 stable (Dec 2024) | Import from `react`, not `react-dom` |
| Manual `useState` for pending | `useTransition` + `isPending` | React 18+ | Atomic pending state, no manual flip |
| `useReducer` for optimistic | `useOptimistic` | React 19 | First-class optimistic hook with auto-rollback |
| Portal-based modals | Native `<dialog showModal()>` | Browsers 2023+ | Zero dependencies, top-layer, focus trap built in |
| Separate API routes | Server Actions (`'use server'`) | Next.js 14+ | No API layer needed for mutations |

**Deprecated/outdated:**
- `useFormState` from `react-dom`: replaced by `useActionState` from `react` in React 19. The old import still works as an alias but is deprecated.
- `ReactDOM.createPortal` for modals: unnecessary when using `<dialog>` — it already renders in the top layer.

---

## Open Questions

1. **Where to store modal open state?**
   - What we know: Card.tsx needs an `onClick`, Column.tsx renders cards, CardModal needs to be mounted somewhere.
   - What's unclear: Should modal state live in Column (one modal per column) or Board (one modal for the whole board)?
   - Recommendation: One modal at the Board level is cleaner — only one CardModal in the DOM at a time. Column passes an `onCardClick` callback up to Board, which manages `selectedCard` state. Board renders `<CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />`.

2. **How to pass labels to CardModal without prop drilling through Board?**
   - What we know: Labels are fetched in page.tsx, passed to BoardLoader → Board.
   - What's unclear: Board → Column → Card is already 3 levels deep; adding labels makes it 4.
   - Recommendation: Pass labels from Board directly to CardModal (rendered at Board level). No prop drilling through Column needed since modal lives at Board, not Column.

3. **Should `getLabels()` be a separate server action or merged into `getBoard()`?**
   - What we know: Labels are static (4 seeded, not user-editable this phase). Fetching separately adds a second DB query.
   - What's unclear: Phase 5+ scope for label management.
   - Recommendation: Add `getLabels()` as a separate export in `tasks.ts` and call `Promise.all([getBoard(), getLabels()])` in `page.tsx`. Keeps getBoard() clean and labels always fresh if they change later.

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not present in `.planning/config.json` (not enabled).

---

## Sources

### Primary (HIGH confidence)
- [react.dev/reference/react/useActionState](https://react.dev/reference/react/useActionState) — API signature, parameters, return values, code examples verified directly
- [react.dev/reference/react/useOptimistic](https://react.dev/reference/react/useOptimistic) — API signature, auto-rollback behavior, must-be-in-transition constraint verified
- [nextjs.org/docs/app/getting-started/updating-data](https://nextjs.org/docs/app/getting-started/updating-data) — Next.js 16.1.6 official docs (updated 2026-02-27), Server Action patterns, revalidatePath usage, useActionState + pending example
- [prisma.io/docs/orm/prisma-client/queries/crud](https://www.prisma.io/docs/orm/prisma-client/queries/crud) — Prisma 7 create/update/delete with nested writes
- Project source files — `src/actions/tasks.ts`, `src/actions/schemas.ts`, `src/types/index.ts`, `prisma/schema.prisma`, `prisma/seed.ts`

### Secondary (MEDIUM confidence)
- [Prisma Discussion #10048](https://github.com/prisma/prisma/discussions/10048) — Explicit M:N `set` limitation and `deleteMany + create` workaround, verified against official Prisma many-to-many docs
- [CSS-Tricks: No Need to Trap Focus on dialog](https://css-tricks.com/there-is-no-need-to-trap-focus-on-a-dialog-element/) — `showModal()` built-in focus handling, verified against MDN dialog docs
- [react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19) — `useFormState` deprecation in favor of `useActionState`

### Tertiary (LOW confidence — not critical to implementation)
- Various WebSearch results on Finnish locale date formatting (verified against existing `DateDisplay.tsx` which already uses `Intl.DateTimeFormat('fi-FI')`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, versions confirmed from package.json
- Architecture: HIGH — patterns verified against official React 19 and Next.js 16.1.6 docs
- Prisma M:N pattern: HIGH — verified against official Prisma docs and confirmed by schema.prisma inspection
- Pitfalls: HIGH — derived from combination of official docs, schema inspection, and existing code analysis

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (React 19 and Next.js 16 are stable; Prisma M:N behavior is stable)
