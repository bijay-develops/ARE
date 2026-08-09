#!/usr/bin/env bash
# Strategy-switching proof (doc 5): same URL, different X-* headers → different
# rendering strategy. Reads the X-Rendering-Strategy response header each time.
#
# Usage: BASE_URL=http://localhost:8080 bash scripts/switch-test.sh
set -euo pipefail
BASE="${BASE_URL:-http://localhost:8080}"

strategy() {
  curl -s -D- -o /dev/null "$@" | awk -F': ' 'tolower($1)=="x-rendering-strategy"{gsub(/\r/,"");print $2}'
}

printf '%-46s -> %-15s (expect %s)\n' \
  "static volatility, /static" \
  "$(strategy -H 'X-Data-Volatility: static' "$BASE/static")" "SSG"

printf '%-46s -> %-15s (expect %s)\n' \
  "realtime + fast + desktop, /dynamic" \
  "$(strategy -H 'X-Data-Volatility: realtime' -H 'X-Network-Speed: fast' -H 'X-Device-Type: desktop' "$BASE/dynamic")" "CSR"

printf '%-46s -> %-15s (expect %s)\n' \
  "high load, /dynamic" \
  "$(strategy -H 'X-Load-Level: high' "$BASE/dynamic")" "ISR"

printf '%-46s -> %-15s (expect %s)\n' \
  "realtime + mobile, /dynamic" \
  "$(strategy -H 'X-Data-Volatility: realtime' -H 'X-Device-Type: mobile' "$BASE/dynamic")" "SSR"

printf '%-46s -> %-15s (expect %s)\n' \
  "heavy payload + medium network, /heavy" \
  "$(strategy -H 'X-Data-Size: heavy' -H 'X-Network-Speed: medium' "$BASE/heavy")" "STREAMING_SSR"

printf '%-46s -> %-15s (expect %s)\n' \
  "static + edge + cold cache, /dynamic" \
  "$(strategy -H 'X-Data-Volatility: static' -H 'X-Cache-State: cold' -H 'X-Served-By: edge-node-1' "$BASE/dynamic")" "EDGE_ISR"

printf '%-46s -> %-15s (expect %s)\n' \
  "periodic, /dynamic" \
  "$(strategy -H 'X-Data-Volatility: periodic' "$BASE/dynamic")" "ISR"
