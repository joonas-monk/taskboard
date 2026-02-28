# Roadmap: TaskBoard

## Overview

A personal kanban board built on Next.js 16 and SQLite, deployed to a Hostinger VPS. The journey follows a strict dependency order: data model first (everything else flows from the schema), then the board UI that reads real data, then card CRUD that writes real data, then drag-and-drop that persists card ordering, then a structured deployment phase to avoid known infrastructure pitfalls, and finally the quality-of-life features whose value only becomes clear in daily use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Schema, Prisma/SQLite setup, Server Actions as stubs, typed query functions
- [x] **Phase 2: Board Shell** - Static board UI with real data, 5 fixed columns, card faces with metadata display (completed 2026-02-28)
- [ ] **Phase 3: Card CRUD** - Create, edit, delete cards with full field set and Server Actions wired up
- [ ] **Phase 4: Drag and Drop** - DnD between and within columns with persisted float-based card ordering
- [ ] **Phase 5: Deployment** - VPS deployment with Nginx, PM2, SSL, and data persistence hardening
- [ ] **Phase 6: Quality of Life** - Search, filter, archive, keyboard shortcuts

## Phase Details

### Phase 1: Data Foundation
**Goal**: The data layer exists and is correctly configured so all subsequent phases build on stable, typed foundations
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01
**Success Criteria** (what must be TRUE):
  1. The SQLite database exists at an absolute path outside the project directory and card data survives a server restart
  2. All card fields (title, description, priority, due date, labels, archived flag, column, position) are represented in the Prisma schema and a migration has run
  3. TypeScript types for tasks and columns are defined and used throughout — no `any` in the data layer
  4. Server Action stubs exist for createTask, updateTask, moveTask, deleteTask, reorderTasks and each returns a typed response
**Plans:** 1 plan
Plans:
- [x] 01-01-PLAN.md -- Prisma schema, types, position utilities, Server Action stubs with Zod validation

### Phase 2: Board Shell
**Goal**: Users can see their kanban board with all 5 columns and real card data — no placeholder data, no hydration errors
**Depends on**: Phase 1
**Requirements**: BOARD-01, META-01, META-02, META-03
**Success Criteria** (what must be TRUE):
  1. User sees a board with exactly 5 columns labeled Idea, Suunnittelu, Toteutus, Testaus, Valmis
  2. User sees existing cards in the correct column, each showing title, priority badge, due date, and color label
  3. User sees an overdue indicator on cards whose due date has passed
  4. No hydration errors appear in the browser console after `next build && next start`
**Plans:** 1/1 plans complete
Plans:
- [x] 02-01-PLAN.md -- UI primitives, board/column/card components, page wiring with data serialization

### Phase 3: Card CRUD
**Goal**: Users can create, edit, and delete cards with the full field set, and changes persist immediately
**Depends on**: Phase 2
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04
**Success Criteria** (what must be TRUE):
  1. User can create a new card by clicking a button in any column — the card appears immediately with just a title
  2. User can open a card modal and edit title, description (plain text), priority, due date, and label color — changes persist after page refresh
  3. User can delete a card after confirming a dialog — the card is gone after page refresh
  4. User sees a loading/pending state while a save is in progress and an error message if a save fails
**Plans:** 1 plan
Plans:
- [ ] 03-01-PLAN.md -- Server Actions implementation, AddCardForm/CardModal components, Board/Column/Card wiring

### Phase 4: Drag and Drop
**Goal**: Users can reorganize the board by dragging cards between columns and within columns, and the order survives a page refresh
**Depends on**: Phase 3
**Requirements**: DND-01, DND-02, DND-03
**Success Criteria** (what must be TRUE):
  1. User can drag a card from one column and drop it into another — the card appears in the new column immediately (optimistic) and persists after page refresh
  2. User can drag a card within a column to change its position — the new order persists after page refresh
  3. Card positions do not visibly snap back or flicker during or after a drag
**Plans**: TBD

### Phase 5: Deployment
**Goal**: The application is accessible via browser at the user's domain with SSL, running reliably on the Hostinger VPS, with card data safe across redeploys
**Depends on**: Phase 4
**Requirements**: DATA-02
**Success Criteria** (what must be TRUE):
  1. User can access the board in a browser via a custom domain over HTTPS
  2. Card data created before a redeploy still exists after the redeploy
  3. The application restarts automatically if the VPS reboots (PM2 startup script configured)
  4. Port 3000 is not directly accessible from the internet — all traffic routes through Nginx
**Plans**: TBD

### Phase 6: Quality of Life
**Goal**: Users can efficiently navigate a growing board with search, filters, archive, and keyboard shortcuts
**Depends on**: Phase 5
**Requirements**: CARD-05, CARD-06, SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. User can type a keyword in a search box and see only matching cards across all columns
  2. User can filter the board to show only cards with a specific label or priority
  3. User can archive a card (instead of deleting it) and view archived cards in a separate view
  4. User can use keyboard shortcuts: N to create a card, Enter to open a focused card, Escape to close the modal
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 1/1 | Complete | 2026-02-28 |
| 2. Board Shell | 1/1 | Complete   | 2026-02-28 |
| 3. Card CRUD | 0/1 | Planned | - |
| 4. Drag and Drop | 0/? | Not started | - |
| 5. Deployment | 0/? | Not started | - |
| 6. Quality of Life | 0/? | Not started | - |
