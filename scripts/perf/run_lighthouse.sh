#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:5173}"
OUT_DIR="${2:-./artifacts/lighthouse}"

mkdir -p "$OUT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found on PATH" >&2
  exit 1
fi

# Lighthouse requires a Chromium-based browser. In Codespaces/devcontainers this may not exist.
if ! command -v google-chrome >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
  cat >&2 <<'EOF'
No Chromium browser found (google-chrome/chromium).

Options:
- Run this script on your host machine, or
- Install Chromium in the container (apt-get install chromium-browser), then retry.
EOF
  exit 2
fi

TS="$(date +%Y%m%d-%H%M%S)"
REPORT_HTML="$OUT_DIR/lighthouse-$TS.html"
REPORT_JSON="$OUT_DIR/lighthouse-$TS.json"

echo "Running Lighthouse against: $URL"

pnpm dlx lighthouse "$URL" \
  --config-path scripts/perf/lighthouse.config.json \
  --output html --output json \
  --output-path "$REPORT_HTML" \
  --quiet \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu"

# When multiple outputs are requested, Lighthouse writes the non-primary output alongside output-path.
# Ensure JSON is placed next to HTML for CI artifact pickup.
if [[ -f "${REPORT_HTML%.html}.report.json" ]]; then
  mv "${REPORT_HTML%.html}.report.json" "$REPORT_JSON"
fi

echo "Wrote: $REPORT_HTML"
echo "Wrote: $REPORT_JSON"
