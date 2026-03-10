#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Stopping Supabase (data is preserved)..."
supabase stop || true

echo "→ Starting Supabase..."
supabase start

echo "→ Killing any process on port 3333..."
lsof -ti :3333 | xargs kill 2>/dev/null || true

echo "→ Refreshing Claude Code OAuth token..."
TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null \
  | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d['claudeAiOauth']['accessToken'])" 2>/dev/null) \
  && sed -i '' "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${TOKEN}|" .env.local \
  && echo "  ✓ Token updated in .env.local" \
  || echo "  ⚠ Could not refresh token (will use existing key)"

echo "→ Starting Next.js on port 3333..."
pnpm dev
