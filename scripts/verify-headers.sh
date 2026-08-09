#!/usr/bin/env bash
# Bulletproof evidence (doc 5): print the strategy/decision headers for a page.
# Usage: BASE_URL=http://localhost:8080 bash scripts/verify-headers.sh /dynamic
set -euo pipefail
BASE="${BASE_URL:-http://localhost:8080}"
PAGE="${1:-/dynamic}"

echo "HEAD $BASE$PAGE"
curl -s -I "$BASE$PAGE" | grep -iE '^(x-rendering-strategy|x-decision-reason|x-isr-cache|x-ssg|x-streaming|x-csr)' | tr -d '\r'
