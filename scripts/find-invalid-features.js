require('dotenv').config();
const pool = require('../config/database');

async function findInvalidJSON() {
    try {
        console.log('🔍 Finding properties with invalid JSON in features...\n');

        const query = `
            SELECT id, property_id, features
            FROM properties
            WHERE features IS NOT NULL 
              AND features != ''
              AND features != '[]'
            ORDER BY id;
        `;

        const result = await pool.query(query);
        console.log(`Total properties with features: ${result.rows.length}\n`);

        let validCount = 0;
        let invalidCount = 0;
        const invalidProperties = [];

        result.rows.forEach(row => {
            try {
                JSON.parse(row.features);
                validCount++;
            } catch (e) {
                invalidCount++;
                invalidProperties.push({
                    id: row.id,
                    property_id: row.property_id,
                    features: row.features,
                    error: e.message
                });
            }
        });

        console.log(`✅ Valid JSON: ${validCount}`);
        console.log(`❌ Invalid JSON: ${invalidCount}\n`);

        if (invalidCount > 0) {
            console.log('❌ Properties with invalid JSON:');
            console.log('='.repeat(80));
            invalidProperties.forEach((prop, idx) => {
                console.log(`\n${idx + 1}. Property ID: ${prop.property_id} (id: ${prop.id})`);
                console.log(`   Features: ${prop.features}`);
                console.log(`   Error: ${prop.error}`);
            });

            console.log('\n\n💡 To fix these, you need to update the features to valid JSON format.');
        } else {
            console.log('✅ All features data are valid JSON!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

findInvalidJSON();
