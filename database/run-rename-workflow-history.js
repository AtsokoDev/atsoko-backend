/**
 * Rename workflow_history columns to match moderation/publication model
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('====================================================');
        console.log('   Renaming workflow_history status columns');
        console.log('====================================================\n');

        const sqlPath = path.join(__dirname, 'rename-workflow-history-columns.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);

        const columns = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'workflow_history'
            ORDER BY ordinal_position
        `);

        console.log('✅ Migration completed successfully!');
        console.log('\n📋 workflow_history columns:');
        console.table(columns.rows);
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
