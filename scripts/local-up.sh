#!/usr/bin/env bash
# Start db-admin-tool as a local container + the host LLM bridge.
#   - MySQL proxy creds: IM_DB_PROXY_URL / IM_DB_PROXY_AUTH from ~/.secrets (override with SECRETS_FILE)
#   - AI: llm-bridge/server.mjs on the host runs the logged-in claude / codex / agy CLIs
set -euo pipefail
cd "$(dirname "$0")/.."

SECRETS_FILE="${SECRETS_FILE:-$HOME/.secrets}"
if [[ -f "$SECRETS_FILE" ]]; then
  # Take only the two proxy variables, don't import the rest of the secrets file.
  eval "$(grep -E '^(export )?IM_DB_PROXY_(URL|AUTH)=' "$SECRETS_FILE" || true)"
fi
export IM_DB_PROXY_URL="${IM_DB_PROXY_URL:-}" IM_DB_PROXY_AUTH="${IM_DB_PROXY_AUTH:-}"
if [[ -n "$IM_DB_PROXY_URL" && -n "$IM_DB_PROXY_AUTH" ]]; then
  echo "✓ MySQL proxy creds loaded from $SECRETS_FILE"
else
  echo "! IM_DB_PROXY_URL / IM_DB_PROXY_AUTH not set: proxy creds must be entered in the UI"
fi

# Shared secret between the container and the bridge (kept locally, gitignored)
TOKEN_FILE=.llm-bridge-token
[[ -s "$TOKEN_FILE" ]] || (umask 077; openssl rand -hex 32 > "$TOKEN_FILE")
export LLM_BRIDGE_TOKEN="$(cat "$TOKEN_FILE")"
export LLM_BRIDGE_PORT="${LLM_BRIDGE_PORT:-8787}"

bridge_up() { curl -fsS -o /dev/null -H "Authorization: Bearer $LLM_BRIDGE_TOKEN" "http://127.0.0.1:$LLM_BRIDGE_PORT/health"; }
if bridge_up; then
  echo "✓ LLM bridge already running on :$LLM_BRIDGE_PORT"
else
  nohup node llm-bridge/server.mjs > .llm-bridge.log 2>&1 &
  for _ in $(seq 1 10); do bridge_up && break; sleep 0.5; done
  bridge_up || { echo "✗ LLM bridge failed to start, see .llm-bridge.log"; exit 1; }
  echo "✓ LLM bridge started on :$LLM_BRIDGE_PORT (log .llm-bridge.log)"
fi

docker compose up -d --build

for _ in $(seq 1 60); do
  curl -fsS -o /dev/null http://127.0.0.1:8008 2>/dev/null && break
  sleep 1
done
echo "LLM bridge seen from container: $(curl -fsS http://127.0.0.1:8008/api/llm || echo unreachable)"
echo "✓ http://127.0.0.1:8008"
