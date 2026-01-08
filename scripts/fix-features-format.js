/**
 * Script to analyze and fix malformed features data in the database
 * 
 * This script:
 * 1. Scans all properties for features with malformed format (quotes, braces, etc.)
 * 2. Attempts to parse and clean the data
 * 3. Optionally updates the database with corrected values
 * 
 * Usage:
 *   node scripts/fix-features-format.js --dry-run    # Preview changes without updating
 *   node scripts/fix-features-format.js --fix        # Actually update the database
 */

require('dotenv').config();
const { Pool } = require('pg');

// Database connection - use same config as config/database.js
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'demo_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Attempts to clean and parse a potentially malformed features value
 * @param {string} value - The raw features value from database
 * @returns {object} - { success: boolean, parsed: array|null, error: string|null }
 */
function parseFeatures(value) {
    if (!value || value === 'null' || value === 'undefined') {
        return { success: true, parsed: [], error: null };
    }

    // Clean up outer quotes if present
    let cleanValue = value.trim();
    if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
        (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
        cleanValue = cleanValue.slice(1, -1);
    }

    // Already valid JSON array
    try {
        const parsed = JSON.parse(cleanValue);
        if (Array.isArray(parsed)) {
            return { success: true, parsed, error: null };
        }
        // If it's an object, convert to array of values
        if (typeof parsed === 'object' && parsed !== null) {
            return { success: true, parsed: Object.values(parsed), error: null };
        }
    } catch {
        // Not valid JSON, try other formats
    }

    // Format: {"Feature A","Feature B"} - PostgreSQL array format
    if (cleanValue.startsWith('{') && cleanValue.endsWith('}')) {
        try {
            const inner = cleanValue.slice(1, -1);
            // Handle quoted and unquoted values
            const items = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < inner.length; i++) {
                const char = inner[i];
                const nextChar = inner[i + 1];

                if (char === '"' && !inQuotes) {
                    inQuotes = true;
                } else if (char === '"' && inQuotes) {
                    // Check for escaped quote
                    if (nextChar === '"') {
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        inQuotes = false;
                    }
                } else if (char === ',' && !inQuotes) {
                    if (current.trim()) {
                        items.push(current.trim());
                    }
                    current = '';
                } else {
                    current += char;
                }
            }
            if (current.trim()) {
                items.push(current.trim());
            }

            // Clean up any remaining quotes or special characters
            const cleaned = items.map(item =>
                item.replace(/^["']+|["']+$/g, '').trim()
            ).filter(item => item && item !== '}' && item !== '{');

            return { success: true, parsed: cleaned, error: null };
        } catch (e) {
            return { success: false, parsed: null, error: `Parse error: ${e.message}` };
        }
    }

    // Format: "Feature A","Feature B" - just quoted items
    if (cleanValue.includes('"')) {
        try {
            // Try to extract quoted strings
            const matches = cleanValue.match(/"([^"]+)"/g);
            if (matches) {
                const cleaned = matches.map(m => m.replace(/"/g, '').trim()).filter(m => m);
                return { success: true, parsed: cleaned, error: null };
            }
        } catch {
            // Continue to next format
        }
    }

    // Format: Feature A|Feature B - PIPE-separated (legacy format)
    if (cleanValue.includes('|')) {
        const items = cleanValue.split('|')
            .map(item => item.replace(/[{}"[\]]/g, '').trim())
            .filter(item => item);
        return { success: true, parsed: items, error: null };
    }

    // Format: Feature A, Feature B - comma-separated without quotes
    if (cleanValue.includes(',')) {
        const items = cleanValue.split(',')
            .map(item => item.replace(/[{}"[\]]/g, '').trim())
            .filter(item => item);
        return { success: true, parsed: items, error: null };
    }

    // Single value - clean up quotes and special characters
    const cleaned = cleanValue.replace(/[{}"[\]]/g, '').trim();
    if (cleaned) {
        return { success: true, parsed: [cleaned], error: null };
    }

    return { success: true, parsed: [], error: null };
}

async function analyzeFeatures() {
    console.log('=== Features Format Analysis ===\n');

    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const fix = args.includes('--fix');

    if (!dryRun && !fix) {
        console.log('Usage:');
        console.log('  node scripts/fix-features-format.js --dry-run    # Preview changes');
        console.log('  node scripts/fix-features-format.js --fix        # Apply fixes\n');
        console.log('Running in analysis mode (no changes)...\n');
    }

    try {
        // Get all properties with features
        const result = await pool.query(`
            SELECT id, property_id, features
            FROM properties
            WHERE features IS NOT NULL AND features != ''
            ORDER BY id
        `);

        console.log(`Found ${result.rows.length} properties with features\n`);

        const issues = [];
        const goodRecords = [];

        for (const row of result.rows) {
            const { id, property_id, features } = row;

            // Try to parse as JSON
            let isValidJson = false;
            let parsedValue = null;

            try {
                parsedValue = JSON.parse(features);
                if (Array.isArray(parsedValue)) {
                    isValidJson = true;
                }
            } catch {
                isValidJson = false;
            }

            if (isValidJson) {
                // Check if any element has malformed content
                const hasMalformedElements = parsedValue.some(item =>
                    typeof item === 'string' && (
                        item.includes('"}') ||
                        item.includes('{"') ||
                        item.startsWith('"') ||
                        item.endsWith('"')
                    )
                );

                if (hasMalformedElements) {
                    issues.push({
                        id,
                        property_id,
                        original: features,
                        problem: 'Array elements contain quote/brace artifacts',
                        parsed: parsedValue
                    });
                } else {
                    goodRecords.push({ id, property_id, features: parsedValue });
                }
            } else {
                // Not valid JSON, try to parse and fix
                const parseResult = parseFeatures(features);

                if (parseResult.success) {
                    issues.push({
                        id,
                        property_id,
                        original: features,
                        problem: 'Not valid JSON format',
                        suggested: parseResult.parsed
                    });
                } else {
                    issues.push({
                        id,
                        property_id,
                        original: features,
                        problem: `Cannot parse: ${parseResult.error}`,
                        suggested: null
                    });
                }
            }
        }

        console.log(`✅ Valid records: ${goodRecords.length}`);
        console.log(`⚠️  Records with issues: ${issues.length}\n`);

        if (issues.length > 0) {
            console.log('=== Records with Issues ===\n');

            for (const issue of issues) {
                console.log(`Property: ${issue.property_id} (ID: ${issue.id})`);
                console.log(`  Problem: ${issue.problem}`);
                console.log(`  Original: ${JSON.stringify(issue.original)}`);
                if (issue.suggested) {
                    console.log(`  Suggested fix: ${JSON.stringify(issue.suggested)}`);
                }
                if (issue.parsed) {
                    // Clean up the parsed elements
                    const cleaned = issue.parsed.map(item =>
                        typeof item === 'string'
                            ? item.replace(/[{}"]/g, '').trim()
                            : item
                    ).filter(item => item);
                    console.log(`  Cleaned: ${JSON.stringify(cleaned)}`);
                    issue.suggested = cleaned;
                }
                console.log('');
            }

            if (fix) {
                console.log('\n=== Applying Fixes ===\n');

                let fixed = 0;
                let failed = 0;

                for (const issue of issues) {
                    if (issue.suggested && issue.suggested.length > 0) {
                        try {
                            await pool.query(
                                'UPDATE properties SET features = $1, updated_at = NOW() WHERE id = $2',
                                [JSON.stringify(issue.suggested), issue.id]
                            );
                            console.log(`✅ Fixed ${issue.property_id}: ${JSON.stringify(issue.suggested)}`);
                            fixed++;
                        } catch (err) {
                            console.log(`❌ Failed to fix ${issue.property_id}: ${err.message}`);
                            failed++;
                        }
                    } else {
                        console.log(`⏭️  Skipped ${issue.property_id}: No suggested fix available`);
                    }
                }

                console.log(`\n=== Summary ===`);
                console.log(`Fixed: ${fixed}`);
                console.log(`Failed: ${failed}`);
                console.log(`Skipped: ${issues.length - fixed - failed}`);
            } else if (dryRun) {
                console.log('\n=== Dry Run Mode ===');
                console.log('No changes were made. Run with --fix to apply changes.');
            }
        }

        // Sample of good records
        if (goodRecords.length > 0) {
            console.log('\n=== Sample Valid Records ===\n');
            const sample = goodRecords.slice(0, 5);
            for (const record of sample) {
                console.log(`${record.property_id}: ${JSON.stringify(record.features)}`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

analyzeFeatures();
