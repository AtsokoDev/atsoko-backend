#!/usr/bin/env node

/**
 * Test Script: Title Generation on Property Update
 * Tests if backend properly regenerates titles when location changes
 * 
 * Usage: node scripts/test-title-update.js
 */

const http = require('http');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const PORT = new URL(BASE_URL).port || 3000;
const HOST = new URL(BASE_URL).hostname || 'localhost';

// Test credentials
const TEST_CREDENTIALS = {
    email: process.env.ADMIN_EMAIL || 'admin@atsoko.com',
    password: process.env.ADMIN_PASSWORD || 'admin123456'
};

console.log('============================================================');
console.log('🧪 TEST: Title Generation on Property Update');
console.log('============================================================\n');

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject({ statusCode: res.statusCode, data: parsed });
                    }
                } catch (e) {
                    reject({ statusCode: res.statusCode, error: 'Invalid JSON response', body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function login() {
    console.log('🔐 Logging in as admin...');
    try {
        const response = await makeRequest('POST', '/api/auth/login', TEST_CREDENTIALS);
        console.log('✅ Login successful\n');
        return response.data.accessToken; // Fix: use data.accessToken instead of token
    } catch (error) {
        console.error('❌ Login failed:', error.data || error.error || error.message);
        console.error('\n💡 Tip: Make sure backend is running and credentials are correct');
        process.exit(1);
    }
}

async function getFirstProperty(token) {
    console.log('📋 Fetching first property...');
    try {
        const response = await makeRequest('GET', '/api/properties?limit=1', null, token);

        if (!response.data || response.data.length === 0) {
            console.error('❌ No properties found in database');
            process.exit(1);
        }

        const property = response.data[0];
        console.log(`✅ Found property: ${property.property_id}`);
        console.log(`   Current title: "${property.title}"`);
        console.log(`   Current location: ${property.province}, ${property.district}, ${property.sub_district}\n`);
        return property;
    } catch (error) {
        console.error('❌ Failed to fetch properties:', error.data || error.message);
        process.exit(1);
    }
}

async function updatePropertyLocation(token, propertyId, newLocation) {
    console.log('📝 Updating property location...');
    console.log(`   New location: ${newLocation.province}, ${newLocation.district}, ${newLocation.sub_district}`);

    try {
        const response = await makeRequest(
            'PUT',
            `/api/properties/${propertyId}`,
            newLocation,
            token
        );

        const updated = response.data;
        console.log('\n✅ Property updated successfully!');
        console.log('\n📊 RESULTS:');
        console.log('   ----------------------------------------');
        console.log(`   Property ID:  ${updated.property_id}`);
        console.log(`   New Location: ${updated.province}, ${updated.district}, ${updated.sub_district}`);
        console.log('   ----------------------------------------');
        console.log(`   Title (Main): "${updated.title}"`);
        console.log(`   Title (EN):   "${updated.title_en}"`);
        console.log(`   Title (TH):   "${updated.title_th || '(not set)'}"`);
        console.log(`   Title (ZH):   "${updated.title_zh || '(not set)'}"`);
        console.log('   ----------------------------------------\n');

        // Verify title contains new location
        const titleContainsNewLocation =
            updated.title?.includes(newLocation.sub_district) ||
            updated.title?.includes(newLocation.district) ||
            updated.title?.includes(newLocation.province);

        if (titleContainsNewLocation) {
            console.log('✅ SUCCESS: Title contains new location!');
            console.log('   Backend is correctly regenerating titles on location change.\n');
            return true;
        } else {
            console.log('❌ FAILED: Title does NOT contain new location!');
            console.log('   Backend may not be regenerating titles properly.');
            console.log('   Check backend logs for [UPDATE PROPERTY] messages.\n');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to update property:', error.data || error.message);
        process.exit(1);
    }
}

async function runTest() {
    try {
        // Step 1: Login
        const token = await login();

        // Step 2: Get first property
        const property = await getFirstProperty(token);

        // Step 3: Define new location
        const newLocation = {
            province: 'Chachoengsao',
            district: 'Bang Pakong',
            sub_district: 'Bang Pakong'
        };

        // Skip if location is already the same
        if (property.province === newLocation.province &&
            property.district === newLocation.district &&
            property.sub_district === newLocation.sub_district) {
            console.log('⚠️  Property already has this location. Using alternative...\n');
            newLocation.province = 'Samut Prakan';
            newLocation.district = 'Bang Phli';
            newLocation.sub_district = 'Bang Phli';
        }

        // Step 4: Update property
        const success = await updatePropertyLocation(token, property.property_id, newLocation);

        console.log('============================================================');
        console.log('🔍 NEXT STEPS:');
        console.log('============================================================');
        console.log('1. Check backend console logs for these messages:');
        console.log('   [UPDATE PROPERTY] Title Regeneration Check:');
        console.log('   [UPDATE PROPERTY] ✅ Titles updated successfully');
        console.log('');
        console.log('2. Test via Frontend:');
        console.log('   - Go to /properties');
        console.log('   - Edit this property and change location');
        console.log('   - Verify title updates immediately');
        console.log('============================================================\n');

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error('❌ Test failed:', error.message || error);
        process.exit(1);
    }
}

// Run the test
runTest();
