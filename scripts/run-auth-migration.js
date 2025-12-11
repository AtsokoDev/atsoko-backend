/**
 * Run auth schema migration
 * Usage: node scripts/run-auth-migration.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const runMigration = async () => {
    console.log('Running auth schema migration...');

    try {
        // Read the SQL file
        const sqlPath = path.join(__dirname, '../database/auth-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute the SQL
        await pool.query(sql);

        console.log('✅ Auth schema migration completed successfully!');
        console.log('Tables created: users, refresh_tokens');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }

    process.exit(0);
};

runMigration();
