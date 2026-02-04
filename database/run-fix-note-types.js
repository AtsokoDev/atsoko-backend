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

async function runMigration() {
    const client = await pool.connect();

    try {
        console.log('🔧 Starting Note Types Schema Fix Migration...\n');

        // Step 1: Check if note_types table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'note_types'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('❌ note_types table does not exist!');
            console.log('📝 Please run note-types-migration.sql first\n');
            return;
        }

        console.log('✅ note_types table exists');

        // Step 2: Check current schema
        const schemaCheck = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'note_types'
            AND column_name IN ('name', 'name_th', 'name_en')
            ORDER BY column_name;
        `);

        console.log('\n📋 Current schema:');
        schemaCheck.rows.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'})`);
        });

        const hasName = schemaCheck.rows.some(col => col.column_name === 'name');
        const hasNameTh = schemaCheck.rows.some(col => col.column_name === 'name_th');
        const hasNameEn = schemaCheck.rows.some(col => col.column_name === 'name_en');

        if (hasName && !hasNameTh && !hasNameEn) {
            console.log('\n✅ Schema is already fixed! Nothing to do.');
            return;
        }

        // Step 3: Run migration
        console.log('\n🚀 Running migration SQL...');

        const sqlPath = path.join(__dirname, 'fix-note-types-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);

        console.log('✅ Migration executed successfully');

        // Step 4: Verify data
        console.log('\n📊 Verifying note types data:');
        const result = await client.query(`
            SELECT code, name, allowed_roles, is_active, sort_order
            FROM note_types
            ORDER BY sort_order, code;
        `);

        console.log(`\nFound ${result.rows.length} note types:\n`);
        result.rows.forEach(row => {
            const rolesStr = Array.isArray(row.allowed_roles)
                ? row.allowed_roles.join(', ')
                : row.allowed_roles;
            const status = row.is_active ? '✅' : '❌';
            console.log(`${status} [${row.code}] ${row.name} (${rolesStr})`);
        });

        // Step 5: Check required note types
        console.log('\n🔍 Checking required note types:');
        const requiredTypes = ['general', 'fix_request', 'fix_response', 'approval', 'rejection'];
        const existingCodes = result.rows.map(r => r.code);

        requiredTypes.forEach(code => {
            if (existingCodes.includes(code)) {
                console.log(`   ✅ ${code}`);
            } else {
                console.log(`   ❌ ${code} - MISSING!`);
            }
        });

        console.log('\n✅ Migration completed successfully!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
