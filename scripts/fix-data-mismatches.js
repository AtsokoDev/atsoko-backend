
require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function fixData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🔄 Fixing Approve Status...');
        // Fix 'publish' -> 'published'
        const statusRes = await client.query(`
      UPDATE properties 
      SET approve_status = 'published' 
      WHERE approve_status = 'publish' OR approve_status = 'Publish'
    `);
        console.log(`   Updated ${statusRes.rowCount} rows to 'published'`);

        console.log('\n🔄 Fixing Agent Teams...');
        // Map A -> Team A, etc.
        const teamMap = {
            'A': 'Team A',
            'B': 'Team B',
            'C': 'Team C',
            'Sokochan': 'Sokochan Team'
        };

        for (const [oldName, newName] of Object.entries(teamMap)) {
            const teamRes = await client.query(`
        UPDATE properties 
        SET agent_team = $1 
        WHERE agent_team = $2
      `, [newName, oldName]);
            if (teamRes.rowCount > 0) {
                console.log(`   Updated ${teamRes.rowCount} rows: '${oldName}' -> '${newName}'`);
            }
        }

        // Clear "Please Select"
        await client.query(`UPDATE properties SET agent_team = NULL WHERE agent_team = 'Please Select'`);


        console.log('\n🔄 Fixing Types...');
        // Fix 'Factory|Warehouse' -> 'Factory'
        // Logic: Title Generator handles 'Factory' as 'Factory or Warehouse'.
        const typeRes = await client.query(`
      UPDATE properties 
      SET type = 'Factory' 
      WHERE type ILIKE '%Factory%' AND type ILIKE '%Warehouse%'
    `);
        console.log(`   Updated ${typeRes.rowCount} rows (Factory|Warehouse -> Factory)`);

        console.log('\n🔄 Syncing Type IDs...');
        // Update type_id based on type name
        // This ensures api-select works correctly with IDs
        const syncTypeRes = await client.query(`
      UPDATE properties p
      SET type_id = mt.id
      FROM master_types mt
      WHERE p.type = mt.name->>'en'
      AND (p.type_id IS NULL OR p.type_id != mt.id)
    `);
        console.log(`   Synced ${syncTypeRes.rowCount} Type IDs`);

        console.log('\n🔄 Syncing Status IDs...');
        // Update status_id based on status name (e.g. For Rent)
        const syncStatusRes = await client.query(`
      UPDATE properties p
      SET status_id = ms.id
      FROM master_statuses ms
      WHERE p.status = ms.name->>'en'
      AND (p.status_id IS NULL OR p.status_id != ms.id)
    `);
        console.log(`   Synced ${syncStatusRes.rowCount} Status IDs`);

        await client.query('COMMIT');
        console.log('\n✅ Data Fix Complete!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error fixing data:', err);
    } finally {
        client.release();
        pool.end();
    }
}

fixData();
