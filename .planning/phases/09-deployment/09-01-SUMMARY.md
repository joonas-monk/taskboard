---
phase: 09-deployment
plan: "01"
subsystem: deployment
tags: [deployment, pm2, nginx, standalone, sqlite]
dependency_graph:
  requires: []
  provides: [deployment-config, pm2-ecosystem, nginx-proxy, deploy-script, env-template]
  affects: [next.config.ts, ecosystem.config.js, deploy.sh, nginx/taskboard.conf, .env.example, .gitignore]
tech_stack:
  added: [PM2 ecosystem config, Nginx reverse proxy, dotenv]
  patterns: [standalone-output, fork-mode-pm2, nginx-reverse-proxy, env-example-pattern]
key_files:
  created:
    - ecosystem.config.js
    - deploy.sh
    - nginx/taskboard.conf
    - .env.example
  modified:
    - next.config.ts
    - .gitignore
key_decisions:
  - "PM2 fork mode (not cluster) required for SQLite — better-sqlite3 is not concurrency-safe across processes"
  - "ecosystem.config.js loads .env.production via require('dotenv').config() — more reliable than PM2 env_file option"
  - "PM2 cwd set to project root not .next/standalone — pipeline worker resolves tsx from process.cwd()"
  - "next.config.ts outputFileTracingIncludes covers better-sqlite3, Prisma adapter, and generated client"
  - "nginx proxy_read_timeout 300s — AI pipeline Server Actions can take 30-120 seconds"
metrics:
  duration: "~1 minute"
  completed: "2026-03-01"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 9 Plan 1: Deployment Configuration Files Summary

**One-liner:** Next.js standalone build config + PM2 fork-mode ecosystem + Nginx reverse proxy template + automated deploy script committed to version control for VPS deployment.

## What Was Built

All deployment configuration files needed to run TaskBoard on a Hostinger VPS with PM2, Nginx, and Let's Encrypt, created as version-controlled files in the repository.

### Files Created

| File | Purpose |
|------|---------|
| `next.config.ts` | Standalone output mode + `outputFileTracingIncludes` for native modules |
| `ecosystem.config.js` | PM2 process config: fork mode, single instance, all env vars from `.env.production` |
| `deploy.sh` | 6-step idempotent redeploy script: pull → install → generate → migrate → build → restart |
| `nginx/taskboard.conf` | Reverse proxy template with 300s timeout and HTTPS redirect (Certbot fills SSL certs) |
| `.env.example` | Environment variable documentation with placeholder values (committed to git) |
| `.gitignore` | Added `!.env.example` exception to allow template while keeping `.env.production` secret |

## Tasks Completed

### Task 1: Next.js standalone config + PM2 ecosystem + env template

Updated `next.config.ts` to enable standalone output mode with `outputFileTracingIncludes` to ensure native modules (better-sqlite3, Prisma adapter, generated client) are traced into the standalone bundle. Created `ecosystem.config.js` with fork mode, single instance, dotenv loading, and all required env vars (DATABASE_URL, ANTHROPIC_API_KEY, PIPELINE_MODEL, PORT, HOSTNAME, HOME, PATH). Created `.env.example` documenting all 6 required variables.

**Commit:** 714e651

### Task 2: Deploy script + Nginx config template + gitignore update

Created `deploy.sh` as a 6-step idempotent bash script: git pull, npm ci, prisma generate, prisma migrate deploy, npm run build with static asset copying into standalone, then pm2 restart. Created `nginx/taskboard.conf` with full reverse proxy config including 300s timeout for AI pipeline Server Actions and HTTPS redirect. Updated `.gitignore` to allow `.env.example` via `!.env.example` exception (also applied in Task 1 commit because it was blocking the commit).

**Commit:** 0d4f937

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added !.env.example to .gitignore during Task 1**

- **Found during:** Task 1 commit
- **Issue:** `.env*` pattern in `.gitignore` caught `.env.example`, preventing it from being staged for commit
- **Fix:** Added `!.env.example` exception to `.gitignore` and included the gitignore change in the Task 1 commit (rather than waiting for Task 2)
- **Files modified:** `.gitignore`
- **Commit:** 714e651

## Key Design Decisions

1. **Fork mode mandatory for SQLite:** `better-sqlite3` is not concurrency-safe across multiple OS processes. PM2 cluster mode spawns multiple full copies of the app — each with its own WAL connection — causing `SQLITE_BUSY` errors or data corruption. Fork mode with a single instance is the only safe configuration.

2. **dotenv in ecosystem.config.js:** PM2's `env_file` option has inconsistent behavior across versions. Loading `.env.production` via `require('dotenv').config()` at the top of the ecosystem file is evaluated at `pm2 start` time and reliably populates the `env:` block before PM2 reads it.

3. **PM2 cwd = project root, not standalone folder:** The pipeline worker resolves tsx as `path.resolve(process.cwd(), 'node_modules/.bin/tsx')`. If PM2's cwd were `.next/standalone`, this path would be invalid. The server.js script path is relative to cwd, so `.next/standalone/server.js` works correctly from the project root.

4. **300s Nginx timeout:** AI pipeline Server Actions are standard HTTP POST requests that go through Nginx. The default 60s `proxy_read_timeout` would cause 504 Gateway Timeout responses on long-running pipeline executions.

5. **Full node_modules required:** Despite standalone output, the pipeline worker requires `node_modules/.bin/tsx` at runtime. The deploy script uses `npm ci --production=false` to install all deps including devDeps (tsx, prisma CLI).

## Self-Check: PASSED

All created files confirmed to exist on disk. All task commits confirmed in git log.

| Check | Result |
|-------|--------|
| next.config.ts exists | FOUND |
| ecosystem.config.js exists | FOUND |
| deploy.sh exists | FOUND |
| nginx/taskboard.conf exists | FOUND |
| .env.example exists | FOUND |
| Commit 714e651 (Task 1) | FOUND |
| Commit 0d4f937 (Task 2) | FOUND |
