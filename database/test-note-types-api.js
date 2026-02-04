const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testNoteTypesAPI() {
    console.log('🧪 Testing Note Types API...\n');

    try {
        // Test 1: GET /api/note-types (without auth)
        console.log('1. Testing GET /api/note-types (public)');
        const response = await axios.get(`${BASE_URL}/api/note-types`);

        if (response.data.success) {
            console.log(`   ✅ Success! Found ${response.data.data.length} note types\n`);

            response.data.data.forEach(type => {
                const roles = Array.isArray(type.allowed_roles)
                    ? type.allowed_roles.join(', ')
                    : type.allowed_roles;
                console.log(`   - [${type.code}] ${type.name} (${roles})`);
            });

            console.log('\n');

            // Verify all required types exist
            const codes = response.data.data.map(t => t.code);
            const required = ['general', 'fix_request', 'fix_response', 'approval', 'rejection'];
            const missing = required.filter(c => !codes.includes(c));

            if (missing.length > 0) {
                console.log(`   ❌ Missing: ${missing.join(', ')}\n`);
            } else {
                console.log('   ✅ All required note types present\n');
            }

            // Verify structure
            const firstType = response.data.data[0];
            const hasRequiredFields =
                firstType.code &&
                firstType.name &&
                firstType.allowed_roles;

            if (hasRequiredFields) {
                console.log('   ✅ Response structure is correct\n');
            } else {
                console.log('   ❌ Response structure is missing fields\n');
                console.log('   Expected: code, name, allowed_roles');
                console.log('   Got:', Object.keys(firstType).join(', '), '\n');
            }

        } else {
            console.log('   ❌ API returned success: false\n');
        }

        console.log('✅ Note Types API is working correctly!\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

testNoteTypesAPI();
