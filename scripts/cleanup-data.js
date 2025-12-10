/**
 * Data Cleanup Script
 * Cleans dirty data in properties table
 */

require('dotenv').config();
const pool = require('../config/database');

async function cleanup() {
    console.log('🧹 Starting data cleanup...\n');

    try {
        // 1. Fix price_postfix case
        let result = await pool.query(
            "UPDATE properties SET price_postfix = 'Month' WHERE LOWER(price_postfix) = 'month' AND price_postfix != 'Month'"
        );
        console.log('✅ Price postfix normalized:', result.rowCount, 'rows');

        // 2. Normalize size_prefix
        result = await pool.query(
            "UPDATE properties SET size_prefix = 'sqm' WHERE size_prefix = 'sq.m'"
        );
        console.log('✅ Size prefix normalized:', result.rowCount, 'rows');

        // 3. Remove junk electricity values
        result = await pool.query(
            "UPDATE properties SET electricity_system = NULL WHERE electricity_system = '1'"
        );
        console.log('✅ Junk electricity removed:', result.rowCount, 'rows');

        // 4. Remove junk clear_height values
        result = await pool.query(
            "UPDATE properties SET clear_height = NULL WHERE clear_height IN ('1', '99')"
        );
        console.log('✅ Junk clear_height removed:', result.rowCount, 'rows');

        // 5. Fix malformed features (PHP serialized and test data)
        result = await pool.query(
            "UPDATE properties SET features = NULL WHERE features LIKE 'a:%' OR features LIKE '%ทดสอบ%' OR features LIKE '%{\"1\"}%'"
        );
        console.log('✅ Malformed features cleaned:', result.rowCount, 'rows');

        // 6. Fix junk labels
        result = await pool.query(
            "UPDATE properties SET labels = NULL WHERE labels = '1'"
        );
        console.log('✅ Junk labels removed:', result.rowCount, 'rows');

        console.log('\n✅ Data cleanup completed!');

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

cleanup();
