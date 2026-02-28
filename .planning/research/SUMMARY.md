# Project Research Summary

**Project:** Personal Kanban Task Board (TaskBoard)
**Domain:** Single-user personal kanban web app, self-hosted on VPS
**Researched:** 2026-02-28
**Confidence:** HIGH (stack and architecture verified against official docs; features and pitfalls high confidence for table stakes and critical failure modes)

## Executive Summary

This is a personal kanban task board — a single-user, self-hosted web application in the same category as Trello, Wekan, and Planka, but deliberately stripped of all multi-user and team features. The expert approach for this domain in 2026 is a Next.js 16 App Router application with a Server Component for data fetching, Client Components for the interactive board, Server Actions for all mutations, and SQLite via Prisma as the persistence layer. This stack requires no external services, runs as a single Node.js process on a VPS, and fits the single-user workload without over-engineering. The defining architectural principle is that the database is the only state — there is no client-side cache or state store beyond the brief optimistic window during drag-and-drop.

The MVP feature set is well-defined and achievable: five fixed columns (Idea, Suunnittelu, Toteutus, Testaus, Valmis), card CRUD with title, description, priority, due date, and color label, drag-and-drop with persisted card ordering, and an overdue indicator. Priority (High/Medium/Low) as an explicit card field — rather than a label workaround — is a genuine differentiator over tools like Trello. Features that appear attractive but carry disproportionate complexity for a single-user tool — real-time sync, file attachments, checklists, recurring tasks, comments — should be treated as anti-features and deferred indefinitely.

The most consequential risks are infrastructure decisions made during setup that are hard to undo: choosing static export mode instead of Node.js server mode (which silently kills Server Actions), failing to place the SQLite database at a stable absolute path outside the project directory (which causes data loss on redeploy), and skipping the Nginx reverse proxy (which breaks SSL and streaming). These pitfalls must be addressed in the foundation and deployment phases, not discovered during debugging. The drag-and-drop SSR hydration mismatch is the most common board-level bug and must be resolved with `dynamic()` + `{ ssr: false }` before any DnD logic is built.

## Key Findings

### Recommended Stack

The stack is Next.js 16 (App Router) with React 19, TypeScript 5.9, and Tailwind CSS v4 — all defaults from `create-next-app` in 2026. Prisma 7 with SQLite replaces the ARCHITECTURE.md's Drizzle suggestion; both are valid, but Prisma is the STACK.md recommendation with stronger DX (Prisma Studio, schema-first migrations). Drag-and-drop is handled by @dnd-kit/core 6.3 + @dnd-kit/sortable 10.0, the only actively maintained accessible DnD library for React (react-beautiful-dnd is officially deprecated). Zustand 5 handles the transient optimistic state during drag. Infrastructure: Nginx reverse proxy, PM2 process manager, Certbot/Let's Encrypt SSL. All technologies are current stable releases with no version compatibility conflicts.

**Core technologies:**
- **Next.js 16 (App Router):** Full-stack framework — Server Components for initial data load, Server Actions for mutations, standalone output for VPS deployment
- **React 19 / TypeScript 5.9 / Tailwind v4:** UI and styling — required by Next.js 16; Tailwind v4 CSS-based config, zero runtime overhead
- **Prisma 7 + SQLite:** Persistence — type-safe ORM, zero separate process, sufficient for single-user; upgrade path to PostgreSQL requires only a datasource change
- **@dnd-kit/core 6.3 + @dnd-kit/sortable 10.0:** Drag and drop — only actively maintained accessible DnD library for React 18/19; react-beautiful-dnd is dead
- **Zustand 5:** Client state — handles optimistic board state during drag; minimal boilerplate; avoids the need for React Context with its full-subtree re-renders
- **Nginx + PM2 + Certbot:** Infrastructure — reverse proxy (SSL termination, streaming support), process management, free auto-renewable TLS

**Critical version requirements:** Next.js 16 requires Node.js 20.9+ (Node 18 dropped); @dnd-kit/sortable 10.0 requires @dnd-kit/core 6.x; Zustand 5 requires React 18+; Tailwind v4 requires the `@tailwindcss/postcss` plugin, not the v3 config.

### Expected Features

The MVP scope is tightly defined by the project constraints and confirmed against industry table stakes. See `FEATURES.md` for the full prioritization matrix.

**Must have (table stakes + P1 — launch blockers):**
- Kanban board with 5 fixed columns (Idea, Suunnittelu, Toteutus, Testaus, Valmis) — core paradigm
- Card CRUD (create, read, update, delete with confirm dialog) — atomic unit
- Card title, plain-text description, priority (High/Medium/Low), due date, color label — field set
- Drag and drop between columns with persisted card ordering — defining UX of kanban
- Priority badge + due date + overdue indicator visible on card face — at-a-glance scanning
- Persistent storage (SQLite, survives restart and redeploy) — fundamental reliability

**Should have (differentiators — v1.x after validation):**
- Quick search / filter by keyword — useful when card count grows
- Card archive (soft-delete) — keeps the "Valmis" column manageable
- Keyboard shortcuts — power-user speed for daily use
- Column card count badge — workload distribution at a glance

**Defer (v2+):**
- Custom column names / reorder — fixed columns sufficient initially
- Markdown rendering in description — plain text sufficient; add only if felt in practice
- Board summary stats — low value until high card count

**Anti-features (never implement for this scope):**
Multiple boards, user authentication, real-time sync/WebSockets, file attachments, comments, checklists, recurring tasks, time tracking.

### Architecture Approach

The canonical Next.js App Router architecture for a data-driven interactive page applies directly: `app/page.tsx` is an async Server Component that reads the database directly (no fetch, no API routes) and passes a serialized `Task[]` to `<Board>`, a Client Component that owns all DnD interactivity. All mutations flow through Server Actions in `app/actions/tasks.ts`, which write to SQLite via Prisma and call `revalidatePath('/')` to trigger a Server Component re-render. `useOptimistic` from React 19 covers the brief optimistic window during drag so the UI does not stutter waiting for the server round-trip. There is no separate client-side state store for persistent data — the database is the single source of truth. See `ARCHITECTURE.md` for full component diagram, project structure, and data flow diagrams.

**Major components:**
1. `app/page.tsx` (Server Component) — async data fetch, renders Board; zero client-side dependencies
2. `components/Board.tsx` (Client Component) — DnD context (`DndContext`), column layout, optimistic state via `useOptimistic`
3. `components/Column.tsx` + `components/Card.tsx` (Client Components) — drop targets, draggable items, card face rendering
4. `components/CardModal.tsx` (Client Component) — full task edit form via `react-hook-form`, calls Server Actions
5. `app/actions/tasks.ts` (Server Actions) — `createTask`, `updateTask`, `moveTask`, `deleteTask`, `reorderTasks`; all writes go here
6. `lib/db/` (server-only) — Prisma schema, DB connection singleton, typed query functions; nothing outside this folder imports Prisma directly
7. `components/ui/` — `PriorityBadge`, `LabelChip`, `DateDisplay` — shared stateless presentational primitives

**Key patterns confirmed:**
- Float-based card ordering (midpoint between neighbors) avoids updating all sibling positions on every drag; reindex after ~50 moves
- `'server-only'` package import guard on `lib/db/index.ts` prevents accidental client bundling
- Drizzle migrations (per ARCHITECTURE.md) / Prisma migrations (per STACK.md) must run before `next start` — build a startup script

**Note on ORM:** STACK.md recommends Prisma; ARCHITECTURE.md uses Drizzle in examples. Both are viable. The recommendation is Prisma for schema-first DX and Prisma Studio. The architecture patterns are identical regardless of ORM choice.

### Critical Pitfalls

1. **Drag-and-drop SSR hydration mismatch** — dnd-kit uses browser APIs unavailable during server render; wrap Board with `dynamic(() => import(...), { ssr: false })`. Must be addressed before any DnD logic is built, not retrofitted. Warning sign: hydration errors in console after `next build && next start`.

2. **SQLite database wiped on redeploy** — relative paths (e.g., `./data/tasks.db`) inside the project directory are destroyed during redeploy. Store the database at an absolute path outside the project (`/var/data/taskboard/tasks.db`), configured via `DATABASE_URL` environment variable. Hard to fix after data is in place.

3. **Static export mode silently disabling Server Actions** — `output: 'export'` produces static HTML with no server; Server Actions fail silently or return 404. Use Node.js server mode (`next build && next start`) from day one. Never set `output: 'export'`.

4. **Nginx buffering breaking streaming / Suspense loading states** — nginx buffers streaming responses by default, making loading skeletons invisible. Add `proxy_buffering off` to the nginx location block. Verify loading states are visible after first deployment.

5. **Standalone output mode missing static asset directories** — `output: 'standalone'` does not copy `public/` and `.next/static/` into the standalone bundle. App starts but has no CSS. Always run `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/` in the deploy script.

## Implications for Roadmap

Based on the combined research, the component dependency graph and pitfall-to-phase mapping both point to the same five-phase structure. This order is not arbitrary — each phase produces a working, verifiable artifact that the next phase builds on.

### Phase 1: Data Foundation

**Rationale:** Everything depends on the data model and server-side infrastructure. The schema drives TypeScript types, which drive Server Actions, which drive UI. Building board components before the data layer produces a fake UI that must be torn apart when real data arrives. The SQLite path convention must be established here — not during deployment — because it determines file system layout that is hard to change with data in place.

**Delivers:** Prisma schema (tasks table with columnId, order float, priority, dueDate, labels, archived fields), DB connection singleton, typed query functions, `getTasks()`, all Server Actions as stubs, shared TypeScript types, `DATABASE_URL` env var convention, migration script.

**Addresses:** Card data model with all MVP fields (title, description, priority, due date, label, archived flag, position float), column definitions as constants.

**Avoids:** SQLite path not persisted across deploys (Pitfall 6); `archived` field must exist from the start even if archive view is deferred — adding it later requires a migration.

**Research flag:** Standard patterns — no deeper research needed. Prisma + SQLite setup is well-documented.

### Phase 2: Board Shell and Core UI

**Rationale:** With the data layer in place, the Server Component page and Client Component boundary can be established correctly. The SSR hydration pitfall must be resolved here — before any drag logic — or it poisons all subsequent board work. UI primitives (PriorityBadge, LabelChip, DateDisplay) should be built before Card so Card can compose them.

**Delivers:** `app/page.tsx` (async Server Component reading real DB data), `components/Board.tsx` shell with correct `dynamic()` + `{ ssr: false }` wrapper, `components/Column.tsx` and `components/Card.tsx` with static layout (no DnD yet), `components/ui/` primitives, `app/loading.tsx` skeleton. Verified: no hydration errors on `next build && next start`.

**Addresses:** Kanban board display with 5 fixed columns, card face with priority badge, due date, overdue indicator, color label — all visible from real DB data.

**Avoids:** Drag-and-drop SSR hydration mismatch (Pitfall 1) — SSR disabled for the board shell before DnD library is integrated; board-as-Server-Component anti-pattern.

**Research flag:** Standard patterns — Next.js App Router Server/Client boundary is well-documented. No deeper research needed.

### Phase 3: Card CRUD

**Rationale:** Card creation, editing, and deletion are the simplest mutations and validate the Server Action pattern before the more complex drag-and-drop ordering logic. `react-hook-form` integration with Server Actions is established here. Confirming `revalidatePath` works correctly after each mutation is a prerequisite for drag-and-drop confidence.

**Delivers:** `AddCardButton` with inline creation, `CardModal` edit form (all fields: title, description, priority, due date, label color), card deletion with confirm dialog, all Server Actions functional (`createTask`, `updateTask`, `deleteTask`), save pending state and error handling in UI.

**Addresses:** Full card CRUD (P1 table stakes), card description (plain text), priority field, due date field, color label field.

**Avoids:** Skipping `revalidatePath` (technical debt — stale data); no visual feedback on save (UX pitfall); priority shown as color only without text label (accessibility pitfall for color-blind users).

**Research flag:** Standard patterns — react-hook-form with Server Actions is documented. No deeper research needed.

### Phase 4: Drag and Drop with Persistence

**Rationale:** DnD is the defining UX of kanban and the highest-complexity feature. It requires the data model (Phase 1), the board shell with correct SSR config (Phase 2), and working Server Actions (Phase 3). The float-based ordering scheme must be implemented correctly from the start — retrofitting it changes the schema and requires a data migration.

**Delivers:** `DndContext` + `SortableContext` wiring, `onDragEnd` handler with `useOptimistic` for immediate UI update, `moveTask` Server Action with float midpoint ordering, `reorderTasks` for periodic reindexing, cross-column card movement verified. Verified: card position survives page refresh (server persistence, not just UI state).

**Addresses:** Drag and drop between columns (P1), card ordering within columns persisted (P1).

**Avoids:** No optimistic updates on drag (UX pitfall — snap-back feels broken); float ordering not established from the start (requires schema migration later).

**Research flag:** May benefit from deeper research during planning for the float ordering algorithm edge cases (when to reindex, collision detection strategy). The dnd-kit docs are comprehensive but the ordering persistence pattern has nuance.

### Phase 5: Deployment and Hardening

**Rationale:** Deployment is a phase, not an afterthought. The infrastructure pitfalls (static export, nginx buffering, standalone asset copy, database path, process user, backup) are all preventable during a structured deployment phase. Each has a known fix; the risk is discovering them in production without a checklist.

**Delivers:** VPS deployment with `output: 'standalone'`, PM2 process manager with correct `npm start` invocation, Nginx reverse proxy with `proxy_buffering off`, SSL via Certbot with auto-renewal cron, UFW firewall blocking port 3000 externally, Node process running as non-root user, automated daily SQLite backup via `rclone`, deploy script including static asset copy commands, full "looks done but isn't" checklist verification.

**Addresses:** Production availability, SSL, streaming behavior, security hardening.

**Avoids:** Static export chosen instead of Node.js server (Pitfall 2); no Nginx reverse proxy (Pitfall 3); Nginx buffering breaks streaming (Pitfall 4); standalone mode missing static dirs (Pitfall 5); process running as root; no backup strategy.

**Research flag:** Standard patterns — Next.js self-hosting guide is comprehensive and verified. Nginx + PM2 setup is well-documented. No deeper research needed.

### Phase 6: Quality-of-Life Features (v1.x)

**Rationale:** After the core workflow is validated in daily use, these features address the friction points that emerge. They are sequenced after deployment because their value depends on real usage revealing where friction actually exists.

**Delivers:** Quick search/filter (client-side, by keyword, label, priority), card archive with archive view, column card count badge, keyboard shortcuts (N for new card, Enter to open modal, Escape to close).

**Addresses:** P2 features from FEATURES.md — all straightforward additions on top of the established patterns.

**Avoids:** Building features before their value is confirmed; card edit modal keyboard trap (accessibility — Escape key must close modal, established here if not in Phase 3).

**Research flag:** Standard patterns. No deeper research needed.

### Phase Ordering Rationale

- **Data before UI:** The schema determines the TypeScript types that flow through every layer. UI built on placeholder types must be rebuilt when real types arrive.
- **SSR config before DnD:** The hydration mismatch pitfall poisons all subsequent board work if not fixed first. It takes 15 minutes to fix but requires rebuilding DnD logic if discovered late.
- **CRUD before drag:** Server Action + `revalidatePath` pattern must be validated on simple mutations before building the optimistic drag state machine on top.
- **Deployment as a phase:** The infrastructure pitfalls are sequential and each has a known fix. A structured deployment phase with a verification checklist prevents discovering them in production.
- **v1.x features after validation:** All P2 features depend on real usage confirming they're actually needed. Quick search is useless with 10 cards; it's valuable with 100.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Drag and Drop):** Float-based ordering edge cases — when to reindex, how to handle rapid concurrent moves, dnd-kit collision detection configuration for multi-column layouts. Recommend `/gsd:research-phase` before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Data Foundation):** Prisma + SQLite setup is exhaustively documented.
- **Phase 2 (Board Shell):** Next.js App Router Server/Client boundary pattern is canonical and well-documented.
- **Phase 3 (Card CRUD):** react-hook-form + Server Actions pattern is documented and stable.
- **Phase 5 (Deployment):** Next.js self-hosting guide directly covers every required step.
- **Phase 6 (Quality-of-Life):** All features are standard additions; no novel patterns required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technology versions verified against official GitHub releases and docs (2026-02-27/28). No version conflicts found. |
| Features | HIGH (table stakes) / MEDIUM (differentiators) | Table stakes stable across the industry for 10+ years. Differentiator recommendations are opinionated from project constraints; no live competitor data fetched during research (WebSearch unavailable). |
| Architecture | HIGH | All patterns sourced from Next.js official docs v16.1.6 (updated 2026-02-27). Server Component / Server Action pattern is the documented canonical approach. |
| Pitfalls | HIGH (infrastructure) / MEDIUM (domain patterns) | Infrastructure pitfalls sourced from Next.js official deployment docs. Domain patterns (DnD ordering, optimistic UI) from training knowledge, consistent with official sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **ORM choice inconsistency:** STACK.md recommends Prisma 7; ARCHITECTURE.md examples use Drizzle. The architecture patterns are identical for either ORM. Recommend resolving in Phase 1 by committing to Prisma (stronger DX for schema-first design) and updating project files to reflect that choice.

- **Feature MVP validation:** The MVP feature set is opinionated from project constraints and industry patterns, not validated with an actual user. The specific Finnish column names confirm a real user, but priorities (due date, color labels) should be confirmed before Phase 3 implementation.

- **Float ordering specifics:** The STACK.md and ARCHITECTURE.md both recommend float midpoint ordering for card positions but do not specify the reindex threshold (suggested: ~50 moves) or the initial spacing value. This gap should be addressed during Phase 4 planning.

- **No live competitor research:** WebSearch was unavailable during feature research. The competitor feature analysis is based on training knowledge of Trello, Wekan, and Planka. This is acceptable for table stakes; less certain for differentiator gaps.

## Sources

### Primary (HIGH confidence)
- Next.js 16.1.6 official docs (fetched 2026-02-27) — layouts, data fetching, Server Actions, self-hosting, deployment, standalone output, hydration errors, project structure
- Next.js 16 release blog — version confirmation, Node.js 20.9+ requirement
- @dnd-kit/core GitHub v6.3.1 — React peer dependency, active maintenance (Feb 2026 release)
- @dnd-kit/sortable GitHub v10.0.0 — version confirmation
- Prisma GitHub v7.4.2 (2026-02-27) — SQLite support, Node.js 18+ requirement
- Zustand GitHub v5.0.11 (2026-02-01) — React 18+ requirement
- Tailwind CSS GitHub v4.2.1 (2026-02-23) — @tailwindcss/postcss plugin pattern
- TypeScript GitHub v5.9.3 — version confirmation
- React GitHub v19.2.4 (2026-01-26) — version confirmation
- PM2 GitHub v6.0.14 (2025-11-26) — version confirmation
- react-hook-form GitHub v7.71.2 (2026-02-20) — version confirmation
- React official docs — StrictMode, useOptimistic

### Secondary (MEDIUM confidence)
- Training knowledge of Trello, Wekan, Planka feature sets — competitor feature analysis
- Training knowledge of Linear, Notion, GitHub Projects — differentiator comparison
- Personal kanban methodology (David J. Anderson) — table stakes theory
- hello-pangea/dnd GitHub v18.0.1 (2025-02-09) — confirmed active, noted as react-beautiful-dnd fork

### Tertiary (LOW confidence)
- Hostinger Next.js Deploy Template (referenced in Next.js official docs, not directly verified) — deployment pattern confirmation

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
