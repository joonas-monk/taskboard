# Phase 1: Data Foundation - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The data layer exists and is correctly configured: Prisma schema with SQLite, TypeScript types, and Server Action stubs for all CRUD operations. No UI in this phase — everything builds on these foundations.

</domain>

<decisions>
## Implementation Decisions

### Card data model
- Multiple labels per card (stored as array/relation, like Trello)
- 4 priority levels: Critical / High / Medium / Low
- Card fields: title, description (plain text), priority, due date, labels (multiple), archived flag, column, position
- Description supports markdown (rendered in UI later, stored as plain text)

### Column definitions
- Finnish column names: Idea, Suunnittelu, Toteutus, Testaus, Valmis
- Full UI language is Finnish (buttons, labels, placeholders, all text)

### Claude's Discretion
- Column storage strategy: hardcoded vs database (Claude picks best approach for future v2 flexibility)
- Card position ordering strategy: integer reindex vs float midpoint (Claude picks best for drag & drop)
- Card color: whether labels carry the color or card has a separate color field (Claude decides)
- Database file path on VPS (outside project directory, safe from redeploy)
- Backup strategy (daily cron copy or skip for v1)
- Auto-create database and run migrations on first startup vs manual setup

</decisions>

<specifics>
## Specific Ideas

- Labels should work like Trello — multiple color-coded tags per card for categorization
- Priority "Critical" level added beyond the typical 3-level system for urgent items

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the foundational patterns

### Integration Points
- Prisma schema will be imported by all subsequent phases
- Server Action stubs define the API contract for Phase 2 (Board Shell) and Phase 3 (Card CRUD)
- TypeScript types from this phase are used everywhere

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-data-foundation*
*Context gathered: 2026-02-28*
