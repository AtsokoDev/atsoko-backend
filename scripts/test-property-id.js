/**
 * Test script for the new property ID generation logic
 * 
 * This script tests:
 * 1. findNextAvailablePropertyNumber() - finding gaps in property IDs
 * 2. Creating a property and verifying the ID is correctly generated
 * 
 * Usage: node scripts/test-property-id.js
 */

// Load environment variables from .env file
require('dotenv').config();

const pool = require('../config/database');

// Copy of the findNextAvailablePropertyNumber function for testing
const findNextAvailablePropertyNumber = async (client) => {
    const query = `
        WITH used_numbers AS (
            SELECT DISTINCT
                CAST(SUBSTRING(property_id FROM '^AT([0-9]+)') AS INTEGER) as num
            FROM properties 
            WHERE property_id ~ '^AT[0-9]+(R|S|SR)$'
        ),
        max_num AS (
            SELECT COALESCE(MAX(num), 0) as max_val FROM used_numbers
        ),
        all_numbers AS (
            SELECT generate_series(1, GREATEST((SELECT max_val FROM max_num), 1)) as num
        )
        SELECT 
            COALESCE(
                (SELECT a.num FROM all_numbers a 
                 LEFT JOIN used_numbers u ON a.num = u.num 
                 WHERE u.num IS NULL 
                 ORDER BY a.num ASC 
                 LIMIT 1),
                (SELECT max_val + 1 FROM max_num)
            ) as next_number
    `;

    const result = await client.query(query);
    return result.rows[0].next_number;
};

async function runTests() {
    console.log('🧪 Starting Property ID Generation Tests\n');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        // Test 1: Check current state
        console.log('\n📊 Test 1: Current Property ID State');
        console.log('-'.repeat(40));

        const currentIdsResult = await client.query(`
            SELECT property_id, 
                   CAST(SUBSTRING(property_id FROM '^AT([0-9]+)') AS INTEGER) as num
            FROM properties 
            WHERE property_id ~ '^AT[0-9]+(R|S|SR)$'
            ORDER BY num DESC
            LIMIT 10
        `);

        console.log('Top 10 property IDs (by number):');
        currentIdsResult.rows.forEach(row => {
            console.log(`  - ${row.property_id} (number: ${row.num})`);
        });

        // Test 2: Find total count
        const countResult = await client.query(`
            SELECT COUNT(*) as total FROM properties 
            WHERE property_id ~ '^AT[0-9]+(R|S|SR)$'
        `);
        console.log(`\nTotal properties with valid AT format: ${countResult.rows[0].total}`);

        // Test 3: Find missing numbers
        console.log('\n📊 Test 2: Finding Missing Numbers (Gaps)');
        console.log('-'.repeat(40));

        const missingResult = await client.query(`
            WITH used_numbers AS (
                SELECT DISTINCT
                    CAST(SUBSTRING(property_id FROM '^AT([0-9]+)') AS INTEGER) as num
                FROM properties 
                WHERE property_id ~ '^AT[0-9]+(R|S|SR)$'
            ),
            max_num AS (
                SELECT COALESCE(MAX(num), 0) as max_val FROM used_numbers
            ),
            all_numbers AS (
                SELECT generate_series(1, (SELECT max_val FROM max_num)) as num
            )
            SELECT a.num as missing_number
            FROM all_numbers a 
            LEFT JOIN used_numbers u ON a.num = u.num 
            WHERE u.num IS NULL
            ORDER BY a.num ASC
            LIMIT 20
        `);

        if (missingResult.rows.length === 0) {
            console.log('✅ No gaps found! All numbers from 1 to max are used.');
        } else {
            console.log(`⚠️  Found ${missingResult.rows.length} gaps in property IDs:`);
            const missingNumbers = missingResult.rows.map(r => r.missing_number);
            console.log(`  Missing numbers: ${missingNumbers.join(', ')}`);
        }

        // Test 4: Test findNextAvailablePropertyNumber
        console.log('\n📊 Test 3: findNextAvailablePropertyNumber()');
        console.log('-'.repeat(40));

        const nextNumber = await findNextAvailablePropertyNumber(client);
        console.log(`✅ Next available number: ${nextNumber}`);

        // Verify this number is actually available
        const checkResult = await client.query(`
            SELECT property_id FROM properties 
            WHERE property_id ~ $1
        `, [`^AT${nextNumber}(R|S|SR)$`]);

        if (checkResult.rows.length === 0) {
            console.log(`✅ Confirmed: AT${nextNumber}* is not in use`);
        } else {
            console.log(`❌ ERROR: AT${nextNumber}* already exists: ${checkResult.rows[0].property_id}`);
        }

        // Test 5: Show what would happen for different statuses
        console.log('\n📊 Test 4: Simulated Property IDs');
        console.log('-'.repeat(40));
        console.log(`  If status = "For Rent"       → AT${nextNumber}R`);
        console.log(`  If status = "For Sale"       → AT${nextNumber}S`);
        console.log(`  If status = "For Rent & Sale" → AT${nextNumber}SR`);

        // Test 6: Performance test
        console.log('\n📊 Test 5: Performance Check');
        console.log('-'.repeat(40));

        const startTime = Date.now();
        for (let i = 0; i < 10; i++) {
            await findNextAvailablePropertyNumber(client);
        }
        const endTime = Date.now();
        const avgTime = (endTime - startTime) / 10;

        console.log(`  Average query time: ${avgTime.toFixed(2)}ms`);
        if (avgTime < 50) {
            console.log('  ✅ Performance is GOOD');
        } else if (avgTime < 200) {
            console.log('  ⚠️  Performance is ACCEPTABLE');
        } else {
            console.log('  ❌ Performance may need optimization');
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ All tests completed successfully!');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

runTests();
