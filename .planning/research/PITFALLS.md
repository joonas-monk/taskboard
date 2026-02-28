# Pitfalls Research

**Domain:** Personal Kanban / Task Board (Next.js + VPS)
**Researched:** 2026-02-28
**Confidence:** HIGH (Next.js official docs) / MEDIUM (domain patterns from training data, aligned with verified sources)

---

## Critical Pitfalls

### Pitfall 1: Drag-and-Drop Library SSR Hydration Mismatch

**What goes wrong:**
Drag-and-drop libraries like dnd-kit and react-beautiful-dnd depend on browser APIs (pointer events, touch events, DOM measurements) that do not exist on the server. When Next.js pre-renders a page server-side and the client hydrates, the drag handles or sensor setup differs between server HTML and client DOM, causing React hydration errors: "Text content does not match server-rendered HTML."

**Why it happens:**
Next.js App Router pre-renders all Server Components. If a drag-and-drop component is imported into the component tree without disabling SSR, Next.js attempts to render it server-side where `window`, `document`, and pointer events are undefined. Developers assume client-only libraries "just work" in Next.js without understanding SSR implications.

**How to avoid:**
Wrap drag-and-drop components with `dynamic()` and `{ ssr: false }`:
```tsx
import dynamic from 'next/dynamic'

const KanbanBoard = dynamic(() => import('@/components/KanbanBoard'), {
  ssr: false,
  loading: () => <p>Loading board...</p>
})
```
Mark the entire board shell as a Client Component (`'use client'`) and ensure drag context providers are only mounted client-side.

**Warning signs:**
- "Hydration mismatch" errors in browser console on first load
- Board renders correctly in `next dev` but fails in `next build && next start`
- Drag handles appear then disappear on page load

**Phase to address:**
Foundation phase — when wiring up the kanban board component for the first time. Do not defer this to a later phase; SSR configuration must be correct before any drag-and-drop logic is built on top.

---

### Pitfall 2: Choosing `output: 'export'` (Static Export) Instead of Node.js Server

**What goes wrong:**
Static export (`output: 'export'` in next.config.js) generates plain HTML/CSS/JS files with no server. This disables Server Actions, API Routes, Image Optimization, ISR, streaming, and any server-side data persistence. A kanban app needs persistent storage; static export cannot write to a database or file system.

**Why it happens:**
The Hostinger VPS supports static file serving and developers assume "export and serve with nginx" is simpler. The error only surfaces at runtime when mutations fail silently or API routes return 404.

**How to avoid:**
Use `next start` (Node.js server mode) on the VPS. Run the app as a persistent process behind nginx acting as reverse proxy. Never set `output: 'export'` for any app that persists data.

Correct deployment flow:
```bash
npm run build         # next build
pm2 start npm --name "taskboard" -- start   # next start via pm2
# nginx proxies :80/:443 → :3000
```

**Warning signs:**
- You find yourself configuring nginx to serve the `.next` folder directly as static files
- API routes return 404 in production even though they work in `next dev`
- `next build` succeeds but server actions fail at runtime

**Phase to address:**
Deployment phase — but the decision must be locked in during the foundation phase. Set up the correct `package.json` scripts and `next.config.js` from the start. Do not experiment with static export.

---

### Pitfall 3: No Nginx Reverse Proxy — Exposing Next.js Directly on Port 80/443

**What goes wrong:**
Running `next start` on port 80 directly (or exposing port 3000 to the internet) bypasses all HTTP hardening that a reverse proxy provides. Next.js does not handle slow connection attacks, oversized payloads, rate limiting, or SSL termination by itself. The app is fragile to malformed requests even for a single user.

**Why it happens:**
Single-user apps feel low-risk. Developers skip nginx to reduce setup complexity, especially on a fresh VPS where direct port binding seems simpler.

**How to avoid:**
Always run Next.js behind nginx. Nginx handles:
- SSL termination (certbot/Let's Encrypt)
- `proxy_pass http://localhost:3000`
- `proxy_buffering off` (required for Next.js streaming/Suspense — see below)
- Payload size limits and connection timeouts

Minimal nginx config for Next.js:
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;   # Required for streaming
    }
}
```

**Warning signs:**
- App running directly on port 80 or 3000 exposed to internet
- No SSL certificate configured
- Streaming responses or loading states appear frozen in browser (nginx buffering enabled)

**Phase to address:**
Deployment phase — first deployment. Never skip nginx even for a personal tool.

---

### Pitfall 4: Nginx Buffering Breaks Next.js Streaming / Suspense Loading States

**What goes wrong:**
When nginx has `proxy_buffering on` (the default), streaming responses from Next.js are buffered entirely before being sent to the client. This means Suspense loading states and React Server Component streaming appear to "hang" — the user sees a blank page until the full response is assembled rather than seeing incremental content.

**Why it happens:**
Nginx buffering is on by default as an optimization for traditional servers. Next.js App Router uses HTTP streaming extensively, and the interaction is not obvious without reading Next.js deployment documentation.

**How to avoid:**
Add `proxy_buffering off` to nginx location block, or configure Next.js to set the `X-Accel-Buffering: no` response header:

```js
// next.config.js
module.exports = {
  async headers() {
    return [{
      source: '/:path*{/}?',
      headers: [{ key: 'X-Accel-Buffering', value: 'no' }]
    }]
  }
}
```

**Warning signs:**
- Loading spinners/skeletons never appear; page loads all at once with a long delay
- Works correctly in `next dev` but not in production behind nginx
- Browser network tab shows response "pending" for full duration then arrives complete

**Phase to address:**
Deployment phase — verify streaming behavior immediately after first nginx configuration.

---

### Pitfall 5: Standalone Output Mode Missing `public/` and `.next/static/` Directories

**What goes wrong:**
When using `output: 'standalone'` in next.config.js (the recommended mode for Docker/VPS deployment), `next build` creates a `.next/standalone` folder with a minimal `server.js`. However, the `public/` directory and `.next/static/` directory are NOT automatically copied into `standalone/`. The app starts, API routes work, but all static assets (CSS, JS bundles, images) return 404.

**Why it happens:**
The Next.js docs note that these folders "should ideally be handled by a CDN." On a VPS without a CDN, developers forget to manually copy them. The error is silent until you open a browser and see a broken app.

**How to avoid:**
After `next build`, always run:
```bash
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```
Include this in your deploy script. Or skip standalone mode and use standard `next start`, which serves these automatically.

**Warning signs:**
- App "works" (responds to requests) but has no CSS styling
- Browser DevTools shows 404 for `/\_next/static/...` paths
- Images from the `public/` folder are missing

**Phase to address:**
Deployment phase — add to the deploy script checklist and verify visually after first deploy.

---

### Pitfall 6: SQLite Database File Not Persisted Across Deployments / Restarts

**What goes wrong:**
If the database file path is relative to the project directory or placed inside `.next/`, it gets wiped on `next build` or when the deployment directory is replaced. All tasks are lost on every redeploy.

**Why it happens:**
SQLite is file-based. Developers often use a path like `./data/tasks.db` without thinking through where that resolves on the VPS, or they place the DB inside the project directory that gets blown away during CI/CD.

**How to avoid:**
- Store the database at an absolute path outside the project directory: `/var/data/taskboard/tasks.db`
- Set the path via environment variable: `DATABASE_URL=/var/data/taskboard/tasks.db`
- Ensure the path exists and has correct permissions before starting the app
- Never reference a database path relative to `process.cwd()` that could be inside the build output

**Warning signs:**
- Tasks are present after restart but disappear after redeploy
- `next build` runs cleanly but the database is empty on next visit
- Database file appears inside the `.next/` directory

**Phase to address:**
Data persistence phase — establish the database path convention before writing any persistence logic. This decision is hard to change later without data migration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store tasks in `localStorage` only | No server needed, instant | Data loss on browser clear, no cross-device access, no backup | Never for primary storage; acceptable as optimistic UI cache |
| Use `process.env` directly in client components without `NEXT_PUBLIC_` prefix | Feels simpler | Variable is undefined at runtime in browser — silent failure, not a build error | Never |
| Hardcode column definitions as constants instead of DB-driven | Simpler initial code | Adding/reordering columns requires a code deploy, not a UI change | Acceptable for MVP if columns are truly fixed |
| Skip `revalidatePath`/`revalidateTag` after mutations | Mutations work | UI shows stale data after card moves until manual page refresh | Never — stale data in a task board destroys trust |
| Use `npm run dev` on VPS instead of `npm run build && npm run start` | Faster initial setup | Dev server is slow, unoptimized, not production-safe; hot reload wastes memory | Never in production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SQLite via better-sqlite3 | Installing on macOS, deploying to Linux — native binary mismatch causes startup crash | Build on the target Linux architecture, or use `--ignore-scripts` + rebuild on VPS |
| Nginx + Next.js | Setting `proxy_pass http://localhost:3000/` with trailing slash — breaks Next.js routing for subpaths | Use `proxy_pass http://localhost:3000` without trailing slash |
| PM2 process manager | Running `pm2 start next` without specifying the `start` script — PM2 runs `next dev` | Use `pm2 start npm --name "taskboard" -- start` or a proper ecosystem.config.js |
| Environment variables | Setting `NEXT_PUBLIC_*` vars in `.env.local` and expecting them on VPS | `.env.local` is gitignored and not on the VPS; set vars in `/etc/environment` or PM2 ecosystem config |
| Let's Encrypt SSL | Forgetting to set up auto-renewal via `certbot renew` cron | Add `0 12 * * * /usr/bin/certbot renew --quiet` to crontab at deployment time |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-rendering entire board on every card move | Visible lag/flicker during drag; CPU spike in DevTools | Use `React.memo` on card components; keep drag state local to board, not global | At ~20+ cards with complex card content |
| Loading all tasks in a single Server Component without `Suspense` | Entire board is blank until all data loads | Wrap board sections in `<Suspense>` with skeleton fallbacks | Even at 10 tasks if DB query is slow |
| Using `revalidatePath('/')` to invalidate after every mutation | Full-page rerender on every card move, slow perceived performance | Use targeted `revalidateTag` for specific data, or use optimistic updates with `useOptimistic` | Immediately noticeable in production |
| Sharp (image optimization) on low-RAM VPS without memory config | VPS OOM kills the Node process mid-request | Add `MALLOC_ARENA_MAX=2` env var on glibc Linux; or disable image optimization if not needed | Under any significant image load |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No authentication because "VPS is secured" — but app is on port 3000 accessible if firewall misconfigured | Anyone who can reach port 3000 can read/write all tasks | Use UFW/iptables to block port 3000 externally; only nginx on 80/443 is public-facing |
| Storing sensitive task content with no backup | Single disk failure loses all data | Set up automated daily SQLite backup to offsite storage (e.g., `rclone` to cloud) |
| Running the Node.js process as root | Compromised app = full server compromise | Create a dedicated non-root user (`taskboard`), run PM2 and the app as that user |
| No rate limiting on API routes | Trivial to flood the server even from one machine | Add nginx `limit_req_zone` rate limiting for `/api/` paths |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No optimistic updates on drag-and-drop | Card snaps back, then jumps to new position after server roundtrip — feels broken | Apply position change immediately in local state, confirm with server in background |
| Card edit modal blocks drag-and-drop (keyboard trap or overlay issues) | User cannot close modal without mouse click; drag targets invisible | Use accessible dialog with `Escape` key close; ensure modal is outside drag context |
| No visual feedback when saving (title edit, label change) | User doesn't know if their change was saved — edits again, double-saves | Show pending state during Server Action, success/error toast on completion |
| Priority indicator uses color only (no text/icon) | Color-blind users cannot distinguish priorities | Always pair color with a text label or icon: "High", "Medium", "Low" |
| Dates displayed in ISO format (`2026-02-28`) instead of relative or locale format | Finnish-speaking user has to parse date math manually | Display as relative ("in 3 days", "overdue") or Finnish locale date |

---

## "Looks Done But Isn't" Checklist

- [ ] **Drag and drop:** Verify cards stay in new position after page refresh — confirms server persistence, not just UI state
- [ ] **Data persistence:** Kill and restart the Node process (`pm2 restart taskboard`), verify all tasks survive
- [ ] **Column reordering:** If columns are user-configurable, verify order persists — a common "almost works" bug
- [ ] **Card labels:** Verify labels render correctly after reload, not just during the session
- [ ] **Error handling:** Submit a card with an empty title — verify the UI shows an error, not a silent failure or crashed page
- [ ] **Production build:** Run `next build && next start` locally before deploying — dev mode hides many production-only bugs
- [ ] **SSL:** Verify `https://` works and `http://` redirects to `https://` — not just "nginx is running"
- [ ] **Streaming:** Confirm loading skeletons appear (not blank page) by artificially delaying the DB query in dev

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hydration mismatch from drag-and-drop | LOW | Add `dynamic(() => ..., { ssr: false })` wrapper; takes 15 minutes |
| Wrong output mode (static export) | MEDIUM | Remove `output: 'export'` from next.config.js, rebuild, reconfigure nginx to proxy instead of serve static |
| Database wiped on redeploy | HIGH | Restore from backup (if exists); establish absolute path convention immediately; no automated recovery if no backup |
| Nginx buffering breaking streaming | LOW | Add `proxy_buffering off` to nginx config, reload nginx (`nginx -s reload`) |
| Standalone mode missing static assets | LOW | Run cp commands, restart server; takes under 5 minutes once you know the cause |
| Node process running as root | MEDIUM | Create service user, change file ownership, update PM2 config, restart — 30–60 minutes |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Drag-and-drop SSR hydration mismatch | Foundation / Board Setup | `next build && next start` locally; no console errors on first load |
| Static export chosen instead of Node.js server | Foundation | `next.config.js` reviewed; `output: 'standalone'` or no output setting; API routes respond in prod |
| No nginx reverse proxy | Deployment | curl request to port 80 returns the app; port 3000 not reachable externally |
| Nginx buffering breaks streaming | Deployment | Loading skeleton visible in browser before data appears |
| Standalone mode missing static dirs | Deployment | All CSS/JS assets return 200; no 404 in DevTools network tab |
| SQLite path not persisted across deploys | Data Persistence / Foundation | Redeploy, verify tasks still present; `DATABASE_URL` in env, not hardcoded |
| No optimistic updates on drag | UX / Card Mutation | Drag card, observe no visual snap-back; confirm position after page refresh |
| Nginx not rate-limiting API routes | Deployment / Hardening | nginx config includes `limit_req_zone` for `/api/` |
| No backup strategy for SQLite | Deployment | Automated backup cron job verified; test restore once |
| Process running as root | Deployment | `ps aux | grep node` shows non-root user |

---

## Sources

- Next.js official docs — Self-hosting guide: https://nextjs.org/docs/app/guides/self-hosting (HIGH confidence — verified 2026-02-27)
- Next.js official docs — Deployment overview: https://nextjs.org/docs/app/getting-started/deploying (HIGH confidence — verified 2026-02-27)
- Next.js official docs — Output file tracing / standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output (HIGH confidence — verified 2026-02-27)
- Next.js official docs — Hydration error causes: https://nextjs.org/docs/messages/react-hydration-error (HIGH confidence — verified 2026-02-27)
- Next.js official docs — Caching and revalidation: https://nextjs.org/docs/app/getting-started/caching-and-revalidating (HIGH confidence — verified 2026-02-27)
- Next.js official docs — Updating data (Server Actions): https://nextjs.org/docs/app/getting-started/updating-data (HIGH confidence — verified 2026-02-27)
- React official docs — StrictMode double-invoke behavior: https://react.dev/reference/react/StrictMode (HIGH confidence)
- Personal kanban domain patterns: training data on Trello-like app architecture (MEDIUM confidence — consistent with verified sources)

---
*Pitfalls research for: Personal Kanban Task Board (Next.js + Hostinger VPS)*
*Researched: 2026-02-28*
