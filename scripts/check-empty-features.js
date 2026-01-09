require('dotenv').config();
const pool = require('../config/database');

async function checkEmptyStrings() {
    try {
        console.log('🔍 Checking for empty strings in features column...\n');

        // Count empty strings
        const query = `
            SELECT COUNT(*) as count 
            FROM properties 
            WHERE features = '';
        `;

        const result = await pool.query(query);
        const count = parseInt(result.rows[0].count);

        console.log(`Found ${count} rows where features is an empty string ('').`);

        if (count > 0) {
            console.log('⚠️  This is the cause of the error!');
            console.log('   PostgreSQL throws "invalid input syntax for type json" when casting empty string to jsonb.');

            // Show sample IDs
            const sampleQuery = `SELECT id, property_id FROM properties WHERE features = '' LIMIT 5`;
            const samples = await pool.query(sampleQuery);
            console.log('   Sample IDs:', samples.rows.map(r => r.property_id).join(', '));
        } else {
            console.log('✅ No empty strings found. Investigating other causes...');
        }

        // Also check for string "null" or other weird values
        const weirdQuery = `
            SELECT id, property_id, features
            FROM properties 
            WHERE features != '' AND features != '[]' AND features IS NOT NULL
            AND features NOT LIKE '[%]'
            LIMIT 5;
        `;
        const weirdResult = await pool.query(weirdQuery);
        if (weirdResult.rows.length > 0) {
            console.log('\n⚠️  Found rows that do not look like JSON arrays:');
            weirdResult.rows.forEach(r => {
                console.log(`   ${r.property_id}: "${r.features}"`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkEmptyStrings();
