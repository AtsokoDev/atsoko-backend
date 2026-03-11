const pool = require('../config/database');

/**
 * Test script to check data consistency issues
 * This will help identify if there are stale connection or caching problems
 */

async function testDataConsistency() {
    console.log('🔍 Testing Data Consistency...\n');

    try {
        // Test 1: Check pool status
        console.log('📊 Test 1: Pool Status');
        console.log('Total connections:', pool.totalCount);
        console.log('Idle connections:', pool.idleCount);
        console.log('Waiting requests:', pool.waitingCount);
        console.log('');

        // Test 2: Create a test property and immediately read it
        console.log('📝 Test 2: Write-Read Consistency');
        const testPropertyId = `TEST_${Date.now()}`;
        
        // Insert test data
        const insertResult = await pool.query(
            `INSERT INTO properties (property_id, title, type, status, province, district, size, price, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
             RETURNING id, property_id, title, created_at`,
            [testPropertyId, 'Test Property', 'Warehouse', 'For Rent', 'Bangkok', 'Bang Khen', 1000, 50000]
        );
        
        const insertedId = insertResult.rows[0].id;
        console.log('✅ Inserted:', insertResult.rows[0]);

        // Immediately read back using different connections
        console.log('\n🔄 Reading back immediately...');
        
        // Read 1: Using pool.query (may use different connection)
        const read1 = await pool.query(
            'SELECT id, property_id, title, created_at FROM properties WHERE id = $1',
            [insertedId]
        );
        console.log('Read 1 (pool.query):', read1.rows[0] ? '✅ Found' : '❌ Not found');

        // Read 2: Using a dedicated client
        const client = await pool.connect();
        try {
            const read2 = await client.query(
                'SELECT id, property_id, title, created_at FROM properties WHERE id = $1',
                [insertedId]
            );
            console.log('Read 2 (dedicated client):', read2.rows[0] ? '✅ Found' : '❌ Not found');
        } finally {
            client.release();
        }

        // Read 3: After a small delay
        await new Promise(resolve => setTimeout(resolve, 100));
        const read3 = await pool.query(
            'SELECT id, property_id, title, created_at FROM properties WHERE id = $1',
            [insertedId]
        );
        console.log('Read 3 (after 100ms):', read3.rows[0] ? '✅ Found' : '❌ Not found');

        // Test 3: Update and read
        console.log('\n📝 Test 3: Update-Read Consistency');
        const newTitle = `Updated Test ${Date.now()}`;
        await pool.query(
            'UPDATE properties SET title = $1, updated_at = NOW() WHERE id = $2',
            [newTitle, insertedId]
        );
        console.log('✅ Updated title to:', newTitle);

        // Read immediately after update
        const read4 = await pool.query(
            'SELECT id, property_id, title, updated_at FROM properties WHERE id = $1',
            [insertedId]
        );
        
        if (read4.rows[0] && read4.rows[0].title === newTitle) {
            console.log('✅ Update visible immediately');
        } else {
            console.log('❌ Update NOT visible immediately');
            console.log('Expected:', newTitle);
            console.log('Got:', read4.rows[0]?.title);
        }

        // Test 4: List query (ORDER BY created_at DESC)
        console.log('\n📝 Test 4: List Query with ORDER BY');
        const listResult = await pool.query(
            `SELECT id, property_id, title, created_at 
             FROM properties 
             WHERE property_id LIKE 'TEST_%'
             ORDER BY created_at DESC 
             LIMIT 5`
        );
        console.log(`Found ${listResult.rows.length} test properties`);
        listResult.rows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.property_id} - ${row.title}`);
        });

        // Test 5: Check for transaction isolation issues
        console.log('\n📝 Test 5: Transaction Isolation');
        const client1 = await pool.connect();
        const client2 = await pool.connect();
        
        try {
            // Start transaction in client1
            await client1.query('BEGIN');
            await client1.query(
                'UPDATE properties SET title = $1 WHERE id = $2',
                ['Transaction Test', insertedId]
            );
            
            // Try to read from client2 (should see old value if isolation works)
            const read5 = await client2.query(
                'SELECT title FROM properties WHERE id = $1',
                [insertedId]
            );
            
            console.log('Title in uncommitted transaction:', 'Transaction Test');
            console.log('Title from other connection:', read5.rows[0]?.title);
            
            if (read5.rows[0]?.title === 'Transaction Test') {
                console.log('⚠️  WARNING: Dirty read detected! (READ UNCOMMITTED)');
            } else {
                console.log('✅ Transaction isolation working correctly');
            }
            
            // Rollback
            await client1.query('ROLLBACK');
        } finally {
            client1.release();
            client2.release();
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await pool.query(
            `DELETE FROM properties WHERE property_id LIKE 'TEST_%'`
        );
        console.log('✅ Cleanup complete');

        // Final pool status
        console.log('\n📊 Final Pool Status:');
        console.log('Total connections:', pool.totalCount);
        console.log('Idle connections:', pool.idleCount);
        console.log('Waiting requests:', pool.waitingCount);

    } catch (error) {
        console.error('\n❌ Error during test:', error.message);
        console.error(error);
    } finally {
        await pool.end();
        console.log('\n✅ Test complete');
    }
}

testDataConsistency();
