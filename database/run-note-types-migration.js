/**
 * Run note_types migration
 */
require('dotenv').config();
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('=====================================');
        console.log('   Running note_types Migration');
        console.log('=====================================\n');

        await client.query('BEGIN');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'note-types-migration.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split and run statements
        const statements = sql.split(';').filter(s => s.trim());

        for (const stmt of statements) {
            if (stmt.trim()) {
                try {
                    await client.query(stmt);
                    console.log('✅ Executed:', stmt.substring(0, 50) + '...');
                } catch (error) {
                    // Ignore "already exists" errors
                    if (error.code === '42P07' || error.code === '42710') {
                        console.log('⏭️  Already exists:', stmt.substring(0, 50) + '...');
                    } else if (error.code === '23505') {
                        console.log('⏭️  Data already inserted');
                    } else {
                        throw error;
                    }
                }
            }
        }

        await client.query('COMMIT');

        // Verify
        const result = await pool.query('SELECT * FROM note_types ORDER BY sort_order');
        console.log('\n📋 Note Types in database:');
        console.table(result.rows.map(r => ({
            code: r.code,
            name_th: r.name_th,
            allowed_roles: r.allowed_roles.join(', '),
            is_active: r.is_active
        })));

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);
