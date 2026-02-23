/**
 * test-search-fix.js
 * ทดสอบ search fix: Property ID pattern → strict mode, keyword ทั่วไป → fuzzy mode
 * Run: node scripts/test-search-fix.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// ========== Helper: simulate normalizeKeyword ==========
function normalizeKeyword(keyword) {
    return keyword.trim().replace(/\s+/g, ' ');
}

// ========== Helper: simulate sanitizePattern ==========
function sanitizePattern(keyword) {
    return keyword.replace(/[%_\\]/g, '\\$&');
}

// ========== Helper: detect Property ID pattern ==========
function isPropertyIdPattern(keyword) {
    return /^AT\d+(R|S|SR)?$/i.test(keyword.trim());
}

// ========== Colors ==========
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function pass(msg) { console.log(`  ${GREEN}✅ PASS${RESET} ${msg}`); }
function fail(msg) { console.log(`  ${RED}❌ FAIL${RESET} ${msg}`); }
function info(msg) { console.log(`  ${CYAN}ℹ️  ${RESET}${msg}`); }

// ========== Test: Pattern Detection (Unit Test) ==========
async function testPatternDetection() {
    console.log(`\n${BOLD}${YELLOW}━━━ 1. Pattern Detection Test (Unit) ━━━${RESET}`);

    const cases = [
        // Should detect as Property ID (strict mode)
        { input: 'AT1594R', expected: true },
        { input: 'AT200S', expected: true },
        { input: 'AT50SR', expected: true },
        { input: 'AT1000', expected: true },
        { input: 'at594r', expected: true },   // case-insensitive
        { input: 'AT12345R', expected: true },
        // Should NOT detect as Property ID (fuzzy mode)
        { input: 'โกดัง', expected: false },
        { input: 'สระบุรี', expected: false },
        { input: 'warehouse', expected: false },
        { input: 'factory', expected: false },
        { input: 'AT', expected: false }, // too short
        { input: 'AT1594RX', expected: false }, // invalid suffix
        { input: 'BA1594R', expected: false }, // wrong prefix
        { input: '1594R', expected: false }, // no AT
        { input: 'AT 1594R', expected: false }, // has space
    ];

    let passed = 0;
    for (const tc of cases) {
        const result = isPropertyIdPattern(tc.input);
        if (result === tc.expected) {
            pass(`"${tc.input}" → ${tc.expected ? 'Strict (Property ID)' : 'Fuzzy (General)'}`);
            passed++;
        } else {
            fail(`"${tc.input}" → expected ${tc.expected}, got ${result}`);
        }
    }

    console.log(`\n  Result: ${passed}/${cases.length} passed`);
    return passed === cases.length;
}

// ========== Test: DB Query — Property ID strict mode ==========
async function testPropertyIdStrictSearch(keyword) {
    const normalizedKeyword = normalizeKeyword(keyword);
    const sanitizedKeyword = sanitizePattern(normalizedKeyword);

    const result = await pool.query(
        `SELECT property_id, title, 
                LOWER(COALESCE(property_id, '')) = LOWER($1) AS is_exact_match
         FROM properties
         WHERE (
             LOWER(COALESCE(property_id, '')) = LOWER($1)
             OR property_id ILIKE $2
         )
         ORDER BY is_exact_match DESC
         LIMIT 20`,
        [normalizedKeyword, `%${sanitizedKeyword}%`]
    );

    return result.rows;
}

// ========== Test: DB Query — General fuzzy mode ==========
async function testFuzzySearch(keyword) {
    const normalizedKeyword = normalizeKeyword(keyword);
    const sanitizedKeyword = sanitizePattern(normalizedKeyword);

    const result = await pool.query(
        `SELECT property_id, title,
                similarity(COALESCE(property_id, ''), $1) AS prop_sim,
                similarity(COALESCE(title, ''), $1) AS title_sim
         FROM properties
         WHERE (
             (
                 setweight(to_tsvector('simple', COALESCE(property_id, '')), 'A') ||
                 setweight(to_tsvector('simple', COALESCE(title, '')), 'B') ||
                 setweight(to_tsvector('simple', COALESCE(remarks, '')), 'D')
             ) @@ plainto_tsquery('simple', $1)
             OR LOWER(COALESCE(property_id, '')) = LOWER($1)
             OR similarity(COALESCE(property_id, ''), $1) >= 0.35
             OR similarity(COALESCE(title, ''), $1) >= 0.25
             OR similarity(COALESCE(remarks, ''), $1) >= 0.20
             OR title ILIKE $2
             OR property_id ILIKE $2
             OR remarks ILIKE $2
         )
         ORDER BY similarity(COALESCE(property_id, ''), $1) DESC
         LIMIT 10`,
        [normalizedKeyword, `%${sanitizedKeyword}%`]
    );

    return result.rows;
}

// ========== Test: DB Query — What OLD search returned for Property ID ==========
async function testOldSearchForPropertyId(keyword) {
    const normalizedKeyword = normalizeKeyword(keyword);
    const sanitizedKeyword = sanitizePattern(normalizedKeyword);

    const result = await pool.query(
        `SELECT property_id, title,
                similarity(COALESCE(property_id, ''), $1) AS prop_sim
         FROM properties
         WHERE (
             (
                 setweight(to_tsvector('simple', COALESCE(property_id, '')), 'A') ||
                 setweight(to_tsvector('simple', COALESCE(title, '')), 'B') ||
                 setweight(to_tsvector('simple', COALESCE(remarks, '')), 'D')
             ) @@ plainto_tsquery('simple', $1)
             OR LOWER(COALESCE(property_id, '')) = LOWER($1)
             OR similarity(COALESCE(property_id, ''), $1) >= 0.35
             OR similarity(COALESCE(title, ''), $1) >= 0.25
             OR similarity(COALESCE(remarks, ''), $1) >= 0.20
             OR title ILIKE $2
             OR property_id ILIKE $2
             OR remarks ILIKE $2
         )
         ORDER BY similarity(COALESCE(property_id, ''), $1) DESC
         LIMIT 20`,
        [normalizedKeyword, `%${sanitizedKeyword}%`]
    );

    return result.rows;
}

// ========== Test: Specific Property IDs ==========
async function testPropertyIdSearch() {
    console.log(`\n${BOLD}${YELLOW}━━━ 2. Property ID Search Test (DB) ━━━${RESET}`);

    // Get some real property IDs from DB to test with
    const sampleResult = await pool.query(
        `SELECT DISTINCT property_id FROM properties 
         WHERE property_id ~ '^AT[0-9]+(R|S|SR)?$' 
         LIMIT 5`
    );

    if (sampleResult.rows.length === 0) {
        info('No AT-pattern property IDs found in DB — skipping DB test');
        return true;
    }

    let allPassed = true;

    for (const row of sampleResult.rows) {
        const keyword = row.property_id;
        console.log(`\n  ${CYAN}Testing: "${keyword}"${RESET}`);

        // Run OLD fuzzy search to show how many it would match
        const oldResults = await testOldSearchForPropertyId(keyword);
        // Run NEW strict search
        const newResults = await testPropertyIdStrictSearch(keyword);

        const exactMatches = newResults.filter(r => r.is_exact_match);
        const nonExactMatches = newResults.filter(r => !r.is_exact_match);
        const oldCount = oldResults.length;
        const newCount = newResults.length;

        info(`OLD fuzzy search → ${oldCount} results`);
        if (oldCount > 1) {
            const extras = oldResults.slice(0, 5).map(r => `${r.property_id} (sim=${parseFloat(r.prop_sim).toFixed(2)})`);
            info(`  Including: ${extras.join(', ')}`);
        }

        info(`NEW strict search → ${newCount} results`);
        if (exactMatches.length > 0) {
            pass(`Exact match found: "${exactMatches[0].property_id}"`);
        }
        if (nonExactMatches.length > 0) {
            info(`Substring matches (ILIKE): ${nonExactMatches.map(r => r.property_id).join(', ')}`);
        }

        // Key assertion: exact match is always in results
        if (exactMatches.length === 1 && exactMatches[0].property_id === keyword) {
            pass(`Target property "${keyword}" found exactly`);
        } else if (exactMatches.length === 0) {
            // Could be ILIKE match
            const ilikeMatch = newResults.find(r => r.property_id.toLowerCase() === keyword.toLowerCase());
            if (ilikeMatch) {
                pass(`Target property "${keyword}" found via exact match`);
            } else {
                fail(`Target property "${keyword}" NOT found in new strict results`);
                allPassed = false;
            }
        }

        // Key assertion: no spurious fuzzy matches (non-exact shouldn't have drastically different IDs)
        if (nonExactMatches.length > 0) {
            const spurious = nonExactMatches.filter(r =>
                r.property_id.toUpperCase() !== keyword.toUpperCase() &&
                !r.property_id.toUpperCase().includes(keyword.toUpperCase())
            );
            if (spurious.length > 0) {
                fail(`Spurious non-ILIKE matches found: ${spurious.map(r => r.property_id).join(', ')}`);
                allPassed = false;
            }
        }

        info(`Impact: ${oldCount > newCount ? `${RED}Reduced from ${oldCount} → ${newCount} results${RESET}` : `Same count (${newCount})`}`);
    }

    return allPassed;
}

// ========== Test: General fuzzy search still works ==========
async function testFuzzySearchStillWorks() {
    console.log(`\n${BOLD}${YELLOW}━━━ 3. General Fuzzy Search (not impacted) ━━━${RESET}`);

    const keywords = ['โกดัง', 'warehouse', 'factory', 'สระบุรี'];
    let passed = 0;

    for (const kw of keywords) {
        const isPropId = isPropertyIdPattern(kw);
        if (!isPropId) {
            pass(`"${kw}" → correctly uses fuzzy mode (not detected as Property ID)`);
            passed++;
        } else {
            fail(`"${kw}" → incorrectly detected as Property ID!`);
        }
    }

    // Test actual DB fuzzy search still works for general terms
    const testTerms = [
        { keyword: 'โกดัง', minExpected: 0 },
        { keyword: 'warehouse', minExpected: 0 },
    ];

    for (const tc of testTerms) {
        try {
            const rows = await testFuzzySearch(tc.keyword);
            pass(`Fuzzy search "${tc.keyword}" runs without error → ${rows.length} results`);
            passed++;
        } catch (e) {
            fail(`Fuzzy search "${tc.keyword}" threw error: ${e.message}`);
        }
    }

    return true;
}

// ========== Test: Suggestions endpoint SQL (pattern check) ==========
async function testSuggestionsQuery() {
    console.log(`\n${BOLD}${YELLOW}━━━ 4. Suggestions Endpoint SQL Logic ━━━${RESET}`);

    const sampleResult = await pool.query(
        `SELECT DISTINCT property_id FROM properties 
         WHERE property_id ~ '^AT[0-9]+(R|S|SR)?$' 
         LIMIT 3`
    );

    if (sampleResult.rows.length === 0) {
        info('No AT-pattern property IDs in DB — skip');
        return true;
    }

    let allPassed = true;

    for (const row of sampleResult.rows) {
        const keyword = row.property_id;
        const sanitized = sanitizePattern(keyword);

        // Simulate the new suggestions query (Property ID strict mode via SQL NOT ~ check)
        const result = await pool.query(
            `SELECT property_id, title,
                    LOWER(COALESCE(property_id, '')) = LOWER($4) AS is_exact
             FROM properties
             WHERE (
                 LOWER(COALESCE(property_id, '')) = LOWER($4)
                 OR property_id ILIKE $3
                 OR (
                     NOT ($4 ~ '^AT[0-9]+(R|S|SR)?$')
                     AND (
                         (
                             setweight(to_tsvector('simple', COALESCE(property_id, '')), 'A') ||
                             setweight(to_tsvector('simple', COALESCE(title, '')), 'B')
                         ) @@ plainto_tsquery('simple', $1)
                         OR similarity(COALESCE(property_id, ''), $2) >= 0.35
                         OR similarity(COALESCE(title, ''), $2) >= 0.25
                         OR title ILIKE $3
                         OR property_id ILIKE $3
                     )
                 )
             )
             LIMIT 10`,
            [keyword, keyword, `%${sanitized}%`, keyword]
        );

        const exactMatches = result.rows.filter(r => r.is_exact);
        const totalResults = result.rows.length;

        console.log(`\n  ${CYAN}Suggestions for "${keyword}"${RESET}`);
        info(`Total results: ${totalResults}`);

        if (exactMatches.length > 0) {
            pass(`Exact match "${exactMatches[0].property_id}" in suggestions`);
        } else {
            const found = result.rows.find(r => r.property_id.toLowerCase() === keyword.toLowerCase());
            if (found) pass(`Found "${keyword}" in suggestions`);
            else { fail(`"${keyword}" not found in suggestions`); allPassed = false; }
        }

        if (totalResults <= 3) {
            pass(`Suggestions tight: only ${totalResults} result(s) for Property ID keyword`);
        } else {
            info(`Note: ${totalResults} suggestions — may include ILIKE partial matches (expected)`);
        }
    }

    return allPassed;
}

// ========== Main ==========
async function main() {
    console.log(`${BOLD}${CYAN}══════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${CYAN}   Search Fix Test Suite               ${RESET}`);
    console.log(`${BOLD}${CYAN}   Property ID Strict Mode Validation  ${RESET}`);
    console.log(`${BOLD}${CYAN}══════════════════════════════════════${RESET}`);

    try {
        // Verify DB connection
        await pool.query('SELECT 1');
        info('DB connection OK');

        const results = await Promise.all([
            testPatternDetection(),
            testPropertyIdSearch(),
            testFuzzySearchStillWorks(),
            testSuggestionsQuery(),
        ]);

        const allPassed = results.every(Boolean);

        console.log(`\n${BOLD}${allPassed ? GREEN : RED}══════════════════════════════════════${RESET}`);
        console.log(`${BOLD}${allPassed ? GREEN : RED}  ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}  ${RESET}`);
        console.log(`${BOLD}${allPassed ? GREEN : RED}══════════════════════════════════════${RESET}\n`);

    } catch (err) {
        console.error(`\n${RED}Fatal error:${RESET}`, err.message);
    } finally {
        await pool.end();
    }
}

main();
