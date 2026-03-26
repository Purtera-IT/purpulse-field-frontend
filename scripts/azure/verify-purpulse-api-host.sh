#!/usr/bin/env bash
# Verify PurPulse API Function Apps: app settings, proxy route, HTTP probes.
# Requires: az (logged in), curl, jq (optional; falls back to python3/json parsing).
#
# Usage:
#   ./scripts/azure/verify-purpulse-api-host.sh           # test + prod
#   ./scripts/azure/verify-purpulse-api-host.sh test      # test only
#   ./scripts/azure/verify-purpulse-api-host.sh prod      # prod only
#
# Exit 0 always (informational). Review output for failures.

set -euo pipefail

MODE="${1:-all}"

TEST_APP="${TEST_APP:-purpulse-test-api-eus2}"
TEST_RG="${TEST_RG:-purpulse-test-rg}"
TEST_BASE="${TEST_BASE:-https://purpulse-test-api-eus2.azurewebsites.net}"

PROD_APP="${PROD_APP:-purpulse-prod-api-eus2}"
PROD_RG="${PROD_RG:-purpulse-prod-rg}"
PROD_BASE="${PROD_BASE:-https://purpulse-prod-api-eus2.azurewebsites.net}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: missing command: $1" >&2
    exit 1
  }
}

need_cmd az
need_cmd curl

echo "=========================================="
echo "PurPulse API host verification (Azure CLI)"
echo "=========================================="
echo ""

if ! az account show --output none 2>/dev/null; then
  echo "ERROR: az is not logged in. Run: az login" >&2
  exit 1
fi

echo "Subscription: $(az account show --query name -o tsv) ($(az account show --query id -o tsv))"
echo ""

summarize_db_url() {
  local json="$1"
  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r '.[0].value // "(missing)"' 2>/dev/null || echo "(parse error)"
  elif command -v python3 >/dev/null 2>&1; then
    echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['value'] if d else '(missing)')" 2>/dev/null || echo "(missing)"
  else
    echo "$json" | tr -d '\n' | head -c 200
  fi
}

http_get() {
  local url="$1"
  shift
  local code
  code="$(curl -sS -o /tmp/vph.body -w "%{http_code}" --max-time 35 "$@" "$url" || echo "000")"
  local preview
  preview="$(head -c 120 /tmp/vph.body 2>/dev/null | tr '\n\r' ' ')"
  echo "  HTTP $code  $url"
  echo "  body: ${preview}"
}

check_env() {
  local label="$1"
  local app="$2"
  local rg="$3"
  local base="$4"

  echo "------------------------------------------"
  echo "$label — $app"
  echo "------------------------------------------"

  echo "• State / hostname"
  az functionapp show --name "$app" --resource-group "$rg" \
    --query "{state:state,defaultHostName:defaultHostName}" -o json 2>&1 || true

  echo ""
  echo "• DATABASE_URL app setting"
  local dbjson
  dbjson="$(az functionapp config appsettings list --name "$app" --resource-group "$rg" \
    --query "[?name=='DATABASE_URL']" -o json 2>&1)"
  echo "$dbjson"
  echo "  (value summary): $(summarize_db_url "$dbjson")"

  echo ""
  echo "• Proxy function invoke URL template"
  az functionapp function show --name "$app" --resource-group "$rg" --function-name proxy \
    --query invokeUrlTemplate -o tsv 2>&1 || echo "  (could not read proxy function)"

  echo ""
  echo "• HTTP probes (same origin as smoke script)"
  echo "  GET /api/me (dummy Bearer — expect 401 when routes mount; 404 {\"error\":\"Not found\"} = proxy fallback)"
  http_get "${base}/api/me" -H "Authorization: Bearer probe"
  echo "  GET /api/data/planning/display (no auth)"
  http_get "${base}/api/data/planning/display"

  echo ""
}

if [[ "$MODE" == "all" || "$MODE" == "test" ]]; then
  check_env "TEST" "$TEST_APP" "$TEST_RG" "$TEST_BASE"
fi

if [[ "$MODE" == "all" || "$MODE" == "prod" ]]; then
  check_env "PROD" "$PROD_APP" "$PROD_RG" "$PROD_BASE"
fi

if [[ "$MODE" == "staging" ]]; then
  echo "Staging slot (prod app): set SLOT=staging and use slot-specific hostname from portal."
  echo "Example:"
  echo "  az functionapp config appsettings list -g $PROD_RG -n $PROD_APP --slot staging --query \"[?name=='DATABASE_URL']\""
fi

echo "=========================================="
echo "Interpretation (quick)"
echo "=========================================="
cat <<'EOF'
• DATABASE_URL should be a Key Vault @Microsoft.KeyVault(...) reference or a connection string.
• Proxy invokeUrlTemplate should be https://<host>/api/{*segments} — smoke base = origin only:
    PURPULSE_API_BASE_URL=https://purpulse-test-api-eus2.azurewebsites.net
• GET /api/me returning JSON {"error":"Not found"} matches proxy fallback when the bundled
  plugin did not handle the route (see purpulse.app azure-function-api/proxy/index.js).
• GET /api/data/* returning 500 with empty body needs Log stream / App Insights for the stack trace.
• Do not debug JWT until the host returns expected HTTP shapes above.
EOF
