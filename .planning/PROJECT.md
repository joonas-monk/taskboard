# TaskBoard

## What This Is

A personal Kanban-style task management web application, similar to Trello, for tracking ideas and tasks through a workflow pipeline. A single-user tool hosted on a Hostinger VPS, accessible via browser through a custom domain.

## Core Value

One place to capture ideas and track them through to completion — from idea to done, visually and with drag & drop.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Kanban board with drag & drop between columns
- [ ] Pipeline columns: Idea → Suunnittelu → Toteutus → Testaus → Valmis
- [ ] Task cards with title, description, priority, dates, and color-coded labels
- [ ] Single board (no multi-board needed)
- [ ] No authentication (VPS is otherwise secured)
- [ ] Deployable to Hostinger VPS, accessible via browser
- [ ] React/Next.js frontend
- [ ] Persistent data storage (tasks survive server restart)

### Out of Scope

- Multi-user / team features — single user only
- Authentication / login — VPS secured by other means
- Multiple boards — one board, labels for categorization
- Mobile app — web-first, responsive design sufficient
- Real-time collaboration — single user
- Notifications / email — no need for single user

## Context

- User has a Hostinger VPS (OS/installed software unknown, will need to verify during deployment)
- User wants Trello-like experience: visual kanban, drag & drop cards, color labels
- Finnish-speaking user — UI language preference to be determined (likely Finnish or English)
- Single user, no auth required — simplifies architecture significantly
- Priority levels needed (high/medium/low)
- Deadlines and date tracking on cards

## Constraints

- **Hosting**: Hostinger VPS — must be self-hostable, no cloud dependencies
- **Tech stack**: React/Next.js — user preference
- **Users**: Single user only — no multi-tenant architecture needed
- **Access**: Browser-based via domain name

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React/Next.js | User preference | — Pending |
| Single board | Labels sufficient for categorization | — Pending |
| No authentication | VPS otherwise secured | — Pending |
| Drag & drop required | Core Trello-like experience | — Pending |

---
*Last updated: 2026-02-28 after initialization*
