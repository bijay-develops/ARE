#!/usr/bin/env bash
# Load test (doc 5): hammer the same endpoint and observe stability + the
# strategy chosen under load. Requires Apache Bench (`ab`).
#
# Usage: BASE_URL=http://localhost:8080 N=1000 C=50 bash scripts/load-test.sh /dynamic
set -euo pipefail
BASE="${BASE_URL:-http://localhost:8080}"
PAGE="${1:-/dynamic}"
N="${N:-1000}"
C="${C:-50}"

if ! command -v ab >/dev/null 2>&1; then
  echo "Apache Bench (ab) not found. Install: apt-get install apache2-utils" >&2
  exit 1
fi

echo "Strategy BEFORE load:"
curl -s -I "$BASE$PAGE" | awk 'tolower($1)=="x-rendering-strategy:"{print "  "$2}' | tr -d '\r'

echo "Running: ab -n $N -c $C $BASE$PAGE"
ab -n "$N" -c "$C" "$BASE$PAGE" | grep -E 'Requests per second|Time per request|Failed requests|Complete requests'

echo "Strategy DURING/AFTER load (re-probe):"
curl -s -I "$BASE$PAGE" | awk 'tolower($1)=="x-rendering-strategy:"{print "  "$2}' | tr -d '\r'
