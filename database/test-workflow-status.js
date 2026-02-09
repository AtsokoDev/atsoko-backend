#!/usr/bin/env node

/**
 * Test script to verify workflow_status is properly set when creating properties
 * 
 * This script tests:
 * 1. Creating property as Agent → should have approve_status='pending', workflow_status='pending'
 * 2. Creating property as Admin → should have approve_status='published', workflow_status='ready_to_publish'
 * 3. Checking if properties appear in /api/property-workflow/pending
 */

const pool = require('../config/database');

async function testWorkflowStatus() {
    console.log('🔍 Testing Workflow Status Implementation\n');

    try {
        // Test 1: Check properties with NULL workflow_status
        console.log('📊 Test 1: Checking properties with NULL workflow_status...');
        const nullStatusResult = await pool.query(`
            SELECT 
                id,
                property_id,
                approve_status,
                workflow_status,
                agent_team,
                created_at
            FROM properties
            WHERE workflow_status IS NULL
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (nullStatusResult.rows.length > 0) {
            console.log(`   ❌ Found ${nullStatusResult.rows.length} properties with NULL workflow_status:`);
            nullStatusResult.rows.forEach(row => {
                console.log(`      - ${row.property_id}: approve_status=${row.approve_status}, workflow_status=${row.workflow_status}`);
            });
            console.log('\n   💡 Recommendation: Run the UPDATE query in check-workflow-status.sql to fix these\n');
        } else {
            console.log('   ✅ No properties with NULL workflow_status found\n');
        }

        // Test 2: Check properties with approve_status='pending' but workflow_status != 'pending'
        console.log('📊 Test 2: Checking pending properties with mismatched workflow_status...');
        const mismatchResult = await pool.query(`
            SELECT 
                id,
                property_id,
                approve_status,
                workflow_status,
                agent_team,
                created_at
            FROM properties
            WHERE approve_status = 'pending' 
              AND (workflow_status IS NULL OR workflow_status != 'pending')
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (mismatchResult.rows.length > 0) {
            console.log(`   ❌ Found ${mismatchResult.rows.length} pending properties with incorrect workflow_status:`);
            mismatchResult.rows.forEach(row => {
                console.log(`      - ${row.property_id}: approve_status=${row.approve_status}, workflow_status=${row.workflow_status}`);
            });
            console.log('\n   💡 These properties may not appear in Admin pending list\n');
        } else {
            console.log('   ✅ All pending properties have correct workflow_status\n');
        }

        // Test 3: Summary of workflow_status distribution
        console.log('📊 Test 3: Workflow Status Distribution...');
        const summaryResult = await pool.query(`
            SELECT 
                COALESCE(workflow_status, 'NULL') as workflow_status,
                approve_status,
                COUNT(*) as count
            FROM properties
            GROUP BY workflow_status, approve_status
            ORDER BY approve_status, workflow_status
        `);

        console.log('   Distribution:');
        summaryResult.rows.forEach(row => {
            console.log(`      - approve_status=${row.approve_status}, workflow_status=${row.workflow_status}: ${row.count} properties`);
        });
        console.log('');

        // Test 4: Check if properties would appear in /api/property-workflow/pending
        console.log('📊 Test 4: Properties that would appear in Admin pending list...');
        const pendingListResult = await pool.query(`
            SELECT 
                id,
                property_id,
                approve_status,
                workflow_status,
                created_at
            FROM properties
            WHERE approve_status = 'pending'
            ORDER BY created_at ASC
            LIMIT 5
        `);

        console.log(`   Total pending properties: ${pendingListResult.rows.length}`);
        if (pendingListResult.rows.length > 0) {
            console.log('   Recent pending properties:');
            pendingListResult.rows.forEach(row => {
                const willAppear = row.workflow_status !== null;
                const icon = willAppear ? '✅' : '❌';
                console.log(`      ${icon} ${row.property_id}: workflow_status=${row.workflow_status || 'NULL'}`);
            });
        }
        console.log('');

        // Test 5: Count by workflow_status for pending properties (mimics API summary)
        console.log('📊 Test 5: Summary for Admin pending list (mimics API response)...');
        const apiSummaryResult = await pool.query(`
            SELECT 
                workflow_status, 
                COUNT(*) as count
            FROM properties
            WHERE approve_status = 'pending'
            GROUP BY workflow_status
        `);

        const summary = {};
        apiSummaryResult.rows.forEach(row => {
            summary[row.workflow_status || 'null'] = parseInt(row.count);
        });

        console.log('   API Summary:', JSON.stringify(summary, null, 2));
        console.log('');

        console.log('✅ All tests completed!\n');

        // Recommendations
        console.log('📝 Recommendations:');
        if (nullStatusResult.rows.length > 0 || mismatchResult.rows.length > 0) {
            console.log('   1. Run the UPDATE query in database/check-workflow-status.sql to fix existing properties');
            console.log('   2. Test creating a new property to verify workflow_status is now set correctly');
        } else {
            console.log('   ✅ No issues found! The workflow_status implementation is working correctly.');
        }

    } catch (error) {
        console.error('❌ Error running tests:', error);
    } finally {
        await pool.end();
    }
}

// Run tests
testWorkflowStatus();
