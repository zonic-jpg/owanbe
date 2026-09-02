#!/bin/bash
# Owanbe finish deploy — no bash process substitution (Cursor/sandbox safe)
set -euo pipefail
ROOT="/Users/olufemiadeagbo/Downloads/owanbe-6"
cd "$ROOT"
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.local/bin:$PATH"
LOG="/tmp/owanbe-finish.log"
: > "$LOG"

log() { echo "$@" | tee -a "$LOG"; }

log "============================================"
log "  Owanbe finish @ $(date)"
log "============================================"

load_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line" 2>/dev/null || true
    fi
  done < "$f"
}
load_env_file "/Users/olufemiadeagbo/Downloads/adspotclaudex/.env"
load_env_file "$ROOT/.env"

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" || ${#NETLIFY_AUTH_TOKEN} -lt 20 ]]; then
  CFG="$HOME/Library/Preferences/netlify/config.json"
  if [[ -f "$CFG" ]]; then
    export NETLIFY_AUTH_TOKEN=$(python3 -c "import json;from pathlib import Path;d=json.loads(Path('$CFG').read_text());uid=d.get('userId');users=d.get('users') or {};u=users.get(uid) if uid else (next(iter(users.values())) if users else {});print(((u or {}).get('auth') or {}).get('token') or '')")
  fi
fi

log "NL token len=${#NETLIFY_AUTH_TOKEN:-0}"

if [[ ! -f dist/index.html ]]; then
  npm ci || npm install
  npm run build
fi
test -f dist/index.html

SITE_ID="2444213e-0aa7-40e0-bee8-bc565ffc98fb"
if [[ -n "${NETLIFY_AUTH_TOKEN:-}" && ${#NETLIFY_AUTH_TOKEN} -ge 20 ]]; then
  npx --yes netlify-cli deploy --prod --dir=dist --site="$SITE_ID" --auth="$NETLIFY_AUTH_TOKEN" --message "owanbe phase1 finish" >> "$LOG" 2>&1 || true
  log "Netlify deploy attempted site=$SITE_ID"
else
  log "No NETLIFY_AUTH_TOKEN — skip deploy"
fi

log "DONE"
