# Stack Research

**Domain:** Personal kanban task management web app (single-user, self-hosted VPS)
**Researched:** 2026-02-28
**Confidence:** HIGH — core technologies verified against official docs and GitHub releases

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Full-stack React framework | User-specified requirement; App Router provides server-side API routes + React Server Components in one process; `output: "standalone"` produces a self-contained Node.js bundle ideal for VPS deployment. No Vercel dependency required. |
| React | 19.2.4 | UI rendering | Ships with Next.js 16; React 19 is stable and required by Next.js 16's App Router. Concurrent rendering, Server Components, and improved hydration all benefit a data-heavy kanban UI. |
| TypeScript | 5.9.3 | Type safety | Default in create-next-app; Next.js 16 requires TS 5.1+. Catches column/card shape mismatches at compile time — critical for a data-model-heavy app. |
| Tailwind CSS | 4.2.1 | Utility-first CSS | Default in create-next-app for Next.js 16; v4 uses CSS-based config (@import "tailwindcss") instead of a JS config file — simpler setup. Fast iteration on card/board UI with zero runtime overhead. |
| Prisma | 7.4.2 | Database ORM | Type-safe, auto-generated client; SQLite adapter works out-of-the-box for single-user VPS; schema migrations via `prisma migrate` replace manual SQL; Prisma Studio provides a GUI for debugging data. |
| SQLite (via Prisma) | bundled | Persistent task storage | No separate database process on VPS; file-based — tasks persist across server restarts; zero maintenance; more than sufficient for single-user, low-concurrency workload. Only upgrade to Postgres if read/write volume or concurrent access grows. |

### Drag & Drop

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @dnd-kit/core | 6.3.1 | Drag & drop primitives | Actively maintained (last release Feb 2026); built for React; accessible (ARIA, keyboard nav); no React version constraints (supports React 16.8+); modular — use only what you need. |
| @dnd-kit/sortable | 10.0.0 | Sortable list/column ordering | Companion to core; provides `useSortable`, `SortableContext`, and pre-built collision detection for reordering cards within a column. Required for the kanban drag behavior. |
| @dnd-kit/utilities | 3.2.2 | CSS transform helpers | Ships with core; provides `CSS.Transform.toString()` and `CSS.Transition.toString()` for smooth card animation during drag. |

### State Management

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Zustand | 5.0.11 | Client-side state | Minimal boilerplate compared to Redux; no Context providers required; hook-based API fits React 19 patterns well; handles optimistic UI updates for drag operations before server persistence. For a single-user kanban, Zustand is the right scale — React Query or SWR alone would handle server state, but optimistic drag-and-drop state benefits from an in-memory store. |

### Data Fetching / Server State

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js Server Actions | built-in | Mutations (create/update/delete cards and columns) | Use for all write operations — no separate API layer needed; type-safe RPC from client components to server. |
| Next.js fetch (RSC) | built-in | Server-side data loading | Load initial board state in a React Server Component; no client-side data fetching library needed for initial render. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | 7.71.2 | Form state for card edit modal | Controlled inputs for card title, description, priority, dates, labels; integrates with Server Actions via the `action` prop pattern; avoids re-render-heavy controlled state. |
| date-fns | latest stable (^4.x) | Date formatting and comparison | Lightweight; no moment.js overhead; format due dates on cards, calculate overdue status. Tree-shaken — only import what you use. |
| clsx | latest stable (^2.x) | Conditional className composition | Standard utility for conditional Tailwind classes on card priority/color states; pairs with Tailwind's `cn()` pattern. |
| tailwind-merge | latest stable (^2.x) | Merge Tailwind classes safely | Prevents duplicate class conflicts when composing component variants; used with clsx in the `cn()` helper. |

### Infrastructure & Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20.9+ LTS | Runtime | Next.js 16 minimum requirement; LTS ensures security patches through 2026. Use nvm on the VPS for version management. |
| PM2 | 6.0.14 | Process management on VPS | Keeps the Next.js Node.js process alive after crashes; auto-restarts on VPS reboot; built-in log management; `ecosystem.config.js` for reproducible start config. Systemd is an alternative but PM2 is simpler for Node.js apps. |
| Nginx | latest stable | Reverse proxy | Official Next.js recommendation for self-hosting; handles SSL termination, compression, rate limiting, and `X-Accel-Buffering: no` for streaming responses. Offloads these concerns from the Next.js process. |
| Certbot / Let's Encrypt | latest | SSL certificates | Free, auto-renewable TLS for the custom domain; pairs with Nginx. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turbopack | Dev bundler (default in Next.js 16) | Default bundler in Next.js 16; up to 10x faster Fast Refresh than Webpack; no configuration needed. Used automatically with `next dev`. |
| ESLint | Linting | Default in create-next-app; includes `@next/eslint-plugin-next` for Next.js-specific rules. Next.js 16 uses flat config format. |
| Prettier | Code formatting | Not included by default — add manually; pairs with ESLint. |
| Prisma Studio | Database GUI | Built into Prisma CLI (`npx prisma studio`); useful for inspecting/editing tasks during development. |

---

## Installation

```bash
# Bootstrap project (Next.js 16 with TypeScript, Tailwind v4, ESLint, App Router, Turbopack)
npx create-next-app@latest taskboard --typescript --tailwind --eslint --app --turbopack
cd taskboard

# Drag & drop
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# State management
npm install zustand

# Forms
npm install react-hook-form

# Date utilities
npm install date-fns

# Class composition
npm install clsx tailwind-merge

# Database (Prisma + SQLite)
npm install prisma @prisma/client
npx prisma init --datasource-provider sqlite

# Dev dependencies
npm install -D @types/node
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| @dnd-kit/core | react-beautiful-dnd | Atlassian has officially deprecated react-beautiful-dnd; no React 18+ support; known issues with Strict Mode. Dead library. |
| @dnd-kit/core | hello-pangea/dnd | Community fork of react-beautiful-dnd (v18.0.1); kept alive but carries the same architectural constraints; smaller ecosystem than dnd-kit. Use only if migrating an existing react-beautiful-dnd project. |
| @dnd-kit/core | HTML5 Drag and Drop API (native) | Cross-browser inconsistencies; no touch support; poor accessibility; complex sorting logic must be hand-rolled. |
| SQLite + Prisma | PostgreSQL + Prisma | Overkill for single-user; requires a separate process on VPS; adds connection management overhead. Upgrade path is straightforward if needs change — just change the Prisma `datasource` block. |
| SQLite + Prisma | JSON file (fs) | No transactions, no querying, no schema validation, no migrations. Breaks under any concurrent writes. |
| SQLite + Prisma | Drizzle ORM | Drizzle is a solid alternative (lighter, SQL-first); choose Drizzle if you prefer writing SQL and want a smaller dependency. Prisma wins on DX for schema-first design and Prisma Studio. |
| Zustand | Redux Toolkit | RTK is overkill for single-user kanban; 5x more boilerplate; designed for larger teams. |
| Zustand | Jotai | Atom-based; good for deeply nested component state; Zustand's store model is more natural for board-level state shared across columns. |
| Zustand | React Context + useReducer | Fine for small apps; context rerenders entire subtree on state change — problematic for large boards where drag updates card positions frequently. |
| Next.js Server Actions | tRPC | tRPC adds a separate API layer and router setup; Server Actions achieve the same type-safe RPC with no additional library. For a single-user personal app, Server Actions are simpler. |
| PM2 | systemd | Both work; PM2 is more portable and Node.js-native; systemd requires root access and is Linux-specific. |
| Tailwind CSS v4 | CSS Modules | Tailwind wins on iteration speed for component-heavy UI; CSS Modules are better when design tokens need to be shared with external systems (not applicable here). |
| Tailwind CSS v4 | styled-components / Emotion | CSS-in-JS adds runtime overhead and hydration complexity with React Server Components; Tailwind generates static CSS at build time. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| react-beautiful-dnd | Officially deprecated by Atlassian; not compatible with React 18/19 Strict Mode; will not receive bug fixes | @dnd-kit/core + @dnd-kit/sortable |
| Next.js Pages Router | App Router is the current standard in Next.js 16; Pages Router is in maintenance mode; Server Actions not available in Pages Router | App Router (default in create-next-app) |
| `moment.js` | Massive bundle size (232KB); effectively unmaintained; recommends migration to lighter alternatives | date-fns (tree-shakeable, ~2-5KB per function) |
| `mongoose` / MongoDB | Document store adds unnecessary complexity for structured kanban data; SQLite provides proper relational queries | Prisma + SQLite |
| External database services (PlanetScale, Supabase, Neon) | Introduce cloud dependencies and network latency; violate the self-hosted VPS constraint; add cost | SQLite on local disk via Prisma |
| Vercel-specific features (Vercel KV, Vercel Blob, Edge Functions at Vercel) | App is deployed on Hostinger VPS, not Vercel; these are Vercel-only APIs | Filesystem cache (Next.js default), local SQLite, PM2 |
| `next export` (static export mode) | Disables Server Actions, API routes, and server-side rendering — all required for database persistence and mutations | Node.js server mode (`next build && next start`) |
| React Query / SWR | Unnecessary for this project — Next.js RSC handles initial server-side data fetching; Server Actions handle mutations; adding a client cache layer adds complexity without benefit for a single-user app | Next.js RSC + Server Actions |

---

## Stack Patterns by Variant

**For drag-and-drop between columns (cross-column card movement):**
- Use `DndContext` from `@dnd-kit/core` at the board level
- Use `SortableContext` from `@dnd-kit/sortable` per column
- Handle `onDragEnd` to dispatch optimistic Zustand state update immediately, then call a Server Action to persist
- Revert Zustand state if the Server Action throws

**For card position persistence:**
- Store `position` as a float on each card (1.0, 2.0, 3.0...)
- On reorder, calculate midpoint between neighbors (e.g., 1.5 between 1.0 and 2.0)
- Reindex periodically when floats get too close (after ~50 moves)
- This avoids updating all sibling positions on every drag

**For VPS deployment:**
- Build: `next build` (produces `.next/standalone` with `output: "standalone"`)
- Run: PM2 with `NODE_ENV=production node .next/standalone/server.js`
- Proxy: Nginx → `http://localhost:3000`
- Process restart: `pm2 startup` + `pm2 save` for boot persistence

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 16.x | React 19.2.x | Next.js 16 App Router requires React 19 |
| Next.js 16.x | Node.js 20.9+ | Node.js 18 dropped in Next.js 16 |
| @dnd-kit/core 6.3.x | React 16.8+ | Supports React 18 and 19 |
| @dnd-kit/sortable 10.0.0 | @dnd-kit/core 6.x | Must use matching major versions |
| Prisma 7.x | Node.js 18+ | Prisma 7 dropped Node 16 |
| Tailwind CSS 4.x | Next.js 16 | Use `@tailwindcss/postcss` plugin (not `tailwind-postcss` v3 config) |
| Zustand 5.x | React 18+ | Zustand v5 uses React 18+ useSyncExternalStore |
| TypeScript 5.9.x | Next.js 16 | Next.js 16 requires TS 5.1+ |

---

## Sources

- Next.js 16 official release blog — https://nextjs.org/blog/next-16 — version 16.1.6 confirmed, Node.js 20.9+ requirement, standalone output, self-hosting guide verified HIGH confidence
- Next.js self-hosting guide — https://nextjs.org/docs/app/guides/self-hosting — Nginx reverse proxy recommendation, PM2 pattern, streaming config verified HIGH confidence
- Next.js docs version header `version: 16.1.6, lastUpdated: 2026-02-27` — confirmed current stable version HIGH confidence
- @dnd-kit/core GitHub (package.json, releases) — v6.3.1 confirmed, React peer dep ≥16.8.0, active maintenance (Feb 2026 releases) HIGH confidence
- @dnd-kit/sortable GitHub (package.json) — v10.0.0 confirmed HIGH confidence
- Prisma GitHub releases — v7.4.2 released 2026-02-27, SQLite support confirmed HIGH confidence
- Zustand GitHub releases — v5.0.11 released 2026-02-01 HIGH confidence
- Tailwind CSS GitHub releases — v4.2.1 released 2026-02-23 HIGH confidence
- Tailwind CSS Next.js installation guide — @tailwindcss/postcss pattern for Next.js confirmed HIGH confidence
- TypeScript GitHub releases — v5.9.3 HIGH confidence
- React GitHub releases — v19.2.4 released 2026-01-26 HIGH confidence
- PM2 GitHub releases — v6.0.14 released 2025-11-26 HIGH confidence
- hello-pangea/dnd GitHub releases — v18.0.1 released 2025-02-09, confirmed active but noted as react-beautiful-dnd fork MEDIUM confidence
- react-hook-form GitHub releases — v7.71.2 released 2026-02-20 HIGH confidence

---
*Stack research for: Personal kanban task management web app (React/Next.js, drag & drop, self-hosted VPS)*
*Researched: 2026-02-28*
