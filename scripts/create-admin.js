/**
 * Script to create the first admin user
 * Usage: node scripts/create-admin.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const createAdmin = async () => {
    const email = process.env.ADMIN_EMAIL || 'admin@atsoko.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123456';
    const name = process.env.ADMIN_NAME || 'Administrator';

    console.log('Creating admin user...');
    console.log('Email:', email);

    try {
        // Check if admin already exists
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            console.log('Admin user already exists!');
            process.exit(0);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create admin
        const result = await pool.query(
            `INSERT INTO users (email, password_hash, name, role, team) 
       VALUES ($1, $2, $3, 'admin', NULL) 
       RETURNING id, email, name, role`,
            [email.toLowerCase(), passwordHash, name]
        );

        console.log('Admin user created successfully!');
        console.log('User:', result.rows[0]);
        console.log('\nYou can now login with:');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('\n⚠️  Please change the password after first login!');

    } catch (error) {
        console.error('Error creating admin:', error.message);
        process.exit(1);
    }

    process.exit(0);
};

createAdmin();
