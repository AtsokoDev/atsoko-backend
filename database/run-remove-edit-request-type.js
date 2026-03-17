/**
 * Remove deprecated edit request type from property_requests
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const fallbackSql = `BEGIN;

DELETE FROM property_requests
WHERE request_type = 'edit';

DO $$
DECLARE
    existing_constraint TEXT;
BEGIN
    SELECT con.conname
    INTO existing_constraint
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'property_requests'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%request_type%';

    IF existing_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE property_requests DROP CONSTRAINT %I', existing_constraint);
    END IF;
END $$;

ALTER TABLE property_requests
ADD CONSTRAINT property_requests_request_type_check
CHECK (request_type = 'delete');

COMMIT;
`;

function loadMigrationSql() {
    const sqlPath = path.join(__dirname, 'remove-edit-request-type.sql');

    if (fs.existsSync(sqlPath)) {
        return fs.readFileSync(sqlPath, 'utf8');
    }

    console.warn(`⚠️ SQL file not found at ${sqlPath}. Using embedded fallback SQL.`);
    return fallbackSql;
}

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('==============================================');
        console.log('   Removing property_requests edit type');
        console.log('==============================================\n');

        const sql = loadMigrationSql();

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
