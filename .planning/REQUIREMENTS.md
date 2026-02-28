# Requirements: TaskBoard

**Defined:** 2026-02-28
**Core Value:** One place to capture ideas and track them through to completion — from idea to done, visually and with drag & drop.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Board

- [x] **BOARD-01**: User sees a kanban board with 5 fixed columns: Idea, Suunnittelu, Toteutus, Testaus, Valmis

### Card Management

- [ ] **CARD-01**: User can create a new card with title in any column
- [ ] **CARD-02**: User can open a card in a modal to edit title, description, priority, due date, and labels
- [ ] **CARD-03**: User can delete a card with a confirmation dialog
- [ ] **CARD-04**: User can write a description in plain text with markdown rendering
- [ ] **CARD-05**: User can archive a card (soft-delete) instead of permanent deletion
- [ ] **CARD-06**: User can view archived cards

### Drag & Drop

- [ ] **DND-01**: User can drag a card from one column to another
- [ ] **DND-02**: User can reorder cards within a column by dragging
- [ ] **DND-03**: Card positions persist after page refresh

### Card Metadata

- [x] **META-01**: User can set priority (High/Medium/Low) and see it as a badge on the card
- [x] **META-02**: User can set a due date and see an overdue indicator when past due
- [x] **META-03**: User can assign color-coded labels to a card

### Data & Infrastructure

- [x] **DATA-01**: All card data persists in SQLite and survives server restart
- [ ] **DATA-02**: Application is deployable to Hostinger VPS and accessible via browser

### Search & Navigation

- [ ] **SRCH-01**: User can search cards by keyword across all columns
- [ ] **SRCH-02**: User can filter cards by label or priority
- [ ] **SRCH-03**: User can use keyboard shortcuts for common actions (create card, open card, close modal)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Board Customization

- **BCUST-01**: User can rename columns
- **BCUST-02**: User can reorder columns
- **BCUST-03**: Column card count badge displays in header

### Card Enhancements

- **CENH-01**: User can add checklists/subtasks to cards
- **CENH-02**: User can set recurring tasks

### Analytics

- **ANAL-01**: User can see board summary statistics (cards per column, completion rate)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user / team features | Single user only — VPS secured by other means |
| Authentication / login | VPS network security handles access control |
| Multiple boards | Labels sufficient for categorization on one board |
| Real-time sync / WebSockets | Single user — page refresh sufficient |
| File attachments | Storage/bandwidth complexity; link in description instead |
| Comments / activity log | Single user — no one to communicate with |
| Mobile app | Web responsive design sufficient |
| Notifications / email | Single user — overdue indicator on board is enough |
| Time tracking | Separate product category; priority + due date sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOARD-01 | Phase 2 | Complete |
| CARD-01 | Phase 3 | Pending |
| CARD-02 | Phase 3 | Pending |
| CARD-03 | Phase 3 | Pending |
| CARD-04 | Phase 3 | Pending |
| CARD-05 | Phase 6 | Pending |
| CARD-06 | Phase 6 | Pending |
| DND-01 | Phase 4 | Pending |
| DND-02 | Phase 4 | Pending |
| DND-03 | Phase 4 | Pending |
| META-01 | Phase 2 | Complete |
| META-02 | Phase 2 | Complete |
| META-03 | Phase 2 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 5 | Pending |
| SRCH-01 | Phase 6 | Pending |
| SRCH-02 | Phase 6 | Pending |
| SRCH-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after Phase 1 completion — DATA-01 complete*
