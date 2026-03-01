#!/bin/bash
# /home/deploy/taskboard/deploy.sh
# Usage: bash deploy.sh
# Automated redeploy script — safe to run repeatedly (idempotent)
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
