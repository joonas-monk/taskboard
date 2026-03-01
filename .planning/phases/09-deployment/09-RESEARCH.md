# Phase 9: Deployment - Research

**Researched:** 2026-03-01
**Domain:** VPS deployment — Next.js 16 + SQLite + PM2 + Nginx + Let's Encrypt on Hostinger Ubuntu
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-02 | Application is deployable to Hostinger VPS and accessible via browser | Entire research document — covers all four success criteria: HTTPS domain access, data persistence across redeploys, PM2 startup on reboot, Nginx port isolation |
</phase_requirements>

---

## Summary

Phase 9 deploys the completed TaskBoard Next.js 16 app to a Hostinger Ubuntu VPS. The standard approach is: build the app with `output: 'standalone'`, run it under PM2 in fork mode (single instance — required for SQLite), reverse-proxy through Nginx, and secure with Let's Encrypt/Certbot. The database lives at `/var/data/taskboard/tasks.db` — outside the project directory — so it survives git pulls and redeploys.

Three specific pitfalls exist for this project: (1) PM2 cluster mode will corrupt SQLite because `better-sqlite3` is not concurrency-safe across processes — use `exec_mode: 'fork'` with `instances: 1`. (2) Next.js standalone output may miss native `.node` binaries from `better-sqlite3` — add `outputFileTracingIncludes`. (3) The pipeline worker spawns `tsx` from `node_modules/.bin/tsx` using an absolute path resolved at runtime — this path must remain valid in the production layout.

The decision from STATE.md to use standalone output mode (not static export) was correct and must be applied now via `next.config.ts`. All four success criteria (HTTPS, data persistence, PM2 auto-restart, Nginx port isolation) are standard and well-documented.

**Primary recommendation:** Use `npm run build` (standalone mode) + PM2 fork mode (single instance) + Nginx reverse proxy + Certbot for SSL. Keep the DB at the pre-decided absolute path `/var/data/taskboard/tasks.db`. Run `prisma migrate deploy` before each start.

---

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| PM2 | 5.x (latest stable) | Node.js process manager, auto-restart, startup scripts | Industry standard for Node.js production; 100M+ apps managed monthly |
| Nginx | 1.18+ (Ubuntu package) | Reverse proxy, SSL termination, port isolation | Proven for Node.js; handles static assets separately from app |
| Certbot | Latest snap | Let's Encrypt SSL certificates + auto-renewal | Free, trusted by all browsers, automated 90-day renewal |
| Node.js | 20 LTS or 22 LTS (via NVM) | Runtime for Next.js | LTS ensures 3-year security support; NVM allows version control |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| NVM | Latest | Node.js version manager on VPS | Always — prevents system Node conflicts, easy upgrades |
| UFW | Ubuntu built-in | Firewall — block direct port 3000 access | Required for success criterion 4 (port isolation) |
| `prisma migrate deploy` | Prisma 7 CLI | Runs pending migrations in production | Must run before every deploy |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PM2 | systemd service | PM2 has better ecosystem, monitoring, logs; systemd is lower-level |
| Certbot snap | acme.sh | Certbot is official, better Nginx integration, simpler |
| NVM | NodeSource apt | NVM allows version switching; NodeSource is simpler but less flexible |

**Installation (on VPS):**
```bash
# Node.js via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
nvm alias default 22

# PM2
npm install -g pm2

# Nginx
sudo apt update && sudo apt install -y nginx

# Certbot
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

---

## Architecture Patterns

### Recommended Project Layout on VPS

```
/var/data/taskboard/
└── tasks.db                  # Production SQLite — OUTSIDE project dir

/home/deploy/taskboard/       # App directory (or /opt/taskboard)
├── .next/                    # Build output
│   └── standalone/           # Standalone output (server.js lives here)
│       ├── server.js
│       ├── .next/
│       │   └── static/       # Copied here after build
│       └── public/           # Copied here after build
├── prisma/
│   └── migrations/           # Applied by prisma migrate deploy
├── src/
│   └── workers/              # pipeline-worker.ts (tsx spawned at runtime)
├── node_modules/             # Full node_modules — needed for tsx worker
├── .env.production           # Production env vars (gitignored)
└── ecosystem.config.js       # PM2 config
```

> **Note:** The standalone output does NOT include full `node_modules`. However, because the pipeline worker is spawned via `tsx` from `node_modules/.bin/tsx`, the full `node_modules` directory must be present on the VPS. This is a deviation from a pure standalone deployment.

### Pattern 1: Standalone Build + Full node_modules

**What:** Enable `output: 'standalone'` in next.config.ts but keep full `node_modules` installed (do NOT deploy only the standalone folder). The server still runs from `.next/standalone/server.js`, but the full `node_modules` remains for the `tsx` pipeline worker.

**When to use:** Always — this project requires it because `startPipeline` resolves `node_modules/.bin/tsx` at runtime using `process.cwd()`.

**next.config.ts:**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/better-sqlite3/**/*',
      './node_modules/@prisma/adapter-better-sqlite3/**/*',
      './src/generated/prisma/**/*',
    ],
  },
}

export default nextConfig
```

**Build and start:**
```bash
npm run build
# Copy public and static into standalone folder
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
# Start
node .next/standalone/server.js
```

### Pattern 2: PM2 Ecosystem Config (Fork Mode, Single Instance)

**What:** Run Next.js under PM2 using fork mode with exactly 1 instance. Cluster mode is explicitly forbidden because `better-sqlite3` is not safe for multi-process concurrent writes.

**When to use:** Always for this project (SQLite database).

```javascript
// Source: https://pm2.keymetrics.io/docs/usage/application-declaration/
// ecosystem.config.js — place in /home/deploy/taskboard/

const path = require('path')

module.exports = {
  apps: [{
    name: 'taskboard',
    script: '.next/standalone/server.js',
    cwd: '/home/deploy/taskboard',
    exec_mode: 'fork',      // CRITICAL: NOT cluster — SQLite cannot handle multi-process writes
    instances: 1,           // Single instance only
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '127.0.0.1',  // Only listen on loopback — Nginx proxies externally
    },
    env_file: '.env.production',  // Load secrets from file
    out_file: '/var/log/taskboard/out.log',
    error_file: '/var/log/taskboard/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
```

**PM2 startup configuration:**
```bash
# Start the app
pm2 start ecosystem.config.js

# Save process list so PM2 restores it after reboot
pm2 save

# Generate and install startup script (run as deploy user, follow printed instructions)
pm2 startup
# PM2 will print a command to run as root — copy and execute it
# Example: sudo env PATH=$PATH:/home/deploy/.nvm/versions/node/v22.0.0/bin pm2 startup systemd -u deploy --hp /home/deploy

# Verify startup script
pm2 list
```

### Pattern 3: Nginx Reverse Proxy + Port Isolation

**What:** Nginx listens on 80/443, proxies to localhost:3000. UFW blocks direct port 3000 access from outside.

**When to use:** Required for success criteria 1 and 4.

```nginx
# Source: multiple community guides + official Nginx docs
# /etc/nginx/sites-available/taskboard

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    # Certbot will modify this to redirect to HTTPS after SSL setup
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates — filled in by Certbot
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**UFW firewall rules:**
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'   # Opens 80 and 443
# Do NOT add a rule for port 3000 — it must be blocked from the internet
sudo ufw enable
sudo ufw status               # Verify 3000 is NOT listed
```

**Enable Nginx site:**
```bash
sudo ln -s /etc/nginx/sites-available/taskboard /etc/nginx/sites-enabled/
sudo nginx -t          # Test config syntax
sudo systemctl reload nginx
```

### Pattern 4: Let's Encrypt SSL with Certbot

**What:** Install free SSL certificate for the domain. Certbot handles automatic renewal via systemd timer.

```bash
# Source: https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal
# Nginx must already be running with a server_name matching your domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Verify systemd timer is active
systemctl status certbot.timer
```

### Pattern 5: Database Directory Setup

**What:** Create `/var/data/taskboard/` before first run. This path is already in `lib/prisma.ts` as the default fallback.

```bash
sudo mkdir -p /var/data/taskboard
sudo chown deploy:deploy /var/data/taskboard
sudo chmod 755 /var/data/taskboard
```

**Run migrations before first start:**
```bash
cd /home/deploy/taskboard
DATABASE_URL="file:/var/data/taskboard/tasks.db" npx prisma migrate deploy
```

**Seed only on first deploy (if database is empty):**
```bash
# Only if database is brand new — seed populates 5 columns + 4 labels
DATABASE_URL="file:/var/data/taskboard/tasks.db" npx tsx prisma/seed.ts
```

### Pattern 6: Environment Variables (.env.production)

**What:** Store all secrets in `.env.production` (gitignored). PM2 loads it via `env_file` or ecosystem `env` block.

```bash
# /home/deploy/taskboard/.env.production
DATABASE_URL=file:/var/data/taskboard/tasks.db
ANTHROPIC_API_KEY=sk-ant-api03-...your-real-key...
PIPELINE_MODEL=claude-3-5-haiku-20241022
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
```

> **Note:** `env_file` in PM2 ecosystem.config.js is a relatively new feature. The more reliable approach is to load the `.env` file in the ecosystem config using dotenv, or to pass env vars directly in the `env:` block of ecosystem.config.js. See pitfalls section.

### Anti-Patterns to Avoid

- **Cluster mode with SQLite:** Setting `exec_mode: 'cluster'` or `instances: > 1` will cause concurrent write conflicts and data corruption in `better-sqlite3`.
- **Deploying only the standalone folder:** The pipeline worker requires `node_modules/.bin/tsx` to be available at `process.cwd() + '/node_modules/.bin/tsx'`. If only `.next/standalone` is deployed without full `node_modules`, the worker spawn will fail silently (pipeline goes to FAILED state).
- **Running as root:** Never run the app as root. Create a `deploy` user, own the app directory, and restrict `sudo` to specific commands.
- **Committing `.env.production`:** The ANTHROPIC_API_KEY must never reach git. Use `.gitignore` to exclude all `.env*` files except `.env.example`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process auto-restart on crash | Custom shell script with `while true` loop | PM2 `autorestart: true` | PM2 handles backoff, restart counts, memory limits, startup scripts |
| SSL certificate management | Manual openssl + cron for renewal | Certbot + Let's Encrypt | Auto-renewal via systemd, browser-trusted CA, free |
| Port forwarding / reverse proxy | Custom Node.js proxy | Nginx `proxy_pass` | Battle-tested, handles upgrades, WebSocket, static files, gzip |
| Process startup on reboot | `/etc/rc.local` hacks | `pm2 startup && pm2 save` | Platform-aware (systemd/upstart/launchd), user-scoped |
| Nginx HTTPS config | Manual ssl_certificate directives | `certbot --nginx` auto-config | Certbot writes correct SSL config including HSTS, ciphers |

**Key insight:** Every item in this list is solved infrastructure that has been hardened over years. Custom solutions miss edge cases (certificate expiry, SIGTERM handling, memory leaks) that PM2 and Certbot handle by default.

---

## Common Pitfalls

### Pitfall 1: PM2 Cluster Mode Corrupts SQLite
**What goes wrong:** Setting `exec_mode: 'cluster'` or `instances: 2+` causes multiple Node.js processes to write to the same SQLite file concurrently. `better-sqlite3` is NOT safe for this — it will produce "database is locked" errors or silent data corruption.
**Why it happens:** Cluster mode spawns multiple full copies of the app process. Each copy has its own Prisma singleton and WAL connection.
**How to avoid:** Always set `exec_mode: 'fork'` and `instances: 1` in `ecosystem.config.js`.
**Warning signs:** "SQLITE_BUSY" or "database is locked" errors in PM2 logs.

### Pitfall 2: Pipeline Worker Can't Find tsx After Deploy
**What goes wrong:** `startPipeline` resolves the worker path as `path.resolve(process.cwd(), 'src/workers/pipeline-worker.ts')` and tsx as `path.resolve(process.cwd(), 'node_modules/.bin/tsx')`. If the VPS deployment doesn't include `node_modules` (e.g., only standalone folder deployed), spawn fails silently and the pipeline goes FAILED immediately.
**Why it happens:** Next.js standalone mode intentionally excludes full `node_modules` to reduce deployment size. But this project has a non-standard requirement: a TypeScript worker spawned at runtime.
**How to avoid:** Deploy the full project directory including `node_modules`, not just `.next/standalone`. The PM2 `cwd` must point to the root project dir (where `node_modules/` exists), not to `.next/standalone/`.
**Warning signs:** Cards created in the Idea column immediately show FAILED pipeline status.

### Pitfall 3: PM2 startup Script Uses NVM Path That Disappears
**What goes wrong:** PM2's startup script captures the current node binary path. If installed via NVM, the path looks like `/home/deploy/.nvm/versions/node/v22.0.0/bin/node`. After a reboot, if the startup script runs before the NVM environment loads, PM2 can't find the node binary.
**Why it happens:** NVM adds itself to `.bashrc`/`.profile`, which aren't sourced during systemd startup.
**How to avoid:** When running `pm2 startup`, PM2 prints the exact command to register the startup script with the FULL node path. Copy and execute that command verbatim. It looks like: `sudo env PATH=$PATH:/home/deploy/.nvm/versions/node/v22.x.x/bin pm2 startup systemd -u deploy --hp /home/deploy`
**Warning signs:** App not running after VPS reboot; `systemctl status pm2-deploy` shows failure.

### Pitfall 4: DATABASE_URL Not Set in PM2 Environment
**What goes wrong:** PM2 doesn't automatically inherit shell environment variables. If `DATABASE_URL` is not explicitly set in the ecosystem config `env:` block or loaded from `.env.production`, the app falls back to the `lib/prisma.ts` default (`file:/var/data/taskboard/taskboard.db`) — but the worker process that's spawned gets NO env vars unless they're passed explicitly in the `spawn()` call's `env:` option.
**Why it happens:** The worker spawn in `ai.ts` explicitly passes `env: { DATABASE_URL: process.env.DATABASE_URL!, ... }`. If the parent Next.js process doesn't have `DATABASE_URL` set, the worker also won't have it.
**How to avoid:** Set `DATABASE_URL` explicitly in the PM2 ecosystem `env:` block (or load from `.env.production`). Verify with `pm2 env 0` after starting.
**Warning signs:** Worker exits with "DATABASE_URL not set" in PM2 error log, pipeline immediately fails.

### Pitfall 5: Prisma Generated Client Not Present After Git Pull + Build
**What goes wrong:** `src/generated/prisma/` is gitignored. After `git pull` on the VPS, a fresh `npm run build` is needed, but the generated Prisma client must also be regenerated.
**Why it happens:** Prisma generates TypeScript + native binaries that are platform-specific. The developer machine's generated client won't run on Ubuntu.
**How to avoid:** Run `npx prisma generate` before `npm run build` in the deploy script. Include it in a `deploy.sh` script.
**Warning signs:** Build errors like "Cannot find module '@/generated/prisma/client'" or "PrismaClient is not a constructor".

### Pitfall 6: Nginx Serves Old Next.js Static Files After Redeploy
**What goes wrong:** If static assets are served directly by Nginx from a path (rather than proxied through Next.js), they may be stale after a rebuild.
**Why it happens:** Some Nginx configs serve `/_next/static` from disk with long cache headers. After rebuilding, the hash changes but Nginx still serves the old files.
**How to avoid:** Proxy ALL requests through Next.js (`proxy_pass http://127.0.0.1:3000`). Let Next.js set its own cache headers for `/_next/static`. Only add a direct Nginx alias if CDN performance is needed — out of scope for this single-user app.
**Warning signs:** Browser console shows 404 for `.js` chunk files after redeploy.

---

## Code Examples

### Verified: ecosystem.config.js for This Project
```javascript
// Source: PM2 official docs + Next.js SQLite constraint research
// /home/deploy/taskboard/ecosystem.config.js

require('dotenv').config({ path: '.env.production' })

module.exports = {
  apps: [{
    name: 'taskboard',
    script: '.next/standalone/server.js',
    cwd: '/home/deploy/taskboard',
    exec_mode: 'fork',      // NOT cluster — SQLite requires single writer
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: process.env.DATABASE_URL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      PIPELINE_MODEL: process.env.PIPELINE_MODEL || 'claude-3-5-haiku-20241022',
      HOME: process.env.HOME || '/home/deploy',
      PATH: process.env.PATH,
    },
    out_file: '/var/log/taskboard/out.log',
    error_file: '/var/log/taskboard/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
```

> **Why dotenv at top of ecosystem.config.js:** The ecosystem file is evaluated at `pm2 start` time in a shell that may not have the env vars loaded. Loading `.env.production` at the top ensures secrets are available to populate the `env:` block. This is more reliable than PM2's `env_file` option (which has inconsistent behavior across PM2 versions).

### Verified: next.config.ts with Standalone + File Tracing
```typescript
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/better-sqlite3/**/*',
      './node_modules/@prisma/adapter-better-sqlite3/**/*',
      './src/generated/prisma/**/*',
    ],
  },
}

export default nextConfig
```

### Verified: Deploy Script (deploy.sh)
```bash
#!/bin/bash
# /home/deploy/taskboard/deploy.sh
# Usage: bash deploy.sh
set -e

APP_DIR="/home/deploy/taskboard"
cd "$APP_DIR"

echo "[1/6] Pulling latest code..."
git pull origin main

echo "[2/6] Installing dependencies..."
npm ci --production=false  # Install all deps including devDeps (needed for tsx + prisma CLI)

echo "[3/6] Generating Prisma client..."
npx prisma generate

echo "[4/6] Running database migrations..."
DATABASE_URL="file:/var/data/taskboard/tasks.db" npx prisma migrate deploy

echo "[5/6] Building application..."
npm run build

echo "[5b/6] Copying static assets into standalone..."
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "[6/6] Restarting application..."
pm2 restart taskboard || pm2 start ecosystem.config.js

echo "Deploy complete. App running at http://localhost:3000"
pm2 list
```

### Verified: Nginx Config for This Project
```nginx
# /etc/nginx/sites-available/taskboard
# After Certbot runs, it modifies this file to add SSL directives

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    # Certbot will fill these in:
    # ssl_certificate ...
    # ssl_certificate_key ...

    # Increase upload/body size if AI pipeline returns large responses
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Reasonable timeouts — AI pipeline Server Actions may take minutes
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }
}
```

> **proxy_read_timeout 300s:** The AI pipeline executes Claude API calls that can take 30-120 seconds. The default Nginx `proxy_read_timeout` is 60s. Without this increase, Nginx will return a 504 Gateway Timeout while the pipeline is still running — the card will show as FAILED even though the worker continues.

### Verified: Full VPS Initial Setup Sequence
```bash
# As root initially:
adduser deploy
usermod -aG sudo deploy

# Create data directory
mkdir -p /var/data/taskboard
chown deploy:deploy /var/data/taskboard

# Create log directory
mkdir -p /var/log/taskboard
chown deploy:deploy /var/log/taskboard

# Switch to deploy user for everything else
su - deploy

# Install NVM + Node.js 22
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
nvm alias default 22

# Verify
node --version  # Should show v22.x.x

# Install PM2 globally
npm install -g pm2

# Clone and set up the app
git clone https://github.com/yourusername/taskboard.git /home/deploy/taskboard
cd /home/deploy/taskboard

# Create .env.production (copy template, fill in secrets)
cp .env.example .env.production
nano .env.production

# Run initial setup
npx prisma generate
DATABASE_URL="file:/var/data/taskboard/tasks.db" npx prisma migrate deploy
DATABASE_URL="file:/var/data/taskboard/tasks.db" npx tsx prisma/seed.ts

# Build
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Register startup script (run the output of this command as root)
pm2 startup
# Copy the printed sudo command, run it

# Verify
pm2 list
pm2 logs taskboard --lines 20
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next build` + deploy full `node_modules` | `output: 'standalone'` reduces bundle | Next.js 12+ | Smaller deploys but native modules need `outputFileTracingIncludes` |
| Manual `forever` or `nohup node` | PM2 process manager | PM2 became dominant ~2015 | Auto-restart, startup scripts, monitoring built in |
| Manual SSL cert management | Certbot with systemd auto-renewal | Let's Encrypt stable since 2016 | Zero-config 90-day renewal |
| Static global Node.js install | NVM per-user version management | Standard practice | No sudo needed for npm globals, easy upgrades |
| Prisma `prisma-client-js` generator | Prisma 7 `prisma-client` generator with explicit output path | Prisma 7 (2024) | Client split into multiple files, explicit output required |

**Deprecated/outdated:**
- `next export` (static export): Silently breaks Server Actions — already excluded per STATE.md decision.
- PM2 `watch: true` in production: Causes restart loops if any file changes (including log files). Do not use in production.
- `prisma-client-js` generator: Replaced by `prisma-client` in Prisma 7 — project already uses correct generator.

---

## Open Questions

1. **Domain name configuration**
   - What we know: Domain must be pointed to the VPS IP before Certbot can issue a certificate.
   - What's unclear: Whether the user has already purchased and configured a domain, or whether research into Hostinger's domain management panel is needed.
   - Recommendation: Plan should include a step to verify DNS A record points to VPS IP before the Certbot step. Use `dig yourdomain.com` or a DNS checker tool.

2. **Nginx proxy timeout for long-running AI pipeline Server Actions**
   - What we know: AI pipeline takes 30-120 seconds; default Nginx `proxy_read_timeout` is 60s.
   - What's unclear: Whether Server Actions go through Nginx as standard HTTP requests (they do — they're POST requests to `/`).
   - Recommendation: Set `proxy_read_timeout 300s` in Nginx config. This is included in the code example above. Confidence: HIGH based on how Next.js Server Actions work (they are standard HTTP POST requests).

3. **`HOME` environment variable for Claude Agent SDK**
   - What we know: `ai.ts` passes `HOME: process.env.HOME` to the worker spawn env. The Agent SDK and workspace.ts rely on HOME for scratch directories.
   - What's unclear: Whether PM2's process environment will have `HOME` set correctly for the deploy user, or if it needs explicit configuration.
   - Recommendation: Set `HOME: '/home/deploy'` explicitly in the ecosystem.config.js `env:` block. Included in code examples above.

---

## Sources

### Primary (HIGH confidence)
- [Next.js official output docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) — standalone mode, outputFileTracingIncludes, server.js startup — verified via WebFetch, version 16.1.6, updated 2026-02-27
- [PM2 Ecosystem File docs](https://pm2.keymetrics.io/docs/usage/application-declaration/) — ecosystem.config.js structure, exec_mode, instances, env vars — verified via WebFetch
- [Certbot official instructions](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal) — Ubuntu + Nginx SSL setup

### Secondary (MEDIUM confidence)
- [DigitalOcean: Nginx + Let's Encrypt on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04) — Nginx config patterns, UFW rules, Certbot workflow — multiple community-verified
- [PM2 + SQLite single instance requirement](https://github.com/vercel/next.js/discussions/10675) — cluster mode incompatible with SQLite — cross-referenced with PM2 official stateless docs
- [Hostinger VPS Node.js deployment guide](https://medium.com/@srekthk/deploying-a-next-js-application-on-ubuntu-server-with-hostinger-vps-tips-7c11ef0c7bb5) — Hostinger-specific VPS setup notes

### Tertiary (LOW confidence — needs validation)
- PM2 `env_file` reliability: Multiple sources suggest loading `.env` via `require('dotenv')` at top of ecosystem.config.js is more reliable than `env_file` option — unverified against current PM2 5.x changelog. Flag for testing during execution.
- `outputFileTracingIncludes` for `better-sqlite3`: Recommended by community sources but not verified against this exact Next.js 16.1.6 + Prisma 7 + better-sqlite3 combination. The full `node_modules` deployment approach (keeping all node_modules rather than relying solely on standalone output) is the safer fallback.

---

## Metadata

**Confidence breakdown:**
- Standard stack (PM2, Nginx, Certbot): HIGH — industry standard tools with extensive official documentation
- Architecture (fork mode, single instance, standalone output): HIGH — verified against Next.js official docs and SQLite concurrency constraints
- Pitfalls (cluster mode / SQLite, tsx worker path, PM2 startup/NVM): HIGH for items 1-4, MEDIUM for items 5-6
- Nginx timeout for Server Actions: MEDIUM — logical deduction verified against Server Actions HTTP mechanism

**Research date:** 2026-03-01
**Valid until:** 2026-09-01 (stable tooling — PM2, Nginx, Certbot are slow-moving)
