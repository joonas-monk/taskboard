---
phase: 03-card-crud
verified: 2026-02-28T15:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Create a card by clicking '+' in any column and typing a title"
    expected: "Card appears immediately (optimistic, reduced opacity), then resolves to full opacity after server round-trip. Card persists after page refresh."
    why_human: "Optimistic UI visual state and timing require browser interaction to verify"
  - test: "Click on an existing card to open the modal, edit all fields (title, description, priority, due date, labels), click Tallenna"
    expected: "Modal closes. Page refreshes or re-renders showing updated values. All field values persist on subsequent page load."
    why_human: "Field persistence and modal close behavior require browser interaction to confirm"
  - test: "Open a card modal, click 'Poista kortti', then 'Vahvista poisto'"
    expected: "Card disappears from the board. After page refresh, the card is gone."
    why_human: "Delete confirmation flow and persistence require browser interaction"
  - test: "Observe save button state while a save is in flight (e.g., on a slow connection)"
    expected: "Button shows 'Tallennetaan...' and is disabled while pending"
    why_human: "Pending state is visible only with real server latency"
---

# Phase 3: Card CRUD Verification Report

**Phase Goal:** Users can create, edit, and delete cards with the full field set, and changes persist immediately
**Verified:** 2026-02-28T15:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                        | Status     | Evidence                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| 1   | User can click a '+' button at the bottom of any column and type a title to create a card that appears immediately           | VERIFIED   | `AddCardForm.tsx`: open state toggles button to inline form; `useOptimistic` in `Column.tsx` appends card instantly; `createTask` called inside `startTransition`; optimistic id guards modal opening |
| 2   | User can click on a card to open a modal showing title, description, priority, due date, and labels — and save edits that persist after page refresh | VERIFIED   | `CardModal.tsx`: all five fields present (title input, description textarea, priority select, dueDate date input, label checkboxes); `useActionState` wired to `updateTask`; `revalidatePath('/')` called on success |
| 3   | User can click a delete button in the modal and confirm to permanently remove a card                                         | VERIFIED   | `CardModal.tsx` lines 200–237: "Poista kortti" button, inline confirm state, "Vahvista poisto" calls `deleteTask` inside `startDeleteTransition`; `prisma.card.delete` + `revalidatePath('/')` in `tasks.ts` |
| 4   | User sees a pending/loading indicator while saves are in progress and an error message if a save fails                       | VERIFIED   | Save button text: `{isPending ? 'Tallennetaan...' : 'Tallenna'}` (CardModal line 191); delete button: `{deleteIsPending ? 'Poistetaan...' : 'Vahvista poisto'}` (line 220); error display from `updateState` and `deleteError` state variables |
| 5   | Description field accepts and saves plain text via a resizable textarea — markdown rendering deferred to later phase          | VERIFIED   | `CardModal.tsx` line 124–130: `<textarea name="description" ... className="... resize-y min-h-[100px]">`; `updateTask` extracts and persists `description` via Prisma; no markdown library present (confirmed by search) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                | Expected                                                          | Status       | Details                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `src/actions/tasks.ts`                  | createTask, updateTask, deleteTask Server Actions + getLabels     | VERIFIED     | All four functions implemented; `prisma.card.create/update/delete`; `revalidatePath('/')` on each mutation; try/catch error handling; `getLabels()` returns `prisma.label.findMany({ orderBy: { name: 'asc' } })` |
| `src/components/board/AddCardForm.tsx`  | Inline quick-add form with optimistic card creation               | VERIFIED     | Exports `AddCardForm`; `useState` for open/title/error; `useTransition` for pending; `createTask` called; optimistic card built and passed to `onOptimisticAdd`; Finnish text throughout |
| `src/components/board/CardModal.tsx`    | Native dialog modal for editing all card fields and deleting cards | VERIFIED     | Exports `CardModal`; `useRef<HTMLDialogElement>` + `useEffect` for `showModal/close`; `useActionState` wired to `updateTask`; all five fields present; inline delete confirmation with `useTransition`; error display for both save and delete |
| `src/components/board/Card.tsx`         | Card face with onClick handler, disabled for optimistic cards     | VERIFIED     | `onClick?: () => void` prop; `cursor-pointer hover:shadow-md` when onClick defined; `opacity-60` for optimistic; `role="button" tabIndex={0} onKeyDown` for keyboard accessibility; onClick undefined for optimistic cards in Column |
| `src/components/board/Column.tsx`       | Column with useOptimistic cards list and AddCardForm              | VERIFIED     | `useOptimistic` with append reducer; `optimisticCards.map()` in render; `AddCardForm` rendered at column bottom; `onCardClick` passed to `Card` only for non-optimistic cards; "Ei kortteja" empty state conditional on `optimisticCards.length` |
| `src/components/board/Board.tsx`        | Board with selectedCard state and single CardModal instance       | VERIFIED     | `useState<SerializedCard | null>(null)` for `selectedCard`; `setSelectedCard` passed as `onCardClick`; `<CardModal card={selectedCard} labels={labels} onClose={() => setSelectedCard(null)} />` rendered outside scroll container |
| `src/app/page.tsx`                      | Server Component fetching both columns and labels, passing to BoardLoader | VERIFIED | `const [columns, labels] = await Promise.all([getBoard(), getLabels()])`; `labels={labels}` passed to `<BoardLoader>` |

### Key Link Verification

| From                                   | To                        | Via                                              | Status    | Details                                                                                                           |
| -------------------------------------- | ------------------------- | ------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/components/board/AddCardForm.tsx` | `src/actions/tasks.ts`    | `createTask` called inside `startTransition`     | WIRED     | Line 42: `const result = await createTask({ title: optimisticCard.title, columnId })` inside `startTransition`    |
| `src/components/board/CardModal.tsx`   | `src/actions/tasks.ts`    | `updateTask` and `deleteTask` called             | WIRED     | Line 52: `await updateTask({...})` in `useActionState` handler; line 73: `await deleteTask(card.id)` in `handleDelete` inside `startDeleteTransition` |
| `src/components/board/Column.tsx`      | `src/components/board/AddCardForm.tsx` | `useOptimistic` + `onOptimisticAdd` prop | WIRED  | Lines 14–17: `useOptimistic` with append reducer; line 47: `onOptimisticAdd={addOptimisticCard}` passed to `AddCardForm` |
| `src/components/board/Board.tsx`       | `src/components/board/CardModal.tsx`   | `selectedCard` state drives modal open/close | WIRED | Line 14: `useState<SerializedCard | null>(null)`; lines 27–31: `<CardModal card={selectedCard} ...>` |
| `src/app/page.tsx`                     | `src/actions/tasks.ts`    | `getLabels()` fetched alongside `getBoard()` via `Promise.all` | WIRED | Line 19: `const [columns, labels] = await Promise.all([getBoard(), getLabels()])` |

### Requirements Coverage

| Requirement | Description                                                         | Status        | Evidence                                                                                                                      |
| ----------- | ------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| CARD-01     | User can create a new card with title in any column                 | SATISFIED     | `AddCardForm.tsx` + `createTask` Server Action with `prisma.card.create`; optimistic append via `useOptimistic` in `Column.tsx` |
| CARD-02     | User can open a card in a modal to edit title, description, priority, due date, and labels | SATISFIED | `CardModal.tsx` with all five fields wired to `updateTask`; `revalidatePath('/')` ensures persistence |
| CARD-03     | User can delete a card with a confirmation dialog                   | SATISFIED     | Inline confirmation in `CardModal.tsx` (Poista kortti → Vahvista poisto/Peruuta); `deleteTask` calls `prisma.card.delete`     |
| CARD-04     | User can write a description in plain text with markdown rendering  | PARTIAL (scope-bounded) | `<textarea>` with `resize-y` accepts and persists plain text. Markdown rendering explicitly deferred to a later phase per agreed CONTEXT.md and PLAN must_have truth. Plain-text storage is the Phase 3 deliverable. |

**Note on CARD-04:** REQUIREMENTS.md marks CARD-04 complete and the ROADMAP.md phase goal says "edit description (plain text)." The PLAN's must_have truth explicitly states "markdown rendering deferred to later phase," which aligns with CONTEXT.md and RESEARCH.md. The plain-text textarea is fully implemented and wired. Markdown rendering is an intentional future-phase scope boundary, not a gap introduced by incomplete implementation. CARD-04 is satisfied to the agreed scope of this phase.

### Anti-Patterns Found

| File                     | Line   | Pattern                                        | Severity | Impact                                                                                                      |
| ------------------------ | ------ | ---------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `src/actions/tasks.ts`   | 111    | `// STUB: Phase 4 implements (drag & drop)`    | INFO     | `moveTask` stub is intentional — Phase 4 work. Not claimed by Phase 3 requirements.                         |
| `src/actions/tasks.ts`   | 138    | `// STUB: Phase 4 implements (drag & drop reorder within column)` | INFO | `reorderTasks` stub is intentional — Phase 4 work. Not claimed by Phase 3 requirements. |
| `src/components/board/CardModal.tsx` | 45 | `if (!card) return null` | INFO | Inside `useActionState` reducer; semantically correct (returns null error state when no card is open). Not a component stub. |

No blockers. No warnings. The two Phase 4 stubs (`moveTask`, `reorderTasks`) were already present from Phase 1 and are not within Phase 3 scope.

### Build Verification

`next build` ran successfully and completed with zero errors:

```
Route (app)
┌ ○ /
└ ○ /_not-found

○  (Static)  prerendered as static content
```

All TypeScript types compile cleanly. No hydration-unsafe patterns found.

### Commit Verification

All three task commits documented in SUMMARY.md exist in git history and match their described content:

| Commit    | Description                                                     | Files Changed                               |
| --------- | --------------------------------------------------------------- | ------------------------------------------- |
| `03622aa` | feat(03-01): implement createTask, updateTask, deleteTask + getLabels | `src/actions/tasks.ts` (+75 lines)     |
| `5c5638b` | feat(03-01): add AddCardForm and CardModal client components    | `AddCardForm.tsx` (new), `CardModal.tsx` (new) |
| `0e5806f` | feat(03-01): wire Card, Column, Board, BoardLoader, page.tsx   | 5 files updated                             |

### Human Verification Required

#### 1. Optimistic Card Creation

**Test:** Open the board. Click the "+ Lisaa kortti" button at the bottom of any column. Type a title and press Enter or click "Lisaa."
**Expected:** Card appears immediately with reduced opacity (optimistic), then solidifies after the server round-trip. Page refresh shows the card with its real database ID.
**Why human:** Visual opacity state and timing of the optimistic-to-real transition require browser interaction.

#### 2. Card Modal Edit — All Fields Persist

**Test:** Click an existing card. Edit the title, add/change the description, change the priority, set a due date, toggle labels. Click "Tallenna."
**Expected:** Modal closes. Board re-renders. Refreshing the page shows all edited values unchanged.
**Why human:** Field persistence requires an actual database round-trip and page reload to confirm.

#### 3. Card Delete with Confirmation

**Test:** Click a card to open the modal. Click "Poista kortti." Read the confirmation text. Click "Vahvista poisto."
**Expected:** Modal closes. Card disappears from the board. Refreshing the page confirms the card is gone.
**Why human:** Delete confirmation flow and cascade behavior require browser interaction.

#### 4. Pending State Visibility

**Test:** Observe the "Tallenna" button immediately after clicking it (best tested with browser DevTools network throttling set to Slow 3G).
**Expected:** Button text changes to "Tallennetaan..." and becomes disabled while the Server Action is in flight.
**Why human:** Pending state is only visually observable with real server latency.

#### 5. Error State Display

**Test:** Open a card modal, clear the title field completely, and click "Tallenna."
**Expected:** An error message appears below the save button indicating the title is required. The modal remains open.
**Why human:** Form validation error display requires manual interaction. (Note: HTML `required` attribute on the title input will trigger browser-native validation before the Server Action is called — verify both.)

### Gaps Summary

No gaps found. All five observable truths are verified. All seven required artifacts exist, are substantive, and are fully wired. All five key links are confirmed. All four requirements (CARD-01 through CARD-04) are satisfied to the agreed phase scope. The `next build` produces zero errors. No blocker or warning anti-patterns exist in phase-added code.

---

_Verified: 2026-02-28T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
