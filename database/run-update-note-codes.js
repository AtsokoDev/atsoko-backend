const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function updateNoteCodes() {
    const client = await pool.connect();

    try {
        console.log('🔧 Updating Note Types Codes...\n');

        // Check current state
        console.log('📋 Current note types:');
        const before = await client.query('SELECT code, name FROM note_types ORDER BY code');
        before.rows.forEach(row => {
            console.log(`   ${row.code} → ${row.name}`);
        });

        // Check if old codes exist
        const oldCodes = await client.query(
            "SELECT code FROM note_types WHERE code IN ('a', 'b', 'c', 'd', 'e')"
        );

        if (oldCodes.rows.length === 0) {
            console.log('\n✅ Note types are already using standard codes!');

            // Still verify we have the required ones
            const result = await client.query('SELECT code FROM note_types');
            const codes = result.rows.map(r => r.code);
            const required = ['general', 'fix_request', 'fix_response', 'approval', 'rejection'];
            const missing = required.filter(c => !codes.includes(c));

            if (missing.length > 0) {
                console.log('\n⚠️  Missing required note types:', missing.join(', '));
            } else {
                console.log('✅ All required note types exist!');
            }
            return;
        }

        console.log(`\n⚠️  Found ${oldCodes.rows.length} old codes to update\n`);

        // Check how many notes will be affected
        const notesCount = await client.query(`
            SELECT note_type, COUNT(*) as count
            FROM property_notes
            WHERE note_type IN ('a', 'b', 'c', 'd', 'e')
            GROUP BY note_type
        `);

        if (notesCount.rows.length > 0) {
            console.log('📝 Property notes that will be updated:');
            notesCount.rows.forEach(row => {
                console.log(`   ${row.note_type}: ${row.count} notes`);
            });
            console.log('');
        }

        // Run the migration
        console.log('🚀 Running migration...');
        const sqlPath = path.join(__dirname, 'update-note-types-codes.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);

        console.log('✅ Migration completed!\n');

        // Verify results
        console.log('📊 Updated note types:');
        const after = await client.query(`
            SELECT code, name, allowed_roles, is_active, sort_order
            FROM note_types
            ORDER BY sort_order
        `);

        after.rows.forEach(row => {
            const rolesStr = Array.isArray(row.allowed_roles)
                ? row.allowed_roles.join(', ')
                : row.allowed_roles;
            const status = row.is_active ? '✅' : '❌';
            console.log(`${status} [${row.code.padEnd(15)}] ${row.name.padEnd(20)} | ${rolesStr}`);
        });

        console.log('\n✅ All done!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

updateNoteCodes();
