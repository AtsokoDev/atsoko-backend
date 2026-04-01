/**
 * Add performance indexes for tips search API
 * Safe to run multiple times — all indexes use IF NOT EXISTS
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const SQL_FILE = path.join(__dirname, 'add-tips-search-indexes.sql');
const INLINE_SQL = `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tips_search_vector
ON tips
USING GIN (
    to_tsvector(
        'simple',
        COALESCE(title, '') || ' ' ||
        COALESCE(excerpt, '') || ' ' ||
        REGEXP_REPLACE(COALESCE(content, ''), '<[^>]+>', ' ', 'g')
    )
);

CREATE INDEX IF NOT EXISTS idx_tips_title_trgm
ON tips
USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tips_excerpt_trgm
ON tips
USING GIN (excerpt gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tips_content_trgm
ON tips
USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tips_published_created
ON tips (published_at DESC, created_at DESC);
`;

async function run() {
    const client = await pool.connect();
    try {
        const sql = fs.existsSync(SQL_FILE)
            ? fs.readFileSync(SQL_FILE, 'utf8')
            : INLINE_SQL;

        if (!fs.existsSync(SQL_FILE)) {
            console.warn('SQL file not found, using embedded migration SQL:', SQL_FILE);
        }

        console.log('Adding tips search indexes...');
        await client.query(sql);
        console.log('✅ Tips search indexes created (or already exist)');
    } finally {
        client.release();
        await pool.end();
    }
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
