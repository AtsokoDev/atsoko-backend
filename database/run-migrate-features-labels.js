/**
 * Migration: Migrate features and labels columns from TEXT to JSONB
 * This provides better performance and proper JSON handling
 *
 * Run: npm run migrate:features-labels-jsonb
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Embedded fallback SQL in case the external file is missing
const fallbackSql = `
-- ============================================================
-- Migrate features and labels columns from TEXT to JSONB
-- ============================================================
BEGIN;

-- Drop existing indexes that might use these columns
DROP INDEX IF EXISTS idx_properties_features;
DROP INDEX IF EXISTS idx_properties_labels;

-- Add temporary columns for new JSONB data
ALTER TABLE properties
ADD COLUMN features_jsonb JSONB DEFAULT '[]'::jsonb,
ADD COLUMN labels_jsonb JSONB DEFAULT '[]'::jsonb;

-- Migrate data from TEXT to JSONB
UPDATE properties SET 
    features_jsonb = CASE
        WHEN features IS NULL THEN '[]'::jsonb
        WHEN features = '' THEN '[]'::jsonb
        WHEN features = '[]' THEN '[]'::jsonb
        ELSE features::jsonb
    END,
    labels_jsonb = CASE
        WHEN labels IS NULL THEN '[]'::jsonb
        WHEN labels = '' THEN '[]'::jsonb
        WHEN labels = '[]' THEN '[]'::jsonb
        ELSE labels::jsonb
    END
WHERE TRUE;

-- Drop old columns
ALTER TABLE properties
DROP COLUMN features,
DROP COLUMN labels;

-- Rename new JSONB columns to original names
ALTER TABLE properties
RENAME COLUMN features_jsonb TO features;

ALTER TABLE properties
RENAME COLUMN labels_jsonb TO labels;

-- Create indexes on new JSONB columns
CREATE INDEX idx_properties_features_gin ON properties USING GIN(features);
CREATE INDEX idx_properties_labels_gin ON properties USING GIN(labels);

COMMIT;
`;

/**
 * Load migration SQL from file with fallback to embedded SQL
 */
async function loadMigrationSql() {
    const sqlFile = path.join(__dirname, 'migrate-features-labels-to-jsonb.sql');
    try {
        return fs.readFileSync(sqlFile, 'utf8');
    } catch (err) {
        console.log('[MIGRATION] SQL file not found, using embedded fallback SQL');
        return fallbackSql;
    }
}

/**
 * Check current state of features and labels columns
 */
async function checkColumnState(client) {
    const result = await client.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = 'properties' AND column_name IN ('features', 'labels')
         ORDER BY column_name`
    );
    return result.rows;
}

/**
 * Run the migration
 */
async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('\n════════════════════════════════════════════');
        console.log('   Migrating features/labels to JSONB');
        console.log('════════════════════════════════════════════\n');

        // Check current state
        const beforeState = await checkColumnState(client);
        console.log('📋 Current column state:');
        beforeState.forEach(col => {
            console.log(`   ${col.column_name}: ${col.data_type}`);
        });
        console.log('');

        // Load and execute migration SQL
        const migrationSql = await loadMigrationSql();
        
        console.log('⏳ Running migration...\n');
        await client.query(migrationSql);

        // Verify migration success
        const afterState = await checkColumnState(client);
        console.log('✅ Migration completed!\n');
        console.log('📋 New column state:');
        afterState.forEach(col => {
            console.log(`   ${col.column_name}: ${col.data_type}`);
        });
        console.log('');

        // Show sample of converted data
        const sampleData = await client.query(
            `SELECT id, features, labels FROM properties WHERE (features IS NOT NULL OR labels IS NOT NULL) LIMIT 3`
        );
        
        if (sampleData.rows.length > 0) {
            console.log('📊 Sample migrated data:');
            console.table(sampleData.rows.map(row => ({
                id: row.id,
                features: JSON.stringify(row.features || []),
                labels: JSON.stringify(row.labels || [])
            })));
        }

        // Get statistics
        const stats = await client.query(`
            SELECT 
                COUNT(*) as total_properties,
                COUNT(CASE WHEN features IS NOT NULL AND jsonb_array_length(features) > 0 THEN 1 END) as properties_with_features,
                COUNT(CASE WHEN labels IS NOT NULL AND jsonb_array_length(labels) > 0 THEN 1 END) as properties_with_labels
            FROM properties
        `);
        
        const stat = stats.rows[0];
        console.log('📈 Migration Statistics:');
        console.log(`   Total properties: ${stat.total_properties}`);
        console.log(`   Properties with features: ${stat.properties_with_features}`);
        console.log(`   Properties with labels: ${stat.properties_with_labels}\n`);

        console.log('✅ Migration completed successfully!');
        console.log('💡 The backend code already uses ::jsonb casting, so no code changes needed.\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nError details:');
        console.error(error);
        throw error;
    } finally {
        client.release();
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('✅ All migrations completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration runner failed:', error.message);
        process.exit(1);
    });
