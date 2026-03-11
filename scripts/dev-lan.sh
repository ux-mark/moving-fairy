#!/bin/bash
# ---------------------------------------------------------------------------
# dev-lan.sh — Start the dev environment with dynamic LAN IP detection
#
# Detects your machine's LAN IP so mobile devices on the same network can
# access the Next.js app and Supabase services. Updates supabase/config.toml
# with the detected IP, sets the NEXT_PUBLIC_SUPABASE_URL env var, and starts
# Next.js on all interfaces (0.0.0.0).
#
# Usage:
#   pnpm dev:lan          # normal usage via package.json
#   bash scripts/dev-lan.sh   # direct invocation
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TOML="$PROJECT_DIR/supabase/config.toml"

# --- Detect LAN IP -----------------------------------------------------------
# Try en0 (Wi-Fi) first, then en1 (Ethernet), then fall back to localhost.
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

# --- Patch supabase/config.toml ----------------------------------------------
# These sed replacements are idempotent — they match any previous IP or localhost.
sed -i '' "s|api_url = \"http://[^\"]*\"|api_url = \"http://$LAN_IP\"|" "$TOML"
sed -i '' "s|site_url = \"http://[^\"]*\"|site_url = \"http://$LAN_IP:3333\"|" "$TOML"
sed -i '' "s|additional_redirect_urls = \[.*\]|additional_redirect_urls = [\"http://$LAN_IP:3333/auth/callback\", \"http://127.0.0.1:3333/auth/callback\", \"http://localhost:3333/auth/callback\"]|" "$TOML"

echo "Updated supabase/config.toml with LAN IP."
echo ""
echo "If Supabase is already running, restart it to pick up the new config:"
echo "  cd $PROJECT_DIR && supabase stop && supabase start"
echo ""

# --- Start Next.js on all interfaces -----------------------------------------
export NEXT_PUBLIC_SUPABASE_URL="http://$LAN_IP:54341"

echo "Starting Next.js dev server on 0.0.0.0:3333 ..."
echo ""
cd "$PROJECT_DIR"
exec npx next dev --hostname 0.0.0.0 --port 3333
