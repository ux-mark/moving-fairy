#!/usr/bin/env bash
# Switch the app on port 3001 between dev and prod.
#
#   ./scripts/serve.sh dev    → Next.js dev server (hot reload; slower, for editing)
#   ./scripts/serve.sh prod   → production build + server (fast; no hot reload)
#
# The Cloudflare tunnel points at container port 3001, so either mode is served
# at moving.thefairies.ie. Runs in the foreground — Ctrl-C stops the server,
# then run the other mode to switch.
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-prod}"
PORT=3001

echo "→ Stopping whatever is on port ${PORT}…"
# Kill the port holder AND the detached next-server child (next start spawns a
# child that survives if you only kill the parent — that orphans the port).
lsof -ti :"${PORT}" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "next (dev|start).*--port ${PORT}" 2>/dev/null || true
sleep 2

case "${MODE}" in
  dev)
    echo "→ Starting DEV (hot reload) on 0.0.0.0:${PORT}…"
    exec npx next dev --hostname 0.0.0.0 --port "${PORT}"
    ;;
  prod)
    echo "→ Building production bundle…"
    npx next build
    echo "→ Starting PROD on 0.0.0.0:${PORT}…"
    # Use the logged-in `claude` CLI for Aisling assessments — this container has
    # no ANTHROPIC_API_KEY, so the SDK path would fail. (A real cloud deploy
    # would leave FORCE_CLI unset and set ANTHROPIC_API_KEY instead.)
    export FORCE_CLI=true
    exec npx next start --hostname 0.0.0.0 --port "${PORT}"
    ;;
  *)
    echo "Usage: $0 [dev|prod]" >&2
    exit 1
    ;;
esac
