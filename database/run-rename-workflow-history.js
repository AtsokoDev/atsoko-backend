/**
 * Rename workflow_history columns to match moderation/publication model
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const fallbackSql = `BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'previous_workflow_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN previous_workflow_status TO previous_moderation_status;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'new_workflow_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN new_workflow_status TO new_moderation_status;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'previous_approval_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN previous_approval_status TO previous_publication_status;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'workflow_history'
          AND column_name = 'new_approval_status'
    ) THEN
        ALTER TABLE workflow_history RENAME COLUMN new_approval_status TO new_publication_status;
    END IF;
END $$;

COMMIT;
`;

function loadMigrationSql() {
    const sqlPath = path.join(__dirname, 'rename-workflow-history-columns.sql');

    if (fs.existsSync(sqlPath)) {
        return fs.readFileSync(sqlPath, 'utf8');
    }

    console.warn(`⚠️ SQL file not found at ${sqlPath}. Using embedded fallback SQL.`);
    return fallbackSql;
}

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('====================================================');
        console.log('   Renaming workflow_history status columns');
        console.log('====================================================\n');

        const sql = loadMigrationSql();

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
