# Feature Research

**Domain:** Personal Kanban / Task Board (single-user)
**Researched:** 2026-02-28
**Confidence:** MEDIUM — WebSearch and WebFetch unavailable; based on training knowledge of established products (Trello, Wekan, Planka, Vikunja, Notion, Linear, GitHub Projects). Table stakes are HIGH confidence (industry-stable). Differentiators are MEDIUM. MVP recommendations are opinionated from project constraints.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Kanban columns (lists) | Core paradigm — without columns there is no kanban | LOW | Fixed or configurable column set; project specifies 5 fixed columns |
| Task cards | The atomic unit — every kanban tool has cards | LOW | Cards live inside columns |
| Drag & drop cards between columns | The defining UX of kanban; Trello made this standard | MEDIUM | Requires a DnD library (dnd-kit recommended for React); touch support adds complexity |
| Card title | Every card has a name/title | LOW | Single-line text field |
| Card description / notes | Users need context beyond a title | LOW | Markdown or plain text; plain text is simpler for MVP |
| Card creation | Can create new cards in any column | LOW | Inline "Add card" input per column |
| Card deletion | Can remove cards | LOW | Soft-delete UX (confirm dialog) recommended |
| Card editing | Can update card content after creation | LOW | Modal or inline edit |
| Column/list display | Cards grouped visually by column | LOW | Scrollable column layout |
| Persistent data storage | Cards survive page refresh and server restart | LOW | DB or file-based; SQLite is simplest for single-user |
| Visual distinction between columns | User can orient where cards are in workflow | LOW | Column header labels, optional color |
| Card ordering within columns | Cards have position within their column | MEDIUM | Position must be stored and updated on drop |
| Responsive / usable in browser | Desktop browser baseline; does not need to be perfect mobile | LOW | CSS flexbox/grid is sufficient |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required to ship, but add real value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Color-coded labels / tags | Fast visual scanning — identify card category at a glance | LOW | Project already specifies labels; store as array of tag objects per card |
| Priority levels (High / Medium / Low) | Quickly see what matters most without opening cards | LOW | Enum field on card; render as badge or border color |
| Due dates / deadlines on cards | Deadline tracking is one of the top requested personal productivity features | LOW | Date input; visual indicator when overdue |
| Overdue indicator | At-a-glance warning when a card is past its due date | LOW | Derived from due date; red highlight or icon if today > due date |
| Card color / background | Personal expression and fast visual grouping | LOW | Simple color picker; 6-8 preset colors is enough |
| Archive completed cards | Keep the board clean without losing history | MEDIUM | Soft-delete to archived state; archive view is a bonus |
| Card count per column | Helps user see workload distribution | LOW | Simple count badge in column header |
| Keyboard shortcuts | Power-user speed; differentiator for personal tools | MEDIUM | e.g., N for new card, Enter to open, Esc to close |
| Board summary / progress view | See how many cards are in each stage at a glance | LOW | Could be a simple header stat row |
| Custom column names | User wants to rename or reorder columns | MEDIUM | Project specifies Finnish column names — at minimum support display of custom names; editing is bonus |
| Quick search / filter | Find a card by keyword without scrolling | MEDIUM | Client-side filter on title/description; no server search needed for single user |
| Inline card preview | See key info (priority, due date, label) on card face without opening | LOW | Card component shows badges for priority, due date, label color |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but create disproportionate complexity or contradict project scope.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multiple boards | "I have different areas of life" | Contradicts project constraint; adds navigation complexity, data model complexity | Use labels to categorize cards on one board |
| User authentication / login | Seems like a security requirement | Project explicitly out-of-scope; VPS network security handles access control | VPS firewall / IP restriction handles access |
| Real-time sync / WebSockets | "What if I have two browser tabs open?" | Extreme complexity for zero real-world value in single-user tool | Page refresh or simple polling (5-min interval) is sufficient |
| Notifications / email reminders | "Remind me when a card is due" | Requires email service, background jobs, SMTP config — all complexity with no infra | Overdue visual indicator on board is enough |
| File attachments | "I want to attach documents to cards" | Requires file storage, size limits, MIME handling, server disk management | Link to external file (Google Drive URL in description) |
| Comments / activity log | Teams need audit trail | Single user — no one to communicate with; audit log rarely viewed alone | Description field captures all needed context |
| Card checklists / subtasks | "My tasks have sub-steps" | Nested data model; significantly increases card complexity | Break complex tasks into multiple cards |
| Recurring tasks | "Some tasks repeat weekly" | Requires scheduling logic, cron-like behavior, recurrence rules (RFC 5545) | Manually recreate; complexity not worth it for personal tool |
| Time tracking | "I want to log hours" | Separate product category; rarely used once novelty wears off | Priority + due date covers most planning needs |
| Rich text / WYSIWYG editor | "I want formatting in descriptions" | Markdown editors add bundle size and UX complexity; WYSIWYG adds more | Plain textarea is sufficient; optionally add basic markdown rendering |
| Bulk operations | "Select multiple cards and move them" | Complex selection UX; rare actual use | Drag one-by-one is sufficient for personal board |
| Public board sharing | "Share my board with someone" | Requires auth, access tokens, or public URLs — adds security surface | Out of scope per project; single-user only |

---

## Feature Dependencies

```
[Kanban Columns]
    └──requires──> [Card Ordering Within Columns]
                       └──requires──> [Persistent Data Storage]

[Drag & Drop]
    └──requires──> [Kanban Columns]
    └──requires──> [Card Ordering Within Columns]
    └──requires──> [Persistent Data Storage]  (position must be saved)

[Due Date Display]
    └──requires──> [Card with Due Date Field]

[Overdue Indicator]
    └──requires──> [Due Date Display]

[Labels / Tags]
    └──requires──> [Card with Labels Field]

[Priority Badges]
    └──requires──> [Card with Priority Field]

[Archive View]
    └──requires──> [Card Deletion / Archive]

[Quick Search / Filter]
    └──requires──> [Cards rendered in DOM]
    └──enhances──> [Labels / Tags]   (can filter by label)
    └──enhances──> [Priority Levels] (can filter by priority)

[Keyboard Shortcuts]
    └──enhances──> [Card Creation]
    └──enhances──> [Card Editing]

[Card Inline Preview]
    └──enhances──> [Labels / Tags]
    └──enhances──> [Priority Levels]
    └──enhances──> [Due Date Display]
```

### Dependency Notes

- **Drag & Drop requires Card Ordering:** Position must be a stored field (integer or float) on the card; without it, drop order cannot be persisted. Use a float-based ordering scheme (e.g., LexoRank or simple midpoint float) to avoid reindexing the entire column on every move.
- **Overdue Indicator requires Due Date:** Purely derived — no separate data; just a UI computation comparing `due_date` to `now()`.
- **Quick Search enhances Labels and Priority:** If those fields exist, filter can use them; if not, text-only filter still works independently.
- **Archive requires soft-delete:** If cards are hard-deleted, archive is impossible. Design the data model with an `archived: boolean` from the start, even if the archive view is deferred.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validates the core kanban workflow.

- [ ] **Kanban board with 5 fixed columns** (Idea, Suunnittelu, Toteutus, Testaus, Valmis) — the board itself
- [ ] **Card creation with title** — inline "Add card" per column
- [ ] **Card editing modal** — title, description (plain text), priority (High/Medium/Low), due date, color label
- [ ] **Card deletion** — with confirm dialog
- [ ] **Drag & drop between columns** — position persisted
- [ ] **Priority badge on card face** — visual at a glance
- [ ] **Due date on card face + overdue indicator** — visual urgency
- [ ] **Color-coded label on card face** — visual scanning
- [ ] **Persistent storage** — SQLite via a simple API; cards survive restart

### Add After Validation (v1.x)

Add once the core workflow is confirmed useful.

- [ ] **Quick search / filter** — when card count grows and finding cards becomes friction
- [ ] **Card archive** — when the "Valmis" column gets cluttered
- [ ] **Keyboard shortcuts** — when day-to-day use reveals speed friction
- [ ] **Column card count badge** — small quality-of-life addition

### Future Consideration (v2+)

Defer until product-market fit is established.

- [ ] **Custom column names / reorder** — project uses fixed columns initially; reconsider if workflow changes
- [ ] **Markdown rendering in description** — only if plain text feels limiting in practice
- [ ] **Board summary stats** — low value until board has high card count

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Kanban columns (5 fixed) | HIGH | LOW | P1 |
| Card CRUD (create/read/update/delete) | HIGH | LOW | P1 |
| Drag & drop between columns | HIGH | MEDIUM | P1 |
| Card ordering persisted | HIGH | MEDIUM | P1 |
| Persistent storage (SQLite) | HIGH | LOW | P1 |
| Priority field + badge | HIGH | LOW | P1 |
| Due date + overdue indicator | HIGH | LOW | P1 |
| Color labels | MEDIUM | LOW | P1 |
| Card description (plain text) | HIGH | LOW | P1 |
| Quick search / filter | MEDIUM | MEDIUM | P2 |
| Card archive | MEDIUM | MEDIUM | P2 |
| Column card count badge | LOW | LOW | P2 |
| Keyboard shortcuts | MEDIUM | MEDIUM | P2 |
| Custom column names | LOW | MEDIUM | P3 |
| Markdown rendering | LOW | MEDIUM | P3 |
| Board summary stats | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Reference products analyzed (from training knowledge — WebFetch unavailable):

| Feature | Trello (Free) | Wekan (self-hosted OSS) | Planka (self-hosted OSS) | Our Approach |
|---------|--------------|-------------------------|--------------------------|--------------|
| Kanban columns | Yes — configurable | Yes — configurable | Yes — configurable | Fixed 5 columns (simpler, sufficient for single user) |
| Drag & drop | Yes | Yes | Yes | Yes — core requirement |
| Card labels/tags | Yes — color labels (10 colors) | Yes | Yes | Yes — simplified (fewer colors, no label library) |
| Priority | No native — use labels | No native | No native | Yes — explicit field (differentiator vs. Trello) |
| Due dates | Yes | Yes | Yes | Yes |
| Overdue indicator | Yes | Yes | Yes | Yes |
| Attachments | Yes (10MB free limit) | Yes | Yes | No — anti-feature for this scope |
| Checklists | Yes | Yes | Yes | No — anti-feature for this scope |
| Comments/activity | Yes | Yes | Yes | No — single user, no need |
| Multi-board | Yes | Yes | Yes | No — single board by design |
| Authentication | Yes | Yes | Yes | No — VPS-secured |
| Real-time sync | Yes (WebSocket) | Yes | Yes | No — anti-feature; page refresh sufficient |
| Archive | Yes | Yes | Yes | v1.x — defer |
| Search / filter | Yes | Yes | Yes | v1.x — defer |
| Mobile app | Yes (iOS/Android) | No | No | No — web responsive only |
| Self-hostable | No (Trello is SaaS) | Yes | Yes | Yes — Hostinger VPS |
| Open source | No | Yes (MIT) | Yes (AGPL) | Yes (personal project) |

**Key insight:** Planka and Wekan are the closest OSS self-hosted analogs. Both are team-oriented (multi-user, auth required). This project deliberately strips team features and simplifies to personal use — that is the actual differentiator, not any single feature, but the entire philosophy of minimal scope.

---

## Sources

- Training knowledge of Trello feature set (established 2011–2025, HIGH confidence for table stakes)
- Training knowledge of Wekan and Planka OSS projects (MEDIUM confidence — versions change)
- Training knowledge of Linear, Notion, GitHub Projects feature sets (MEDIUM confidence for comparison)
- Personal kanban methodology (David J. Anderson's work, HIGH confidence for theory)
- WebSearch and WebFetch unavailable during this research session — no live competitor data fetched

**Confidence assessment:**
- Table stakes: HIGH — these features are stable across the industry for 10+ years
- Differentiators: MEDIUM — based on training knowledge of competitor gaps, not live verification
- Anti-features: HIGH — derived from project constraints (explicitly out-of-scope in PROJECT.md) + known complexity patterns
- MVP recommendations: MEDIUM — opinionated based on project context; should be validated with user

---

*Feature research for: Personal Kanban Task Board (TaskBoard)*
*Researched: 2026-02-28*
