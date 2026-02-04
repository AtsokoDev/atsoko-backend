#!/usr/bin/env node

/**
 * Test sorting functionality
 * Tests both legacy and new combined sort formats
 */

const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://${HOST}:${PORT}${path}`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function testSort(description, path) {
    try {
        const response = await makeRequest(path);
        console.log(`✅ ${description}`);
        console.log(`   Sort: ${response.sorting.sort}, Order: ${response.sorting.order}`);
        if (response.data.length > 0) {
            console.log(`   First property: ${response.data[0].property_id} (${response.data[0][response.sorting.sort]})`);
        }
        console.log('');
        return true;
    } catch (error) {
        console.log(`❌ ${description}`);
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

async function runTests() {
    console.log('============================================================');
    console.log('🧪 TEST: Sorting Functionality');
    console.log('============================================================\n');

    // Test 1: Default (should be updated_desc)
    await testSort('Default sort (updated_desc)', '/api/properties?limit=3');

    // Test 2: Combined format - updated_desc
    await testSort('Combined: updated_desc', '/api/properties?sort=updated_desc&limit=3');

    // Test 3: Combined format - created_desc
    await testSort('Combined: created_desc', '/api/properties?sort=created_desc&limit=3');

    // Test 4: Combined format - created_asc
    await testSort('Combined: created_asc', '/api/properties?sort=created_asc&limit=3');

    // Test 5: Combined format - price_asc
    await testSort('Combined: price_asc', '/api/properties?sort=price_asc&limit=3');

    // Test 6: Combined format - price_desc
    await testSort('Combined: price_desc', '/api/properties?sort=price_desc&limit=3');

    // Test 7: Combined format - size_asc
    await testSort('Combined: size_asc', '/api/properties?sort=size_asc&limit=3');

    // Test 8: Combined format - size_desc
    await testSort('Combined: size_desc', '/api/properties?sort=size_desc&limit=3');

    // Test 9: Legacy format - created_at with order=desc
    await testSort('Legacy: sort=created_at&order=desc', '/api/properties?sort=created_at&order=desc&limit=3');

    // Test 10: Legacy format - price with order=asc
    await testSort('Legacy: sort=price&order=asc', '/api/properties?sort=price&order=asc&limit=3');

    console.log('============================================================');
    console.log('✅ All sort formats tested');
    console.log('============================================================\n');
}

runTests();
