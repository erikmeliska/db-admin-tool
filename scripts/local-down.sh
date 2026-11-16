#!/usr/bin/env bash
# Stop the local container and the host LLM bridge started by local-up.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down
if [[ -s .llm-bridge-token ]]; then
  curl -fsS -X POST -H "Authorization: Bearer $(cat .llm-bridge-token)" \
    "http://127.0.0.1:${LLM_BRIDGE_PORT:-8787}/shutdown" >/dev/null 2>&1 \
    && echo "✓ LLM bridge stopped" || echo "LLM bridge was not running"
fi
