# Phase 3: Card CRUD - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create, edit, and delete cards with the full field set. Create is inline (quick-add with title only). Edit opens a modal with all fields. Delete requires confirmation. Changes persist immediately via Server Actions with revalidatePath. Pending/error states visible in UI.

</domain>

<decisions>
## Implementation Decisions

### Card creation
- "+" button at the bottom of each column
- Inline form: text input appears, user types title, press Enter or click to create
- Card created with default priority (MEDIUM), no due date, no labels
- Card appears at the bottom of the column (append position)
- Finnish placeholder text: "Uusi kortti..."

### Card editing (modal)
- Click on a card opens a modal/dialog
- Modal shows all editable fields: title, description (textarea), priority (select), due date (date input), labels (multi-select checkboxes)
- Save button persists changes, modal closes
- Description stored as plain text (markdown rendering deferred to later)
- Labels shown as checkboxes with color dots (pick from existing 4 default labels)

### Card deletion
- Delete button in the modal (not on card face)
- Confirmation dialog: "Haluatko varmasti poistaa tämän kortin?" (Are you sure you want to delete this card?)
- Permanent delete (archive is Phase 6)

### UI feedback
- Loading/pending indicator while save is in progress
- Error message shown if save fails
- Optimistic: card appears immediately on create, modal shows saved state

### Claude's Discretion
- Modal design and layout (Claude picks clean, functional approach)
- Whether to use a dialog element, portal, or overlay pattern
- Form validation UX (inline errors vs toast)
- How to handle the label multi-select UI
- Whether description field auto-grows or uses fixed height

</decisions>

<specifics>
## Specific Ideas

- Quick-add should feel lightweight — minimal friction to capture an idea
- Modal should show all card details clearly, not feel cramped
- Finnish UI text throughout: buttons, labels, placeholders, confirmation dialogs

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/actions/tasks.ts`: Server Action stubs ready to fill in (createTask, updateTask, deleteTask)
- `src/actions/schemas.ts`: Zod validation schemas already defined
- `src/types/index.ts`: All types ready (CreateTaskInput, UpdateTaskInput, ActionResult<T>, SerializedCard/Column)
- `src/lib/positions.ts`: positionAfterLast() for appending new cards
- `src/components/board/Card.tsx`: Card face component (needs onClick handler added)
- `src/components/board/Column.tsx`: Column component (needs add card button added)
- `src/app/page.tsx`: Server Component page with getBoard() and serialization

### Established Patterns
- Server Actions with Zod validation → ActionResult<T> response
- Date serialization across RSC/Client boundary (serializeColumn in page.tsx)
- Client Components with 'use client' directive
- BoardLoader wraps Board with dynamic ssr:false

### Integration Points
- Server Actions call revalidatePath('/') to refresh board data after mutations
- Column component needs "add card" button wired to createTask action
- Card component needs onClick to open modal
- Modal needs to call updateTask and deleteTask actions
- getBoard() already filters archived cards

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-card-crud*
*Context gathered: 2026-02-28*
