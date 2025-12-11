/**
 * Run Master Schema Migration
 * Creates master_types, master_statuses, and master_locations tables
 * Also adds new columns to properties table
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigration() {
    console.log('🚀 Starting database migration...\n');

    try {
        // Read and execute master-schema.sql
        console.log('📦 Creating master tables...');
        const masterSchemaPath = path.join(__dirname, 'master-schema.sql');
        const masterSchema = fs.readFileSync(masterSchemaPath, 'utf8');
        await pool.query(masterSchema);
        console.log('✅ Master tables created successfully\n');

        // Read and execute properties-migration.sql
        console.log('📦 Migrating properties table...');
        const propertiesMigrationPath = path.join(__dirname, 'properties-migration.sql');
        const propertiesMigration = fs.readFileSync(propertiesMigrationPath, 'utf8');
        await pool.query(propertiesMigration);
        console.log('✅ Properties table migration completed\n');

        // Verify tables exist
        console.log('🔍 Verifying migration...');
        const tables = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('master_types', 'master_statuses', 'master_locations')
        `);
        console.log(`   Found ${tables.rows.length} master tables:`, tables.rows.map(r => r.table_name).join(', '));

        // Check for new columns in properties
        const columns = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'properties' 
            AND column_name IN ('type_id', 'status_id', 'subdistrict_id', 'title_en', 'title_th', 'title_zh')
        `);
        console.log(`   Found ${columns.rows.length} new columns in properties:`, columns.rows.map(r => r.column_name).join(', '));

        // Show counts
        const typesCount = await pool.query('SELECT COUNT(*) FROM master_types');
        const statusesCount = await pool.query('SELECT COUNT(*) FROM master_statuses');
        const locationsCount = await pool.query('SELECT COUNT(*) FROM master_locations');

        console.log('\n📊 Data Summary:');
        console.log(`   master_types: ${typesCount.rows[0].count} rows`);
        console.log(`   master_statuses: ${statusesCount.rows[0].count} rows`);
        console.log(`   master_locations: ${locationsCount.rows[0].count} rows`);

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
