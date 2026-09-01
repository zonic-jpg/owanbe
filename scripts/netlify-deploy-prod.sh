#!/bin/bash
set -euo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="/Users/olufemiadeagbo/Downloads/owanbe-6"
cd "$ROOT"
RESULT="/Users/olufemiadeagbo/Downloads/owanbe-6/.deploy-result.txt"
LOG="/Users/olufemiadeagbo/Downloads/owanbe-6/.deploy-log.txt"
exec >"$LOG" 2>&1
echo "START $(date -u +%Y-%m-%dT%H:%M:%SZ)"
export NETLIFY_AUTH_TOKEN="$(python3 -c 'import json;d=json.load(open("/Users/olufemiadeagbo/Library/Preferences/netlify/config.json"));print(next((u["auth"]["token"] for u in d["users"].values() if u.get("auth",{}).get("token")),""))')"
echo "token_len=${#NETLIFY_AUTH_TOKEN}"
# Ensure latest build
npm run build
# Deploy known site
netlify deploy --prod --dir=dist --site=2444213e-0aa7-40e0-bee8-bc565ffc98fb --message "blank-login-fix $(date -u +%Y%m%dT%H%M%SZ)" | tee /tmp/owanbe_nl_out.txt
echo "DEPLOY_EXIT=$?"
# Verify live asset
sleep 5
curl -sL https://owanbex.netlify.app/ | tee /tmp/owanbe_live.html | grep -oE 'assets/index-[^"]+\.js' | head -3
LOCAL=$(grep -oE 'assets/index-[^"]+\.js' dist/index.html | head -1)
LIVE=$(grep -oE 'assets/index-[^"]+\.js' /tmp/owanbe_live.html | head -1)
echo "local=$LOCAL live=$LIVE" | tee "$RESULT"
echo "DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
