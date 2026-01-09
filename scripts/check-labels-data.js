require('dotenv').config();
const pool = require('../config/database');

async function checkLabelsData() {
    try {
        console.log('🔍 Checking labels column data (Zone Type)...\n');

        // 1. Check data type in schema
        /* We know from schema.sql it is TEXT */

        // 2. Sample data
        const query = `
            SELECT id, property_id, labels 
            FROM properties 
            WHERE labels IS NOT NULL AND labels != '' 
            LIMIT 10;
        `;

        const result = await pool.query(query);
        console.log(`Found sample data (${result.rows.length} rows):`);

        result.rows.forEach(r => {
            console.log(`   ${r.property_id}: "${r.labels}"`);
        });

        // 3. Count distinct values to see common zones
        const distinctQuery = `
            SELECT labels, COUNT(*) as count 
            FROM properties 
            WHERE labels IS NOT NULL AND labels != ''
            GROUP BY labels 
            ORDER BY count DESC 
            LIMIT 10;
        `;
        const distinctResult = await pool.query(distinctQuery);
        console.log('\nPopular Zone Types:');
        distinctResult.rows.forEach(r => {
            console.log(`   "${r.labels}": ${r.count}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkLabelsData();
