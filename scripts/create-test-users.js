/**
 * Create Test Users for Access Control Testing
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function createTestUsers() {
    try {
        const hashedPassword = await bcrypt.hash('TestPass123!', 10);

        // Create or update test admin
        await pool.query(`
            INSERT INTO users (email, password_hash, name, role, team, is_active)
            VALUES ('testadmin@atsoko.com', $1, 'Test Admin', 'admin', 'Admin Team', true)
            ON CONFLICT (email) DO UPDATE SET password_hash = $1
        `, [hashedPassword]);
        console.log('✓ Test Admin created: testadmin@atsoko.com / TestPass123!');

        // Create or update test agent
        await pool.query(`
            INSERT INTO users (email, password_hash, name, role, team, is_active)
            VALUES ('testagent@atsoko.com', $1, 'Test Agent', 'agent', 'Team A', true)
            ON CONFLICT (email) DO UPDATE SET password_hash = $1
        `, [hashedPassword]);
        console.log('✓ Test Agent created: testagent@atsoko.com / TestPass123!');

        // Show all users
        const result = await pool.query('SELECT id, email, role, team FROM users');
        console.log('\nAll users:');
        result.rows.forEach(u => console.log(`  ${u.id}: ${u.email} (${u.role}) - ${u.team}`));

        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createTestUsers();
