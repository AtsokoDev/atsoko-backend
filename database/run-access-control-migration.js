/**
 * Run Access Control Migration
 * Usage: node database/run-access-control-migration.js
 */

require('dotenv').config();
const pool = require('../config/database');

async function runMigration() {
    console.log('🚀 Starting Access Control Migration...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Add workflow_status column to properties table
        console.log('1. Adding workflow_status column...');
        try {
            await client.query(`
                ALTER TABLE properties 
                ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50) DEFAULT 'pending'
            `);
            console.log('   ✓ workflow_status column added');
        } catch (e) {
            if (e.code === '42701') {
                console.log('   ⏭  workflow_status column already exists');
            } else throw e;
        }

        // 2. Update existing properties
        console.log('2. Updating existing properties...');
        const updateResult1 = await client.query(`
            UPDATE properties 
            SET workflow_status = 'ready_to_publish' 
            WHERE approve_status = 'published' AND (workflow_status IS NULL OR workflow_status = 'pending')
        `);
        console.log(`   ✓ Updated ${updateResult1.rowCount} published properties`);

        const updateResult2 = await client.query(`
            UPDATE properties 
            SET workflow_status = 'pending' 
            WHERE approve_status = 'pending' AND workflow_status IS NULL
        `);
        console.log(`   ✓ Updated ${updateResult2.rowCount} pending properties`);

        // 3. Create property_requests table
        console.log('3. Creating property_requests table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS property_requests (
                id SERIAL PRIMARY KEY,
                property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('edit', 'delete')),
                status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                requested_by INTEGER NOT NULL REFERENCES users(id),
                reason TEXT,
                requested_changes JSONB,
                admin_response TEXT,
                processed_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            )
        `);
        console.log('   ✓ property_requests table created');

        // 4. Create indexes for property_requests
        console.log('4. Creating indexes for property_requests...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_requests_property_id ON property_requests(property_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_requests_status ON property_requests(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_requests_requested_by ON property_requests(requested_by)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_requests_type ON property_requests(request_type)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_requests_created_at ON property_requests(created_at)`);
        console.log('   ✓ Indexes created');

        // 5. Create property_notes table
        console.log('5. Creating property_notes table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS property_notes (
                id SERIAL PRIMARY KEY,
                property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                request_id INTEGER REFERENCES property_requests(id) ON DELETE CASCADE,
                author_id INTEGER NOT NULL REFERENCES users(id),
                note_type VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (note_type IN ('general', 'fix_request', 'fix_response', 'approval', 'rejection')),
                content TEXT NOT NULL,
                is_internal BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ property_notes table created');

        // 6. Create indexes for property_notes
        console.log('6. Creating indexes for property_notes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_notes_property_id ON property_notes(property_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_notes_request_id ON property_notes(request_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_notes_author_id ON property_notes(author_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_property_notes_created_at ON property_notes(created_at)`);
        console.log('   ✓ Indexes created');

        // 7. Create workflow_history table
        console.log('7. Creating workflow_history table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS workflow_history (
                id SERIAL PRIMARY KEY,
                property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
                previous_workflow_status VARCHAR(50),
                new_workflow_status VARCHAR(50),
                previous_approval_status VARCHAR(50),
                new_approval_status VARCHAR(50),
                changed_by INTEGER NOT NULL REFERENCES users(id),
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('   ✓ workflow_history table created');

        // 8. Create indexes for workflow_history
        console.log('8. Creating indexes for workflow_history...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_workflow_history_property_id ON workflow_history(property_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_workflow_history_created_at ON workflow_history(created_at)`);
        console.log('   ✓ Indexes created');

        // 9. Add indexes on properties table
        console.log('9. Adding indexes on properties table...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_properties_workflow_status ON properties(workflow_status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_properties_approve_status ON properties(approve_status)`);
        console.log('   ✓ Indexes created');

        await client.query('COMMIT');

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Migration completed successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Verify
        console.log('Verifying tables...');

        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('property_requests', 'property_notes', 'workflow_history')
            ORDER BY table_name
        `);

        for (const row of tables.rows) {
            console.log(`  ✓ Table '${row.table_name}' exists`);
        }

        // Check workflow_status column
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'properties' 
            AND column_name = 'workflow_status'
        `);

        if (columns.rows.length > 0) {
            console.log(`  ✓ Column 'properties.workflow_status' exists (${columns.rows[0].data_type})`);
        }

        // Count workflow statuses
        const statsCounts = await client.query(`
            SELECT workflow_status, approve_status, COUNT(*) as count
            FROM properties
            GROUP BY workflow_status, approve_status
            ORDER BY approve_status, workflow_status
        `);

        console.log('\nProperty Status Summary:');
        for (const row of statsCounts.rows) {
            console.log(`  • ${row.approve_status} / ${row.workflow_status}: ${row.count} properties`);
        }

        console.log('\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
