require('dotenv').config();
const pool = require('../config/database');

async function fixEmptyFeatures() {
    try {
        console.log('🛠️ Fixing empty string features in database...\n');

        // Count before
        const checkQuery = "SELECT COUNT(*) as count FROM properties WHERE features = ''";
        const beforeResult = await pool.query(checkQuery);
        const count = parseInt(beforeResult.rows[0].count);

        console.log(`Found ${count} rows to fix.`);

        if (count === 0) {
            console.log('✅ Nothing to fix.');
            process.exit(0);
        }

        // Update empty strings to empty JSON array '[]'
        const updateQuery = `
            UPDATE properties 
            SET features = '[]'
            WHERE features = '';
        `;

        await pool.query(updateQuery);
        console.log('✅ Update executed successfully.');

        // Verify
        const afterResult = await pool.query(checkQuery);
        console.log(`Remaining empty strings: ${afterResult.rows[0].count}`);

        console.log('\n✨ Database is now safe for JSONB queries!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error executing update:', error);
        process.exit(1);
    }
}

fixEmptyFeatures();
