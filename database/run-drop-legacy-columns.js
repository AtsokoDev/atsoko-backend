/**
 * Run Drop Legacy Columns Migration
 * Removes: approve_status, workflow_status from properties
 *          requested_changes from property_requests
 *
 * Usage:
 *   node database/run-drop-legacy-columns.js              # dry-run (default)
 *   node database/run-drop-legacy-columns.js --execute     # actually drop
 *
 * On production VPS:
 *   cd /home/atsoko/atsoko-backend
 *   node database/run-drop-legacy-columns.js               # preview first
 *   node database/run-drop-legacy-columns.js --execute      # then run for real
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const DRY_RUN = !process.argv.includes('--execute');

async function run() {
    console.log(DRY_RUN
        ? '🔍 DRY RUN — no changes will be made. Add --execute to apply.\n'
        : '⚠️  LIVE RUN — changes will be applied!\n'
    );

    const client = await pool.connect();

    try {
        // ── Step 1: Pre-flight checks ──────────────────────────────────
        console.log('── Pre-flight checks ──');

        // Check columns exist
        const colsResult = await client.query(`
            SELECT column_name, table_name
            FROM information_schema.columns
            WHERE (table_name = 'properties'         AND column_name IN ('approve_status', 'workflow_status', 'publication_status', 'moderation_status'))
               OR (table_name = 'property_requests'  AND column_name = 'requested_changes')
            ORDER BY table_name, column_name
        `);

        const cols = colsResult.rows.map(r => `${r.table_name}.${r.column_name}`);
        console.log('   Columns found:', cols.join(', '));

        const hasApprove  = cols.includes('properties.approve_status');
        const hasWorkflow = cols.includes('properties.workflow_status');
        const hasPub      = cols.includes('properties.publication_status');
        const hasReqChg   = cols.includes('property_requests.requested_changes');

        if (!hasPub) {
            console.error('❌ publication_status column not found — migration cannot proceed.');
            process.exit(1);
        }

        if (!hasApprove && !hasWorkflow && !hasReqChg) {
            console.log('✅ Legacy columns already dropped. Nothing to do.');
            process.exit(0);
        }

        // Check NULL publication_status rows
        const nullPubResult = await client.query(
            `SELECT COUNT(*) as cnt FROM properties WHERE publication_status IS NULL`
        );
        const nullCount = parseInt(nullPubResult.rows[0].cnt);
        if (nullCount > 0) {
            console.error(`❌ ${nullCount} rows have NULL publication_status. Backfill first:`);
            console.error(`   UPDATE properties SET publication_status = CASE`);
            console.error(`     WHEN approve_status = 'published' THEN 'published'`);
            console.error(`     WHEN approve_status = 'deleted'   THEN 'deleted'`);
            console.error(`     ELSE 'draft' END`);
            console.error(`   WHERE publication_status IS NULL;`);
            process.exit(1);
        }
        console.log('   ✓ All rows have publication_status set');

        // Show row counts
        const totalResult = await client.query('SELECT COUNT(*) as cnt FROM properties');
        console.log(`   ✓ Total properties: ${totalResult.rows[0].cnt}`);

        // Show current status distribution
        const distResult = await client.query(`
            SELECT publication_status, COUNT(*) as cnt
            FROM properties GROUP BY publication_status ORDER BY cnt DESC
        `);
        console.log('   ✓ Distribution:');
        distResult.rows.forEach(r => console.log(`     ${r.publication_status}: ${r.cnt}`));

        if (DRY_RUN) {
            console.log('\n── Dry-run summary ──');
            console.log('Would drop:');
            if (hasApprove)  console.log('   • properties.approve_status');
            if (hasWorkflow) console.log('   • properties.workflow_status');
            if (hasReqChg)   console.log('   • property_requests.requested_changes');
            console.log('Would set:');
            console.log('   • publication_status NOT NULL DEFAULT \'draft\'');
            console.log('   • moderation_status DEFAULT \'none\'');
            console.log('\nRe-run with --execute to apply.');
            process.exit(0);
        }

        // ── Step 2: Execute migration ──────────────────────────────────
        console.log('\n── Executing migration ──');

        const sqlPath = path.join(__dirname, 'drop-legacy-columns.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);

        console.log('   ✓ SQL executed successfully');

        // ── Step 3: Verify ─────────────────────────────────────────────
        console.log('\n── Verification ──');

        const afterCols = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'properties' AND column_name IN ('approve_status', 'workflow_status')
        `);
        if (afterCols.rows.length === 0) {
            console.log('   ✓ approve_status & workflow_status dropped');
        } else {
            console.error('   ❌ Columns still exist:', afterCols.rows.map(r => r.column_name));
            process.exit(1);
        }

        const afterReqChg = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'property_requests' AND column_name = 'requested_changes'
        `);
        if (afterReqChg.rows.length === 0) {
            console.log('   ✓ requested_changes dropped');
        } else {
            console.error('   ❌ requested_changes still exists');
            process.exit(1);
        }

        // Check NOT NULL constraint
        const notNullResult = await client.query(`
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'properties' AND column_name = 'publication_status'
        `);
        console.log(`   ✓ publication_status nullable: ${notNullResult.rows[0]?.is_nullable || 'N/A'}`);

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
