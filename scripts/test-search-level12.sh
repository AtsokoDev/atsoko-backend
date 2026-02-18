#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

BASE_URL="${1:-http://localhost:3000}"
PROPERTIES_URL="${BASE_URL}/api/properties"

pass_count=0
fail_count=0

pass() {
  echo "✅ PASS: $1"
  pass_count=$((pass_count + 1))
}

fail() {
  echo "❌ FAIL: $1"
  fail_count=$((fail_count + 1))
}

run_api_test() {
  local name="$1"
  local url="$2"
  local expect_expr="$3"

  local body_file
  local code
  body_file=$(mktemp)

  code=$(curl --max-time 20 -sS -o "$body_file" -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [[ "$code" != "200" ]]; then
    fail "$name (HTTP $code)"
    echo "   URL: $url"
    echo "   Body: $(head -c 300 "$body_file")"
    rm -f "$body_file"
    return
  fi

  if node -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const ok=(function(){ return ${expect_expr}; })(); if(!ok) process.exit(1);" "$body_file"; then
    pass "$name"
  else
    fail "$name (assertion failed)"
    echo "   URL: $url"
    echo "   Body: $(head -c 300 "$body_file")"
  fi

  rm -f "$body_file"
}

echo "🔎 Running Level 1/2 search tests against: $BASE_URL"

# Health check for API availability
health_code=$(curl --max-time 10 -sS -o /tmp/atsoko_health.$$ -w "%{http_code}" "$BASE_URL/" 2>/dev/null || echo "000")
if [[ "$health_code" == "200" ]]; then
  pass "API health endpoint reachable"
else
  fail "API health endpoint unreachable (HTTP $health_code)"
  echo "   Cannot continue reliably. Start backend at $BASE_URL first."
  rm -f /tmp/atsoko_health.$$
  echo
  echo "Summary: $pass_count passed, $fail_count failed"
  exit 1
fi
rm -f /tmp/atsoko_health.$$

# Functional tests
run_api_test \
  "Baseline list returns records" \
  "$PROPERTIES_URL?limit=3" \
  "d.success===true && Array.isArray(d.data) && d.data.length>0"

run_api_test \
  "Keyword search works (warehouse)" \
  "$PROPERTIES_URL?keyword=warehouse&limit=5" \
  "d.success===true && Array.isArray(d.data) && d.data.length>0"

run_api_test \
  "Typo tolerance works (warehous)" \
  "$PROPERTIES_URL?keyword=warehous&limit=5" \
  "d.success===true && Array.isArray(d.data) && d.data.length>0"

run_api_test \
  "Exact-like property id keyword prioritizes results" \
  "$PROPERTIES_URL?keyword=AT57R&limit=5" \
  "d.success===true && Array.isArray(d.data) && d.data.length>0 && d.data[0] && typeof d.data[0].property_id==='string'"

run_api_test \
  "Keyword + filters works together" \
  "$PROPERTIES_URL?keyword=factory&status=rent&province=Bangkok&limit=5" \
  "d.success===true && Array.isArray(d.data)"

run_api_test \
  "Whitespace keyword does not crash" \
  "$PROPERTIES_URL?keyword=%20%20%20&limit=3" \
  "d.success===true && Array.isArray(d.data)"

# Response-time quick check (not strict pass/fail)
echo
echo "⏱️  Quick latency sample"
for q in warehouse warehous AT57R; do
  t=$(curl --max-time 20 -sS -o /dev/null -w "%{time_total}" "$PROPERTIES_URL?keyword=${q}&limit=20" 2>/dev/null || echo "timeout")
  echo "   keyword=${q} time_total=${t}s"
done

# DB index verification (Level 1/2 prerequisites)
echo
echo "🗄️  Checking pg_trgm and search indexes"
if node <<'NODE'
require('dotenv').config();
const pool = require('./config/database');

(async () => {
  try {
    const ext = await pool.query("SELECT extname FROM pg_extension WHERE extname='pg_trgm'");
    const idx = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='properties' AND indexname IN ('idx_properties_search_vector','idx_properties_property_id_trgm','idx_properties_title_trgm','idx_properties_remarks_trgm') ORDER BY indexname");
    const expected = [
      'idx_properties_property_id_trgm',
      'idx_properties_remarks_trgm',
      'idx_properties_search_vector',
      'idx_properties_title_trgm'
    ];
    const names = idx.rows.map((r) => r.indexname);
    const extOk = ext.rows.length === 1;
    const idxOk = expected.every((name) => names.includes(name));
    if (!extOk || !idxOk) {
      console.log('pg_trgm_installed=', extOk);
      console.log('indexes_found=', names);
      process.exit(1);
    }
    console.log('pg_trgm_installed=true');
    console.log('indexes_found=', names);
  } finally {
    await pool.end();
  }
})();
NODE
then
  pass "Search extension + indexes are present"
else
  fail "Search extension/index verification failed"
fi

echo
echo "Summary: $pass_count passed, $fail_count failed"
if [[ $fail_count -gt 0 ]]; then
  exit 1
fi
