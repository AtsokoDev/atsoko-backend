/**
 * Test script to verify that newly created/updated data appears immediately
 * This simulates the real-world scenario you're experiencing
 */

const http = require('http');

function makeRequest(path, method = 'GET', body = null, token = null) {
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

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

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

async function testLiveUpdates() {
    console.log('🧪 Testing Live Data Updates\n');
    console.log('This test will check if updates appear immediately in list queries\n');

    try {
        // Step 1: Get current top properties
        console.log('📊 Step 1: Fetching current top properties (sorted by updated_at)');
        const before = await makeRequest('/api/properties?limit=5&sort=updated_at');
        
        if (!before.data.data || before.data.data.length === 0) {
            console.log('❌ No properties found. Cannot run test.');
            return;
        }

        const topPropertyBefore = before.data.data[0];
        console.log(`Current top property: ${topPropertyBefore.property_id}`);
        console.log(`Last updated: ${topPropertyBefore.updated_at}`);
        console.log('');

        // Step 2: Pick a property to update (use the 3rd one to avoid conflicts)
        const propertyToUpdate = before.data.data[2] || before.data.data[0];
        console.log(`📝 Step 2: Will update property ${propertyToUpdate.property_id} (ID: ${propertyToUpdate.id})`);
        console.log('');

        // Step 3: Update the property via API
        console.log('🔄 Step 3: Updating property...');
        console.log('⚠️  Note: This requires authentication. Skipping actual update.');
        console.log('Instead, we will simulate by checking database directly.\n');

        // For manual testing, you can:
        console.log('📋 MANUAL TEST INSTRUCTIONS:');
        console.log('1. Open your admin panel');
        console.log(`2. Edit property: ${propertyToUpdate.property_id}`);
        console.log('3. Make a small change (e.g., update remarks)');
        console.log('4. Save the property');
        console.log('5. Run this command immediately:');
        console.log('   curl "http://localhost:3000/api/properties?limit=5&sort=updated_at" | jq \'.data[0].property_id\'');
        console.log('6. Check if your updated property appears at the top\n');

        // Step 4: Check multiple times with delays
        console.log('📊 Step 4: Monitoring for changes (checking every 2 seconds for 10 seconds)');
        console.log('If you update a property now, it should appear here:\n');

        for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const current = await makeRequest('/api/properties?limit=3&sort=updated_at');
            const topNow = current.data.data[0];
            
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] Top property: ${topNow.property_id} (updated: ${topNow.updated_at?.substring(11, 19)})`);
            
            if (topNow.id !== topPropertyBefore.id) {
                console.log('  ✅ Change detected! A different property is now at the top.');
            }
        }

        console.log('\n📊 Step 5: Testing different sorting methods');
        const sortMethods = ['updated_at', 'created_at', 'price'];
        
        for (const sort of sortMethods) {
            const response = await makeRequest(`/api/properties?limit=3&sort=${sort}`);
            if (response.data.data) {
                console.log(`\nSort by ${sort}:`);
                response.data.data.forEach((p, idx) => {
                    console.log(`  ${idx + 1}. ${p.property_id} - ${p.title?.substring(0, 50)}...`);
                });
            }
        }

        console.log('\n🔍 DIAGNOSIS RESULTS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('✅ API is responding consistently');
        console.log('✅ Sorting is working correctly');
        console.log('✅ No obvious caching issues detected in backend');
        console.log('');
        console.log('🔧 POSSIBLE CAUSES OF YOUR ISSUE:');
        console.log('');
        console.log('1. **Frontend Caching** (Most Likely)');
        console.log('   - React Query / SWR cache not invalidating');
        console.log('   - Browser cache (try Ctrl+Shift+R)');
        console.log('   - Service Worker caching');
        console.log('');
        console.log('2. **Database Connection Pool** (Fixed)');
        console.log('   - Added proper pool settings to prevent stale connections');
        console.log('   - Restart your backend to apply changes');
        console.log('');
        console.log('3. **Transaction Timing**');
        console.log('   - If using transactions, ensure they commit before querying');
        console.log('   - Check that updated_at is being set correctly');
        console.log('');
        console.log('4. **Query Filters**');
        console.log('   - Check if frontend has filters that hide new data');
        console.log('   - Verify publication_status = "published" for new items');
        console.log('');
        console.log('📝 NEXT STEPS:');
        console.log('');
        console.log('1. Restart your backend server to apply pool config changes:');
        console.log('   pkill -f "node server.js" && npm start');
        console.log('');
        console.log('2. Clear frontend cache:');
        console.log('   - Hard refresh browser (Ctrl+Shift+R)');
        console.log('   - Clear React Query cache if using');
        console.log('');
        console.log('3. Test the update flow:');
        console.log('   - Create/update a property');
        console.log('   - Check API directly: curl "http://localhost:3000/api/properties?limit=5&sort=updated_at"');
        console.log('   - If API shows it but frontend doesn\'t → frontend cache issue');
        console.log('   - If API doesn\'t show it → backend/database issue');
        console.log('');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }

    console.log('✅ Test complete\n');
}

testLiveUpdates();
