/**
 * Remove deprecated edit request type from property_requests
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('==============================================');
        console.log('   Removing property_requests edit type');
        console.log('==============================================\n');

        const sqlPath = path.join(__dirname, 'remove-edit-request-type.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);

        const remaining = await client.query(`
            SELECT request_type, COUNT(*) AS count
            FROM property_requests
            GROUP BY request_type
            ORDER BY request_type
        `);

        console.log('✅ Migration completed successfully!');
        console.log('\n📋 Remaining request types:');
        console.table(remaining.rows);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
