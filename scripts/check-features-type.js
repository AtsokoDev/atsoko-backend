require('dotenv').config();
const pool = require('../config/database');

async function checkFeaturesType() {
    try {
        console.log('🔍 Checking features data type and format...\n');

        // Check database schema
        console.log('1️⃣ Database Schema:');
        const schemaQuery = `
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'properties' AND column_name = 'features';
        `;
        const schemaResult = await pool.query(schemaQuery);
        console.log('Schema:', schemaResult.rows[0]);
        console.log('');

        // Get sample data
        console.log('2️⃣ Sample Data (first 5 properties with features):');
        const sampleQuery = `
            SELECT id, property_id, features, 
                   pg_typeof(features) as features_type,
                   length(features) as features_length
            FROM properties 
            WHERE features IS NOT NULL AND features != '' AND features != '[]'
            LIMIT 5;
        `;
        const sampleResult = await pool.query(sampleQuery);
        sampleResult.rows.forEach((row, idx) => {
            console.log(`\n${idx + 1}. Property ID: ${row.property_id} (id: ${row.id})`);
            console.log(`   Type: ${row.features_type}`);
            console.log(`   Length: ${row.features_length}`);
            console.log(`   Raw: ${row.features}`);

            // Try to parse as JSON
            try {
                const parsed = JSON.parse(row.features);
                console.log(`   ✅ Valid JSON:`, parsed);
            } catch (e) {
                console.log(`   ❌ Invalid JSON: ${e.message}`);
            }
        });

        // Check how many have "Free-trade zone"
        console.log('\n\n3️⃣ Properties with "Free-trade zone":');
        const freeTradeQuery = `
            SELECT COUNT(*) as total
            FROM properties 
            WHERE features ILIKE '%Free-trade zone%';
        `;
        const freeTradeResult = await pool.query(freeTradeQuery);
        console.log(`Total with "Free-trade zone" (ILIKE): ${freeTradeResult.rows[0].total}`);

        // Test JSONB contains query
        console.log('\n4️⃣ Testing JSONB contains query:');
        try {
            const jsonbQuery = `
                SELECT COUNT(*) as total
                FROM properties 
                WHERE features::jsonb @> '["Free-trade zone"]'::jsonb;
            `;
            const jsonbResult = await pool.query(jsonbQuery);
            console.log(`✅ JSONB query works! Total: ${jsonbResult.rows[0].total}`);
        } catch (e) {
            console.log(`❌ JSONB query failed: ${e.message}`);
        }

        // Test JSON contains (alternative)
        console.log('\n5️⃣ Testing JSON contains (alternative):');
        try {
            const jsonContainsQuery = `
                SELECT COUNT(*) as total
                FROM properties 
                WHERE features::jsonb ? 'Free-trade zone';
            `;
            const jsonContainsResult = await pool.query(jsonContainsQuery);
            console.log(`✅ JSON ? operator works! Total: ${jsonContainsResult.rows[0].total}`);
        } catch (e) {
            console.log(`❌ JSON ? operator failed: ${e.message}`);
        }

        console.log('\n✅ Analysis complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkFeaturesType();
