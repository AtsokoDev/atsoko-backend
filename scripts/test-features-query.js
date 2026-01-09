require('dotenv').config();
const pool = require('../config/database');

async function testFeaturesQuery() {
    try {
        console.log('🧪 Testing different features query methods...\n');

        const testFeature = 'Free-trade zone';
        const testFeaturesArray = ['Free-trade zone'];

        console.log(`Testing with feature: "${testFeature}"\n`);
        console.log('='.repeat(80));

        // Method 1: ILIKE (current fallback)
        console.log('\n1️⃣ Method: ILIKE (simple text search)');
        try {
            const query1 = `
                SELECT COUNT(*) as total, 
                       array_agg(property_id ORDER BY id LIMIT 5) as sample_ids
                FROM properties 
                WHERE features ILIKE $1;
            `;
            const result1 = await pool.query(query1, [`%${testFeature}%`]);
            console.log('✅ Success!');
            console.log('   Total:', result1.rows[0].total);
            console.log('   Sample IDs:', result1.rows[0].sample_ids);
        } catch (e) {
            console.log('❌ Failed:', e.message);
        }

        // Method 2: JSONB @> operator (current code - line 279)
        console.log('\n2️⃣ Method: JSONB @> operator (current implementation)');
        try {
            const query2 = `
                SELECT COUNT(*) as total,
                       array_agg(property_id ORDER BY id LIMIT 5) as sample_ids
                FROM properties 
                WHERE features::jsonb @> $1::jsonb;
            `;
            const result2 = await pool.query(query2, [JSON.stringify(testFeaturesArray)]);
            console.log('✅ Success!');
            console.log('   Total:', result2.rows[0].total);
            console.log('   Sample IDs:', result2.rows[0].sample_ids);
        } catch (e) {
            console.log('❌ Failed:', e.message);
            console.log('   This is the current error in production!');
        }

        // Method 3: JSONB ? operator
        console.log('\n3️⃣ Method: JSONB ? operator (check if array contains value)');
        try {
            const query3 = `
                SELECT COUNT(*) as total,
                       array_agg(property_id ORDER BY id LIMIT 5) as sample_ids
                FROM properties 
                WHERE features::jsonb ? $1;
            `;
            const result3 = await pool.query(query3, [testFeature]);
            console.log('✅ Success!');
            console.log('   Total:', result3.rows[0].total);
            console.log('   Sample IDs:', result3.rows[0].sample_ids);
        } catch (e) {
            console.log('❌ Failed:', e.message);
        }

        // Method 4: Check which properties cause the issue
        console.log('\n4️⃣ Finding problematic properties...');
        try {
            const query4 = `
                SELECT id, property_id, features,
                       CASE 
                           WHEN features IS NULL THEN 'NULL'
                           WHEN features = '' THEN 'EMPTY STRING'
                           WHEN features = '[]' THEN 'EMPTY ARRAY'
                           ELSE 'HAS DATA'
                       END as status
                FROM properties
                LIMIT 10;
            `;
            const result4 = await pool.query(query4);
            console.log('Sample properties:');
            result4.rows.forEach((row, idx) => {
                console.log(`   ${idx + 1}. ${row.property_id}: ${row.status} - ${row.features?.substring(0, 50) || 'null'}`);
            });
        } catch (e) {
            console.log('❌ Failed:', e.message);
        }

        // Method 5: Test casting on all rows
        console.log('\n5️⃣ Testing JSONB cast on all features...');
        try {
            const query5 = `
                SELECT COUNT(*) as total_castable
                FROM properties
                WHERE features IS NOT NULL 
                  AND features != ''
                  AND features::jsonb IS NOT NULL;
            `;
            const result5 = await pool.query(query5);
            console.log('✅ Success!');
            console.log('   Total castable to JSONB:', result5.rows[0].total_castable);
        } catch (e) {
            console.log('❌ Failed:', e.message);
            console.log('   Exact error:', e);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ Test complete!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
        process.exit(1);
    }
}

testFeaturesQuery();
