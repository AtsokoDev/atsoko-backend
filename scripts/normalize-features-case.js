require('dotenv').config();
const pool = require('../config/database');

async function normalizeFeatures() {
    const client = await pool.connect();
    try {
        console.log('🛠️ Normalizing features to Title Case (e.g., "parking" -> "Parking")...\n');

        // 1. Check for invalid JSON first to avoid errors during update
        // We'll just skip rows that aren't valid JSON arrays or start with [
        // Previous fixes should have handled empty strings, but let's be safe.

        const countQuery = `
            SELECT COUNT(*) as count 
            FROM properties 
            WHERE features IS NOT NULL 
            AND features LIKE '[%]'
        `;

        const beforeResult = await client.query(countQuery);
        console.log(`Scanning ${beforeResult.rows[0].count} properties with features...`);

        // 2. Perform the update
        // We use a safe approach: only update if it casts to jsonb successfully
        // Note: Using a DO block or just a single UPDATE query. 
        // We'll use the UPDATE with a WHERE clause that filters for likely-JSON strings.

        const updateQuery = `
            UPDATE properties
            SET features = (
                SELECT jsonb_agg(
                    initcap(lower(elem))
                )::text
                FROM jsonb_array_elements_text(features::jsonb) AS elem
            )
            WHERE features IS NOT NULL 
            AND features LIKE '[%]'
            -- Ensure it's not just '[]' to avoid useless work, though jsonb_agg handles empty array fine (returns null? no, returns [])
            -- jsonb_agg of empty set is null. 
            AND features != '[]'
        `;

        // Wait, if jsonb_array_elements_text returns empty set (empty array), jsonb_agg returns NULL?
        // Let's test this logic. 
        // SELECT jsonb_agg(x) FROM jsonb_array_elements_text('[]'::jsonb) as x; -> NULL because 0 rows.
        // So we need COALESCE or handle empty arrays.

        const safeUpdateQuery = `
            UPDATE properties
            SET features = COALESCE(
                (
                    SELECT jsonb_agg(
                        initcap(lower(elem))
                    )::text
                    FROM jsonb_array_elements_text(features::jsonb) AS elem
                ),
                '[]'
            )
            WHERE features IS NOT NULL 
            AND features LIKE '[%]'
            AND features != '[]';
        `;

        console.log('Executing UPDATE query...');
        const result = await client.query(safeUpdateQuery);
        console.log(`✅ Updated ${result.rowCount} rows.`);

        // 3. Verify a few samples
        console.log('\n🔍 Verifying samples:');
        const verificationQuery = `
            SELECT id, features 
            FROM properties 
            WHERE features IS NOT NULL 
            AND features != '[]'
            LIMIT 5;
        `;
        const samples = await client.query(verificationQuery);
        samples.rows.forEach(row => {
            console.log(`ID ${row.id}: ${row.features}`);
        });

        console.log('\n✨ Features normalization complete!');
    } catch (error) {
        console.error('❌ Error executing normalization:', error);
    } finally {
        client.release();
        // Allow time for pool to tear down if needed, generally process.exit is fine for scripts
        process.exit(0);
    }
}

normalizeFeatures();
