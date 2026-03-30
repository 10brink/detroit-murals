#!/usr/bin/env bash
# Deploy script — loads env, installs deps, runs migrations, builds, restarts PM2
set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
	echo "Error: env file '$ENV_FILE' not found"
	exit 1
fi

echo "→ Loading env from $ENV_FILE"
set -a; source "$ENV_FILE"; set +a

echo "→ Installing dependencies"
npm ci --omit=dev

echo "→ Running migrations"
node scripts/migrate.js

echo "→ Building"
npm run build

echo "→ Restarting PM2"
pm2 restart mural-map 2>/dev/null || pm2 start build/index.js --name mural-map

echo "✓ Deploy complete"
