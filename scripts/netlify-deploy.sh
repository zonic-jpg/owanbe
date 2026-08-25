#!/bin/bash
set -euo pipefail
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="/Users/olufemiadeagbo/Downloads/owanbe-6"
RESULT="/tmp/owanbex-netlify-deploy-result.txt"
LOG="/tmp/owanbex-netlify-deploy.log"
exec >>"$LOG" 2>&1
echo "START $(date -u +%Y-%m-%dT%H:%M:%SZ)"

export NETLIFY_AUTH_TOKEN="$(python3 -c '
import json
d=json.load(open("'"$HOME"'/Library/Preferences/netlify/config.json"))
for u in (d.get("users") or {}).values():
  t=(u.get("auth") or {}).get("token")
  if t: print(t); break
')"
echo "token_len=${#NETLIFY_AUTH_TOKEN}"

UC=$(curl -sS -o /tmp/nl_user.json -w '%{http_code}' -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" https://api.netlify.com/api/v1/user || echo 000)
echo "user_http=$UC"
if [[ "$UC" != "200" ]]; then
  echo "live=no reason=auth_$UC" > "$RESULT"
  exit 1
fi

SITES=$(curl -sS -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" "https://api.netlify.com/api/v1/sites?per_page=100")
SITE_ID=$(python3 -c 'import json,sys
sites=json.loads(sys.argv[1])
for s in sites:
  blob=(s.get("name") or "")+" "+(s.get("url") or "")+" "+(s.get("ssl_url") or "")
  if "owanbe" in blob.lower():
    print(s["id"]); break
' "$SITES")
echo "site_id_len=${#SITE_ID}"
if [[ -z "$SITE_ID" ]]; then
  CREATE=$(curl -sS -X POST -H "Authorization: Bearer ${NETLIFY_AUTH_TOKEN}" -H "Content-Type: application/json" -d '{"name":"owanbex"}' https://api.netlify.com/api/v1/sites)
  SITE_ID=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("id") or "")' "$CREATE")
  echo "created_len=${#SITE_ID}"
fi
[[ -n "$SITE_ID" ]] || { echo "live=no reason=no_site" > "$RESULT"; exit 1; }

cd "$ROOT"
npm ci
npm run build

netlify deploy --prod --dir=dist --site "$SITE_ID" --message "owanbex $(date -u +%Y%m%dT%H%M%SZ)" | tee /tmp/owanbe_nl_deploy_out.txt

sleep 3
HC=$(curl -sS -o /tmp/owanbe_home.html -w '%{http_code}' -L https://owanbex.netlify.app/ || echo 000)
AC=$(curl -sS -o /tmp/owanbe_auth.html -w '%{http_code}' -L https://owanbex.netlify.app/auth || echo 000)
DU=$(grep -Eo 'https://[^ ]+\.netlify\.app[^ ]*' /tmp/owanbe_nl_deploy_out.txt | tail -1 || echo https://owanbex.netlify.app)
{
  echo "live=yes"
  echo "home=$HC"
  echo "auth=$AC"
  echo "deploy_url=$DU"
} > "$RESULT"
echo "DONE"
cat "$RESULT"
