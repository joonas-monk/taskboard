# Phase 7: Pipeline UI - Research

**Researched:** 2026-02-28
**Domain:** React polling, status indicators, tabbed modal UI, card type selector
**Confidence:** HIGH

## Summary

Phase 7 is a pure UI layer on top of a fully-operational backend. The pipeline already runs end-to-end (Phases 5-6). Every data model, Server Action, and worker needed is in place. The work is entirely in the presentation layer: reading `pipelineStatus` and `cardType` fields that already exist on `SerializedCard`, calling `getPipelineStatus` / `pausePipeline` / `startPipeline` Server Actions that already exist, and rendering status indicators, a log viewer, and control buttons.

The five goals are: (1) a card type selector in `AddCardForm` for the Idea column only, wired to `createTask` (which already accepts `cardType` but the schema needs the field added); (2) a `PipelineIndicator` component on each card face (spinner + Finnish status text derived from `pipelineStatus`); (3) polling via `router.refresh()` every 5 seconds while any card has an active pipeline status; (4) a "Tekoäly-loki" tab in `CardModal` that calls `getPipelineStatus` and renders the conversation; (5) Pause/Retry/Start buttons in the modal for pipeline control.

The critical insight is that `SerializedCard` already carries `pipelineStatus` and `cardType` — no additional data-fetching at the board level is needed. The only new data fetch is in `CardModal` when the Tekoäly-loki tab is opened, using `getPipelineStatus`. Polling belongs in `Board.tsx` using `useRouter` + `useEffect` + `setInterval`, checking whether any card across all columns has a "live" status (QUEUED, PLANNING, EXECUTING, TESTING).

**Primary recommendation:** Add pipeline UI incrementally — card type selector first, then card-face indicators, then polling, then the modal log tab, then modal action buttons. Each step is independently testable.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-04 | User can select card type (Koodiprojekti, Tutkimus, Liiketoiminta, Yleinen) when creating a card | AddCardForm needs a `<select>` for cardType, visible only in Idea column; createTaskSchema needs `cardType` field; createTask needs to pass it to prisma.card.create |
| AI-05 | User can see AI pipeline status (spinner, stage progress) on each card | PipelineIndicator component reads `card.pipelineStatus`, renders spinner + Finnish text; embedded in Card.tsx below title |
| AI-06 | User can view AI conversation log in card modal (Tekoäly-loki tab) | CardModal gains tab UI; Tekoäly-loki tab calls getPipelineStatus and renders PipelineLog; PipelineStatusResult already has serialized run + messages |
| AI-07 | User can pause a running pipeline and retry a failed one from the modal | PipelineActions component: Pause button calls pausePipeline, Retry/Start buttons call startPipeline; shown in modal based on current pipelineStatus |
</phase_requirements>

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | useEffect, useTransition, useRouter for polling | Already in use |
| Next.js 16.1.6 | 16.x | useRouter().refresh() for polling without full unmount | App Router standard |
| Tailwind CSS v4 | 4.x | Spinner animation via `animate-spin`, status colors | Already in use |
| TypeScript 5 | 5.x | Typed pipeline status constants | Already in use |

### No New Dependencies Required
All needed libraries are already installed. The entire phase is implemented with existing React/Next.js primitives:
- `useRouter` from `next/navigation` — for `router.refresh()` polling
- `useEffect` + `setInterval` — for the polling timer
- `useState` — for active tab tracking in CardModal
- `useTransition` — for pipeline action buttons (already used for delete)

### Finnish UI Text Map
| Status | Finnish Display | Status Category |
|--------|----------------|----------------|
| IDLE | (no indicator shown) | inactive |
| QUEUED | Jonossa... | active |
| PLANNING | Suunnitellaan... | active |
| EXECUTING | Toteutetaan... | active |
| TESTING | Testataan... | active |
| COMPLETED | Valmis | terminal |
| FAILED | Virhe | terminal |
| PAUSED | Pysaytetty | terminal |

| CardType | Finnish Display |
|---------|----------------|
| CODE | Koodiprojekti |
| RESEARCH | Tutkimus |
| BUSINESS | Liiketoiminta |
| GENERAL | Yleinen |

## Architecture Patterns

### Recommended Project Structure (additions to existing)
```
src/components/board/
├── PipelineIndicator.tsx   # NEW: spinner + status text on card face
├── PipelineLog.tsx         # NEW: message list for Tekoäly-loki tab
├── PipelineActions.tsx     # NEW: Start/Pause/Retry buttons
├── Card.tsx                # MODIFY: add PipelineIndicator below title
├── CardModal.tsx           # MODIFY: add tab UI + Tekoäly-loki tab
├── AddCardForm.tsx         # MODIFY: add cardType selector (Idea column only)
└── Board.tsx               # MODIFY: add polling useEffect
src/actions/
└── schemas.ts              # MODIFY: add cardType to createTaskSchema
src/actions/tasks.ts        # MODIFY: pass cardType to prisma.card.create
```

### Pattern 1: Polling with router.refresh()
**What:** `Board.tsx` uses `useEffect` + `setInterval` to call `router.refresh()` every 5 seconds when any card has an active pipeline status. Stops polling when no active pipelines exist.
**When to use:** Single-user app, no WebSocket needed, board data is server-owned.
**Example:**
```typescript
// Source: Next.js App Router docs — router.refresh() re-fetches server data
// without unmounting client components
'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import type { SerializedCard } from '@/types'

const ACTIVE_STATUSES = new Set(['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'])

function hasActivePipeline(cards: SerializedCard[]): boolean {
  return cards.some(c => ACTIVE_STATUSES.has(c.pipelineStatus))
}

// Inside Board component:
const router = useRouter()

useEffect(() => {
  const allCards = columns.flatMap(col => col.cards)
  if (!hasActivePipeline(allCards)) return // no polling needed

  const id = setInterval(() => {
    router.refresh()
  }, 5000)

  return () => clearInterval(id)
}, [columns, router])
```

**Key detail:** `router.refresh()` in Next.js App Router re-fetches server data and merges it into the React tree without unmounting client components. The existing `useEffect(() => { setColumns(serverColumns) }, [serverColumns])` in `Board.tsx` already handles incoming server data updates — polling just triggers a new server render.

### Pattern 2: PipelineIndicator on Card Face
**What:** Small component below the card title that shows a spinner (for active) or status badge (for terminal states). Only renders when `pipelineStatus !== 'IDLE'`.
**When to use:** Any card with a non-IDLE pipelineStatus.
**Example:**
```typescript
// PipelineIndicator.tsx
'use client'
import type { PipelineStatus } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Jonossa...',
  PLANNING: 'Suunnitellaan...',
  EXECUTING: 'Toteutetaan...',
  TESTING: 'Testataan...',
  COMPLETED: 'Valmis',
  FAILED: 'Virhe',
  PAUSED: 'Pysaytetty',
}

const ACTIVE_STATUSES = new Set(['QUEUED', 'PLANNING', 'EXECUTING', 'TESTING'])

interface Props {
  status: PipelineStatus
}

export default function PipelineIndicator({ status }: Props) {
  if (status === 'IDLE') return null

  const isActive = ACTIVE_STATUSES.has(status)
  const label = STATUS_LABELS[status] ?? status

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {isActive && (
        <span className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
      )}
      <span
        style={{
          color: isActive ? '#3b82f6'
            : status === 'COMPLETED' ? '#16a34a'
            : status === 'FAILED' ? '#dc2626'
            : '#6b7280'
        }}
      >
        {label}
      </span>
    </div>
  )
}
```

**Critical detail:** Use inline styles for status colors (not Tailwind dynamic classes) — Tailwind v4 cannot generate dynamic class names from runtime values. This matches the existing `LabelChip.tsx` pattern.

### Pattern 3: Tabbed CardModal
**What:** CardModal gains two tabs: "Kortti" (existing form) and "Tekoäly-loki" (pipeline log). Only show tabs when `card.pipelineStatus !== 'IDLE'`.
**When to use:** Card has a pipeline run (non-IDLE status).
**Example:**
```typescript
// Simplified tab structure inside CardModal
type Tab = 'kortti' | 'loki'
const [activeTab, setActiveTab] = useState<Tab>('kortti')

// Tab nav (only shown when not IDLE)
{card.pipelineStatus !== 'IDLE' && (
  <div className="flex border-b border-slate-200 mb-4">
    <button
      type="button"
      onClick={() => setActiveTab('kortti')}
      className={`px-4 py-2 text-sm ${activeTab === 'kortti' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}
    >
      Kortti
    </button>
    <button
      type="button"
      onClick={() => setActiveTab('loki')}
      className={`px-4 py-2 text-sm ${activeTab === 'loki' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600'}`}
    >
      Tekoaly-loki
    </button>
  </div>
)}
```

**State reset:** Add `setActiveTab('kortti')` to the `useEffect` that resets on `card` change.

### Pattern 4: PipelineLog Component
**What:** Fetches `getPipelineStatus` when the Tekoaly-loki tab is active and displays messages and PipelineActions.
**When to use:** Inside CardModal, only when loki tab is active.
**Example:**
```typescript
// PipelineLog.tsx — client component that fetches on mount
'use client'
import { useEffect, useState, useTransition } from 'react'
import { getPipelineStatus } from '@/actions/ai'
import type { SerializedPipelineRun, PipelineStatus } from '@/types'
import PipelineActions from './PipelineActions'

interface Props {
  cardId: string
  currentStatus: PipelineStatus
  onStatusChange: () => void
}

export default function PipelineLog({ cardId, currentStatus, onStatusChange }: Props) {
  const [run, setRun] = useState<SerializedPipelineRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPipelineStatus({ cardId }).then(result => {
      if (cancelled) return
      if (result.success && result.data.run) {
        // Serialize dates (getPipelineStatus returns non-serialized run from Server Action)
        // Server Actions auto-serialize via React — run.createdAt will be string on client
        setRun(result.data.run as unknown as SerializedPipelineRun)
      } else if (!result.success) {
        setError(result.error)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [cardId, currentStatus]) // re-fetch when status changes (polling triggers re-render)

  // ... render messages
}
```

**Important:** `getPipelineStatus` is a Server Action called from a Client Component. React automatically serializes the return value — `Date` objects in `PipelineRun` and `PipelineMessage` will arrive as `string` on the client despite the TypeScript types. The `SerializedPipelineRun` / `SerializedPipelineMessage` types in `src/types/index.ts` are already defined for this reason.

### Pattern 5: PipelineActions Component
**What:** Renders Start/Pause/Retry buttons based on current `pipelineStatus`. Calls Server Actions directly.
**Example:**
```typescript
'use client'
import { useTransition } from 'react'
import { startPipeline, pausePipeline } from '@/actions/ai'

const PAUSEABLE = new Set(['PLANNING', 'EXECUTING', 'TESTING'])
const RETRIABLE = new Set(['FAILED', 'PAUSED'])
const STARTABLE = new Set(['IDLE'])

interface Props {
  cardId: string
  status: PipelineStatus
  onAction: () => void // triggers parent to re-fetch status
}

export default function PipelineActions({ cardId, status, onAction }: Props) {
  const [isPending, startTransition] = useTransition()

  function handlePause() {
    startTransition(async () => {
      await pausePipeline({ cardId })
      onAction()
    })
  }

  function handleRetry() {
    startTransition(async () => {
      await startPipeline({ cardId })
      onAction()
    })
  }

  // ...buttons based on status
}
```

### Pattern 6: Card Type Selector in AddCardForm
**What:** AddCardForm shows a `<select>` for card type only when `columnId` matches the Idea column. Since AddCardForm receives `columnId` not column name, the Column component must pass `columnName` too.
**How to detect Idea column:** Pass `isIdeaColumn` prop from Column to AddCardForm.
**Example:**
```typescript
// Column.tsx passes isIdeaColumn
<AddCardForm
  columnId={column.id}
  lastPosition={lastPosition}
  onOptimisticAdd={addOptimisticCard}
  isIdeaColumn={column.name === 'Idea'}
/>

// AddCardForm.tsx state and form
const [cardType, setCardType] = useState<'CODE' | 'RESEARCH' | 'BUSINESS' | 'GENERAL'>('GENERAL')

// In form, show selector only when isIdeaColumn
{isIdeaColumn && (
  <select
    value={cardType}
    onChange={(e) => setCardType(e.target.value as CardType)}
    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
  >
    <option value="GENERAL">Yleinen</option>
    <option value="CODE">Koodiprojekti</option>
    <option value="RESEARCH">Tutkimus</option>
    <option value="BUSINESS">Liiketoiminta</option>
  </select>
)}

// Pass to createTask
const result = await createTask({ title, columnId, cardType })
```

**Schema change needed:** `createTaskSchema` in `src/actions/schemas.ts` does not include `cardType`. Must add:
```typescript
cardType: z.enum(['CODE', 'RESEARCH', 'BUSINESS', 'GENERAL']).optional()
```
And `createTask` in `src/actions/tasks.ts` must pass `cardType: parsed.data.cardType` to `prisma.card.create`.

**Optimistic card:** `AddCardForm` creates an optimistic `SerializedCard` — its `cardType` must use the selected value (not hardcoded `'GENERAL'`).

### Anti-Patterns to Avoid
- **SSE or WebSocket for polling:** Out of scope per decisions. Use `router.refresh()` at 5s interval.
- **Fetching pipeline status at the board level:** Heavy — call `getPipelineStatus` only inside `CardModal` when the loki tab is opened. The card's current `pipelineStatus` is already in `SerializedCard`.
- **Dynamic Tailwind class names for status colors:** Tailwind v4 cannot purge/generate these. Use inline styles (matches `LabelChip` pattern).
- **Blocking createTask on pipeline start:** `startPipeline` is fire-and-forget in `createTask`. Do not await it.
- **Tab state persisting across card changes:** Reset `activeTab` to `'kortti'` in the `useEffect` that runs when `card` changes in `CardModal`.
- **Calling getPipelineStatus on every render:** Only fetch when the loki tab is active. Use `currentStatus` as a `useEffect` dependency to re-fetch when the status changes (arriving via `router.refresh()` from polling).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spinner animation | Custom CSS keyframes | `animate-spin` class (Tailwind v4) | Already in project, consistent |
| Status polling | WebSocket/SSE server | `router.refresh()` + setInterval | Single-user, approved architecture |
| Modal management | Custom portal | Existing native `<dialog>` in CardModal | Already works, no new complexity |
| Date formatting for log | Custom formatter | Existing `new Intl.DateTimeFormat('fi-FI', {...})` pattern from DateDisplay.tsx | Consistent fi-FI locale |

**Key insight:** This phase adds zero new infrastructure. Everything is wiring existing pieces together with new presentation components.

## Common Pitfalls

### Pitfall 1: router.refresh() Not Stopping When Pipeline Ends
**What goes wrong:** Polling continues even after `pipelineStatus` becomes COMPLETED/FAILED/PAUSED, causing unnecessary server load.
**Why it happens:** `useEffect` dependencies not including updated `columns` state.
**How to avoid:** The `useEffect` dependency array must include `columns`. When `router.refresh()` delivers new data, `setColumns(serverColumns)` updates `columns`, which triggers the effect to re-evaluate — if no active pipelines remain, `clearInterval` runs immediately.
**Warning signs:** Network tab shows continual requests after all cards reach terminal status.

### Pitfall 2: Stale Closure in setInterval Callback
**What goes wrong:** The `router.refresh()` inside `setInterval` uses a stale reference to `router`.
**Why it happens:** `setInterval` captures the closure at creation time.
**How to avoid:** Include `router` in `useEffect` dependencies (it is stable in Next.js 16 App Router — won't cause re-subscribing). The `useCallback` pattern is not needed; `useRouter()` returns a stable object.

### Pitfall 3: getPipelineStatus Returns non-Serialized Dates
**What goes wrong:** TypeScript types say `PipelineRun.createdAt` is `Date` but client receives `string` — accessing `.toISOString()` throws "not a function".
**Why it happens:** React serializes Server Action responses automatically, converting `Date` → ISO string. The TypeScript types don't reflect this.
**How to avoid:** Use `SerializedPipelineRun` / `SerializedPipelineMessage` types from `src/types/index.ts` when storing the result in client state. Treat all dates as strings on the client side.

### Pitfall 4: createTask Ignoring cardType
**What goes wrong:** User selects "Koodiprojekti" but card is created as GENERAL and wrong execution stage runs.
**Why it happens:** `createTaskSchema` doesn't include `cardType`, so it's stripped by Zod before reaching `prisma.card.create`.
**How to avoid:** Add `cardType` to `createTaskSchema` and explicitly pass `cardType: parsed.data.cardType` in the `prisma.card.create` call.

### Pitfall 5: AddCardForm Optimistic Card Missing cardType
**What goes wrong:** Optimistic card shows `cardType: 'GENERAL'` in UI even though user selected CODE.
**Why it happens:** Hardcoded `cardType: 'GENERAL'` in the optimistic card object in `AddCardForm`.
**How to avoid:** Use the `cardType` state variable: `cardType: cardType` in the optimistic card construction.

### Pitfall 6: Tab State Not Resetting on Card Change
**What goes wrong:** Opening card A on Tekoaly-loki tab, then closing and opening card B — B opens on Tekoaly-loki tab instead of Kortti tab.
**Why it happens:** `activeTab` state persists across card changes. `CardModal` is a single instance at Board level.
**How to avoid:** Add `setActiveTab('kortti')` inside the `useEffect(() => { ...; setConfirmDelete(false) }, [card])` that already resets confirmDelete on card change.

### Pitfall 7: PipelineLog Re-fetching Too Aggressively
**What goes wrong:** PipelineLog re-fetches on every render, causing excessive API calls.
**Why it happens:** Missing or wrong `useEffect` dependencies.
**How to avoid:** `useEffect` dependencies must be `[cardId, currentStatus]` — only re-fetch when the card changes or the pipeline status changes (which happens when `router.refresh()` delivers new data).

## Code Examples

Verified patterns from existing codebase:

### Inline style for dynamic color (matches LabelChip pattern)
```typescript
// Source: src/components/board/LabelChip.tsx
// Use inline styles — Tailwind v4 cannot generate dynamic class names
<span style={{ backgroundColor: label.color }} />

// Same pattern for pipeline status colors:
<span style={{ color: isActive ? '#3b82f6' : '#16a34a' }}>
  {label}
</span>
```

### useTransition for Server Action buttons (matches existing delete pattern)
```typescript
// Source: src/components/board/CardModal.tsx lines 17-18, 71-79
const [isPending, startTransition] = useTransition()

function handleAction() {
  startTransition(async () => {
    const result = await serverAction({ cardId })
    if (!result.success) setError(result.error)
  })
}
```

### Polling via router.refresh (Next.js App Router pattern)
```typescript
// Source: Next.js 16 App Router docs — router.refresh() is the standard
// approach for re-fetching server data without page navigation
import { useRouter } from 'next/navigation'
const router = useRouter()
useEffect(() => {
  const id = setInterval(() => router.refresh(), 5000)
  return () => clearInterval(id)
}, [router])
```

### Server Action called from Client Component
```typescript
// Source: src/components/board/CardModal.tsx (existing pattern)
// Server Actions can be imported and called directly from client components
import { updateTask } from '@/actions/tasks'
// await updateTask({...}) inside useTransition or useActionState
```

### fi-FI date formatting (matches DateDisplay pattern)
```typescript
// Source: src/components/board/DateDisplay.tsx
const formatter = new Intl.DateTimeFormat('fi-FI', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
formatter.format(new Date(isoString))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebSocket for real-time | router.refresh() polling | Approved Phase 7 decision | No server infrastructure needed |
| useEffect + fetch for server data | Server Actions called directly from client | Next.js 13+ App Router | Simpler, type-safe |
| window.confirm for dialogs | Native `<dialog>` element | Phase 3 decision | Already in use |

**No deprecated patterns in scope for this phase.**

## Open Questions

1. **Should Tekoaly-loki tab auto-refresh while pipeline is active?**
   - What we know: The tab fetches on `[cardId, currentStatus]` — when `router.refresh()` delivers a new `pipelineStatus`, the `currentStatus` prop changes, triggering a re-fetch.
   - What's unclear: Is the latency acceptable (board polls every 5s → modal re-fetches shortly after)?
   - Recommendation: Yes, this is acceptable for single-user. The re-fetch chain is: worker updates DB → router.refresh() fires → server re-renders → Board receives new columns with updated pipelineStatus → PipelineLog re-fetches. Total lag: up to 5s + one round trip. Acceptable.

2. **What happens to the Tekoaly-loki tab when cardType is GENERAL and pipeline never ran?**
   - What we know: `pipelineStatus === 'IDLE'` for GENERAL cards in non-Idea columns. Tab is only shown when `pipelineStatus !== 'IDLE'`.
   - Recommendation: Do not show the Tekoaly-loki tab for IDLE cards. This is clean UX.

3. **Should card type be editable after creation?**
   - What we know: AI-04 only mentions creation. CardModal edit form does not include cardType.
   - Recommendation: Do not add cardType to CardModal edit form in Phase 7. Keep scope minimal.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/actions/ai.ts`, `src/actions/tasks.ts`, `src/types/index.ts`, `src/components/board/*.tsx`, `prisma/schema.prisma` — all Server Actions, types, and component patterns verified from source
- Prisma schema: `prisma/schema.prisma` — Card model with `cardType` and `pipelineStatus` fields confirmed
- Enums: `src/generated/prisma/enums.ts` — PipelineStatus and CardType values confirmed

### Secondary (MEDIUM confidence)
- Next.js App Router `router.refresh()` pattern: Standard documented approach for revalidating server data in App Router without page navigation. Used throughout the project implicitly via `revalidatePath('/')`.

### Tertiary (LOW confidence)
- None — all claims verified from codebase or well-established React/Next.js patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing
- Architecture: HIGH — all patterns verified against existing codebase conventions
- Pitfalls: HIGH — identified from direct code inspection of AddCardForm, CardModal, Board, and pipeline action code

**Research date:** 2026-02-28
**Valid until:** 2026-04-30 (stable stack, no fast-moving dependencies)
