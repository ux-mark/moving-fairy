#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# --- Detect LAN IP ------------------------------------------------------------
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")

if [ -z "$LAN_IP" ]; then
  echo "Could not detect a LAN IP. Falling back to localhost."
  echo "Mobile devices will not be able to connect."
  LAN_IP="127.0.0.1"
else
  echo "Detected LAN IP: $LAN_IP"
  echo ""
  echo "  App:      http://$LAN_IP:3333"
  echo "  Supabase: http://$LAN_IP:54341"
  echo "  Studio:   http://$LAN_IP:54343"
  echo ""
fi

# --- Patch supabase/config.toml with detected IP -----------------------------
TOML="supabase/config.toml"
sed -i '' "s|api_url = \"http://[^\"]*\"|api_url = \"http://$LAN_IP\"|" "$TOML"
sed -i '' "s|site_url = \"http://[^\"]*\"|site_url = \"http://$LAN_IP:3333\"|" "$TOML"
sed -i '' "s|additional_redirect_urls = \[.*\]|additional_redirect_urls = [\"http://$LAN_IP:3333/auth/callback\", \"http://127.0.0.1:3333/auth/callback\", \"http://localhost:3333/auth/callback\"]|" "$TOML"
echo "Updated supabase/config.toml with LAN IP."

# --- Start Supabase -----------------------------------------------------------
echo "→ Stopping Supabase (data is preserved)..."
supabase stop || true

echo "→ Starting Supabase..."
supabase start

# --- Kill stale Next.js -------------------------------------------------------
echo "→ Killing any process on port 3333..."
lsof -ti :3333 | xargs kill 2>/dev/null || true

# --- Refresh Claude Code OAuth token -----------------------------------------
echo "→ Refreshing Claude Code OAuth token..."
TOKEN=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null \
  | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d['claudeAiOauth']['accessToken'])" 2>/dev/null) \
  && sed -i '' "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${TOKEN}|" .env.local \
  && echo "  Token updated in .env.local" \
  || echo "  Could not refresh token (will use existing key)"

# --- Start Next.js on all interfaces -----------------------------------------
echo "→ Starting Next.js on 0.0.0.0:3333 ..."
export NEXT_PUBLIC_SUPABASE_URL="http://$LAN_IP:54341"
exec npx next dev --hostname 0.0.0.0 --port 3333
