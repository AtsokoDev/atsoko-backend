/**
 * Add performance indexes for activity-logs API
 * Safe to run multiple times — all indexes use IF NOT EXISTS
 */
require('dotenv').config();
const pool = require('../config/database');

const SQL = `
    CREATE INDEX IF NOT EXISTS idx_workflow_history_created_at_desc
        ON workflow_history (created_at DESC, id DESC);

    CREATE INDEX IF NOT EXISTS idx_workflow_history_property_created
        ON workflow_history (property_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_workflow_history_changed_by_created
        ON workflow_history (changed_by, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_workflow_history_new_mod_status
        ON workflow_history (new_moderation_status);

    CREATE INDEX IF NOT EXISTS idx_workflow_history_new_pub_status
        ON workflow_history (new_publication_status);

    CREATE INDEX IF NOT EXISTS idx_properties_agent_team
        ON properties (agent_team);
`;

async function run() {
    const client = await pool.connect();
    try {
        console.log('Adding activity-logs indexes...');
        await client.query(SQL);
        console.log('✅ Indexes created (or already exist)');
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});

