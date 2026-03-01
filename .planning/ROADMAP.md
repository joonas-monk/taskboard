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
- [x] **Phase 3: Card CRUD** - Create, edit, delete cards with full field set and Server Actions wired up (completed 2026-02-28)
- [x] **Phase 4: Drag and Drop** - DnD between and within columns with persisted float-based card ordering (completed 2026-02-28)
- [ ] **Phase 5: AI Pipeline Foundation** - Database schema, Anthropic SDK, background worker, planning stage
- [ ] **Phase 6: Pipeline Execution** - Full pipeline end-to-end, Claude Code CLI for code projects
- [x] **Phase 7: Pipeline UI** - Status indicators, log viewer, pipeline controls, card type selector (completed 2026-02-28)
- [x] **Phase 8: Polish** - Robustness, edge cases, concurrent pipeline prevention, stale recovery (completed 2026-03-01)
- [ ] **Phase 9: Deployment** - VPS deployment with Nginx, PM2, SSL, and data persistence hardening
- [ ] **Phase 10: Quality of Life** - Search, filter, archive, keyboard shortcuts

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
**Plans:** 1/1 plans complete
Plans:
- [x] 03-01-PLAN.md -- Server Actions implementation, AddCardForm/CardModal components, Board/Column/Card wiring

### Phase 4: Drag and Drop
**Goal**: Users can reorganize the board by dragging cards between columns and within columns, and the order survives a page refresh
**Depends on**: Phase 3
**Requirements**: DND-01, DND-02, DND-03
**Success Criteria** (what must be TRUE):
  1. User can drag a card from one column and drop it into another — the card appears in the new column immediately (optimistic) and persists after page refresh
  2. User can drag a card within a column to change its position — the new order persists after page refresh
  3. Card positions do not visibly snap back or flicker during or after a drag
**Plans:** 1/1 plans complete
Plans:
- [ ] 04-01-PLAN.md -- dnd-kit integration: Server Actions + Board/Column/Card DnD wiring with optimistic local state

### Phase 5: AI Pipeline Foundation
**Goal**: Database schema supports AI pipeline data, Anthropic SDK integrated, background worker runs planning stage and moves card from Idea to Suunnittelu
**Depends on**: Phase 4
**Requirements**: AI-01, AI-08
**Success Criteria** (what must be TRUE):
  1. Calling startPipeline on a card in the Idea column spawns a background worker that moves the card to Suunnittelu and calls Claude API for planning
  2. The plan text is stored as a PipelineMessage in the database
  3. getPipelineStatus returns the current stage and messages
  4. The worker exits cleanly after the planning stage
**Plans**: 2 plans complete
Plans:
- [x] 05-01-PLAN.md -- SQLite WAL mode, Anthropic SDK, PipelineRun/PipelineMessage schema migration, pipeline types and Zod schemas
- [x] 05-02-PLAN.md -- Pipeline worker (detached tsx process), startPipeline/getPipelineStatus Server Actions, AI-01 auto-start in createTask

### Phase 6: Pipeline Execution
**Goal**: The full pipeline runs end-to-end — planning, execution (Claude Agent SDK for code, API for others), and testing — with error handling and retry
**Depends on**: Phase 5
**Requirements**: AI-02, AI-03
**Success Criteria** (what must be TRUE):
  1. A CODE card goes through all three stages: plan (Claude API), execute (Claude Agent SDK), test (Claude API reviews output)
  2. A RESEARCH card goes through all three stages using Claude API only
  3. A failed pipeline can be retried from the failed stage
  4. A running pipeline can be paused and does not continue to the next stage
**Plans:** 2/2 plans executed
Plans:
- [x] 06-01-PLAN.md -- Agent SDK install, workspace utility, execution/testing prompt builders and stage runners
- [x] 06-02-PLAN.md -- Full 3-stage pipeline worker orchestration, pausePipeline Server Action, retry-from-failed-stage

### Phase 7: Pipeline UI
**Goal**: Users see pipeline progress on cards, view AI conversation logs, control the pipeline, and select card types
**Depends on**: Phase 6
**Requirements**: AI-04, AI-05, AI-06, AI-07
**Success Criteria** (what must be TRUE):
  1. User creates a card in Idea with type "Koodiprojekti" and sees AI automatically start processing
  2. The card shows a spinner and status text as it moves through columns
  3. User can click the card and see the "Tekoäly-loki" tab with the full conversation
  4. User can pause a running pipeline and retry a failed one from the modal
  5. The board auto-refreshes to show card movements without manual page reload
**Plans:** 2/2 plans complete
Plans:
- [x] 07-01-PLAN.md -- Card type selector in AddCardForm, PipelineIndicator on card face, Board polling
- [ ] 07-02-PLAN.md -- Tabbed CardModal with Tekoaly-loki log viewer and pipeline control buttons

### Phase 8: Polish
**Goal**: Edge cases handled, robustness hardened, production-ready AI pipeline
**Depends on**: Phase 7
**Requirements**: (none — quality improvement)
**Success Criteria** (what must be TRUE):
  1. Only one pipeline can be actively processing at a time
  2. Stale pipelines (from crashed worker) are detected on server start and reset to FAILED
  3. API rate limit errors trigger exponential backoff retry (3 attempts)
  4. All new UI text is in Finnish
**Plans**: 2 plans
Plans:
- [ ] 08-01-PLAN.md -- Concurrent pipeline guard in startPipeline, stale pipeline recovery on server start
- [ ] 08-02-PLAN.md -- Exponential backoff retry for API rate limits, Finnish text audit

### Phase 9: Deployment
**Goal**: The application is accessible via browser at the user's domain with SSL, running reliably on the Hostinger VPS, with card data safe across redeploys
**Depends on**: Phase 8
**Requirements**: DATA-02
**Success Criteria** (what must be TRUE):
  1. User can access the board in a browser via a custom domain over HTTPS
  2. Card data created before a redeploy still exists after the redeploy
  3. The application restarts automatically if the VPS reboots (PM2 startup script configured)
  4. Port 3000 is not directly accessible from the internet — all traffic routes through Nginx
**Plans**: TBD

### Phase 10: Quality of Life
**Goal**: Users can efficiently navigate a growing board with search, filters, archive, and keyboard shortcuts
**Depends on**: Phase 9
**Requirements**: CARD-05, CARD-06, SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. User can type a keyword in a search box and see only matching cards across all columns
  2. User can filter the board to show only cards with a specific label or priority
  3. User can archive a card (instead of deleting it) and view archived cards in a separate view
  4. User can use keyboard shortcuts: N to create a card, Enter to open a focused card, Escape to close the modal
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 1/1 | Complete | 2026-02-28 |
| 2. Board Shell | 1/1 | Complete | 2026-02-28 |
| 3. Card CRUD | 1/1 | Complete | 2026-02-28 |
| 4. Drag and Drop | 1/1 | Complete | 2026-02-28 |
| 5. AI Pipeline Foundation | 2/2 | Complete | 2026-02-28 |
| 6. Pipeline Execution | 2/2 | Complete | 2026-02-28 |
| 7. Pipeline UI | 2/2 | Complete   | 2026-02-28 |
| 8. Polish | 2/2 | Complete   | 2026-03-01 |
| 9. Deployment | 0/? | Not started | - |
| 10. Quality of Life | 0/? | Not started | - |
