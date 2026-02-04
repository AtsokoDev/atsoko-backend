const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function checkNoteTypes() {
    const client = await pool.connect();

    try {
        console.log('🔍 Checking Note Types...\n');

        const result = await client.query(`
            SELECT code, name, allowed_roles, is_active, sort_order
            FROM note_types
            ORDER BY sort_order, code;
        `);

        console.log(`Found ${result.rows.length} note types:\n`);

        result.rows.forEach(row => {
            const rolesStr = Array.isArray(row.allowed_roles)
                ? row.allowed_roles.join(', ')
                : row.allowed_roles;
            const status = row.is_active ? '✅ Active' : '❌ Inactive';
            console.log(`[${row.code.padEnd(15)}] ${row.name.padEnd(25)} | Roles: ${rolesStr.padEnd(15)} | ${status}`);
        });

        // Check required types
        console.log('\n📋 Required Note Types:');
        const requiredTypes = [
            { code: 'general', name: 'General', roles: ['admin', 'agent'] },
            { code: 'fix_request', name: 'Fix Request', roles: ['admin'] },
            { code: 'fix_response', name: 'Fix Response', roles: ['agent'] },
            { code: 'approval', name: 'Approval', roles: ['admin'] },
            { code: 'rejection', name: 'Rejection', roles: ['admin'] }
        ];

        const existingCodes = result.rows.map(r => r.code);

        requiredTypes.forEach(type => {
            if (existingCodes.includes(type.code)) {
                console.log(`   ✅ ${type.code} - Found`);
            } else {
                console.log(`   ❌ ${type.code} - MISSING!`);
            }
        });

        console.log('\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkNoteTypes();
