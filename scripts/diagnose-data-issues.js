/**
 * Diagnostic script to identify data consistency issues
 * Run this while your backend is running on port 3000
 */

const http = require('http');

function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

async function diagnose() {
    console.log('🔍 Diagnosing Data Consistency Issues\n');
    console.log('This will test if newly created/updated data appears correctly\n');

    try {
        // Test 1: Check if API is responding
        console.log('📡 Test 1: API Health Check');
        const health = await makeRequest('/');
        console.log('Status:', health.status === 200 ? '✅ OK' : '❌ Failed');
        console.log('');

        // Test 2: Fetch properties multiple times
        console.log('📊 Test 2: Repeated Property Fetching');
        console.log('Fetching properties 5 times to check consistency...\n');
        
        const results = [];
        for (let i = 0; i < 5; i++) {
            const response = await makeRequest('/api/properties?limit=3&sort=updated_at');
            if (response.data.data) {
                const ids = response.data.data.map(p => p.id);
                const titles = response.data.data.map(p => p.title);
                results.push({ ids, titles, timestamp: new Date().toISOString() });
                console.log(`Attempt ${i + 1}:`);
                console.log(`  IDs: [${ids.join(', ')}]`);
                console.log(`  First property: ${response.data.data[0]?.property_id}`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Check if results are consistent
        const firstIds = JSON.stringify(results[0].ids);
        const allSame = results.every(r => JSON.stringify(r.ids) === firstIds);
        
        if (allSame) {
            console.log('\n✅ Results are consistent across all requests');
        } else {
            console.log('\n⚠️  WARNING: Results vary between requests!');
            console.log('This suggests connection pooling or caching issues');
        }

        // Test 3: Check ORDER BY behavior
        console.log('\n📊 Test 3: Sorting Consistency');
        const sortTests = [
            { sort: 'updated_at', label: 'Updated At (DESC)' },
            { sort: 'created_at', label: 'Created At (DESC)' },
            { sort: 'price', label: 'Price' }
        ];

        for (const test of sortTests) {
            const response = await makeRequest(`/api/properties?limit=5&sort=${test.sort}`);
            if (response.data.data && response.data.data.length > 0) {
                console.log(`\n${test.label}:`);
                response.data.data.slice(0, 3).forEach((p, idx) => {
                    console.log(`  ${idx + 1}. ${p.property_id} - Updated: ${p.updated_at?.substring(0, 19)}`);
                });
            }
        }

        // Test 4: Check if specific property appears in list
        console.log('\n📊 Test 4: Specific Property Visibility');
        const listResponse = await makeRequest('/api/properties?limit=100');
        if (listResponse.data.data) {
            const total = listResponse.data.data.length;
            const recentlyUpdated = listResponse.data.data.filter(p => {
                const updatedAt = new Date(p.updated_at);
                const now = new Date();
                const diffMinutes = (now - updatedAt) / 1000 / 60;
                return diffMinutes < 60; // Updated in last hour
            });

            console.log(`Total properties in list: ${total}`);
            console.log(`Recently updated (last hour): ${recentlyUpdated.length}`);
            
            if (recentlyUpdated.length > 0) {
                console.log('\nRecently updated properties:');
                recentlyUpdated.forEach(p => {
                    console.log(`  - ${p.property_id}: ${p.updated_at}`);
                });
            }
        }

        // Test 5: Simulate the issue - check if new data appears
        console.log('\n📊 Test 5: Recommendations');
        console.log('\nTo test if new/updated data appears:');
        console.log('1. Update a property in your admin panel');
        console.log('2. Immediately fetch /api/properties?limit=10&sort=updated_at');
        console.log('3. Check if the updated property appears at the top');
        console.log('4. If it doesn\'t appear, wait 30 seconds and try again');
        console.log('5. If it appears after waiting, you have a connection pool issue');

        console.log('\n🔧 Common Causes:');
        console.log('✓ Database connection pool using stale connections');
        console.log('✓ Transaction isolation level issues');
        console.log('✓ Missing ORDER BY in queries');
        console.log('✓ Client-side caching in frontend');
        console.log('✓ Browser cache (try hard refresh: Ctrl+Shift+R)');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }

    console.log('\n✅ Diagnostic complete');
}

diagnose();
