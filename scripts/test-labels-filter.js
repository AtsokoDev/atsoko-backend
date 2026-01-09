require('dotenv').config();
const pool = require('../config/database');

async function testLabelsFilter() {
    try {
        console.log('🧪 Testing "Zone Type" (labels) Filter Logic...\n');

        // Helper function to simulate backend logic
        async function runTest(testName, zones) {
            console.log(`\n📋 Test Case: ${testName}`);
            console.log(`   Searching for: ${JSON.stringify(zones)}`);

            let query = 'SELECT id, property_id, labels FROM properties WHERE 1=1';
            const params = [];
            let paramCount = 1;

            // Simulated Backend Logic
            const labelsArray = Array.isArray(zones) ? zones : [zones];

            labelsArray.forEach(label => {
                // sanitizePattern simulation (escape % and _)
                const sanitizedLabel = label.replace(/[%_]/g, '\\$&');

                query += ` AND labels ILIKE $${paramCount}`;
                params.push(`%${sanitizedLabel}%`);
                paramCount++;
            });

            // Add limit to see samples
            query += ` LIMIT 5`;

            console.log(`   Generated Query: ${query}`);
            console.log(`   Params: ${JSON.stringify(params)}`);

            const result = await pool.query(query, params);
            console.log(`   ✅ Found ${result.rows.length} sample rows.`);

            if (result.rows.length > 0) {
                console.log('   Sample Results:');
                result.rows.forEach(r => {
                    console.log(`      - ${r.property_id}: "${r.labels}"`);
                });
            } else {
                console.log('      (No matches found)');
            }
        }

        // Test 1: Single Zone (Most common)
        await runTest('Single Zone Filter', ['Purple zone']);

        // Test 2: Multiple Zones (Should be AND logic - must have ALL)
        // From previous check, we know 'W-001' has "Free-trade zone|Industrial estate zone|Purple zone"
        // So searching for 'Purple zone' AND 'Free-trade zone' should find it.
        await runTest('Multiple Zones (AND Logic)', ['Purple zone', 'Free-trade zone']);

        // Test 3: Partial Match (Case Insensitive)
        await runTest('Partial Match (ILIKE)', ['free trade']);

        // Test 4: Non-existent combination
        await runTest('Non-existent Combination', ['Purple zone', 'NonExistentZone']);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testLabelsFilter();
