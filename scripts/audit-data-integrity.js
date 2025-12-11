
require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function audit() {
    try {
        console.log('--- AUDIO START ---');
        const client = await pool.connect();

        // 1. Electricity
        console.log('\nChecking Electricity...');
        const elecDB = (await client.query('SELECT DISTINCT electricity_system FROM properties WHERE electricity_system IS NOT NULL')).rows.map(r => r.electricity_system);
        const elecMaster = (await client.query("SELECT name->>'en' as name FROM master_electricity")).rows.map(r => r.name);
        const elecMiss = elecDB.filter(e => !elecMaster.includes(e));
        if (elecMiss.length) console.log('Electricity Mismatches:', elecMiss);
        else console.log('Electricity OK.');

        // 2. Clear Height
        console.log('\nChecking Clear Height...');
        const heightDB = (await client.query('SELECT DISTINCT clear_height FROM properties WHERE clear_height IS NOT NULL')).rows.map(r => r.clear_height);
        const heightMaster = (await client.query('SELECT value FROM master_clear_height')).rows.map(r => r.value);
        const heightMiss = heightDB.filter(h => !heightMaster.includes(h));
        // Note: Clear Height might be text input in form?
        // PropertyForm line 21 says `api-select` logic. valueField='value'.
        if (heightMiss.length) console.log('Clear Height Mismatches:', heightMiss);
        else console.log('Clear Height OK.');

        // 3. Locations (Province)
        console.log('\nChecking Provinces...');
        const provDB = (await client.query('SELECT DISTINCT province FROM properties WHERE province IS NOT NULL')).rows.map(r => r.province);
        const provMaster = (await client.query("SELECT name->>'en' as name FROM master_locations WHERE level='province'")).rows.map(r => r.name);
        // Fuzzy or exact? PropertyForm uses exact.
        const provMiss = provDB.filter(p => !provMaster.includes(p));
        if (provMiss.length) console.log('Province Mismatches:', provMiss);
        else console.log('Province OK.');

        // 4. Locations (District) - Just sample check

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
audit();
