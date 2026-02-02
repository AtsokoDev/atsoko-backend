/**
 * Complete Access Control API Test
 * Tests ALL endpoints including workflow status changes
 */

require('dotenv').config();

const API_URL = 'http://localhost:3000/api';

async function apiCall(method, endpoint, data = null, token = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (data) options.body = JSON.stringify(data);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const json = await response.json();
        return { status: response.status, data: json };
    } catch (error) {
        return { status: 0, error: error.message };
    }
}

const results = { passed: 0, failed: 0, tests: [] };

function logTest(name, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${name}`);
    if (details) console.log(`     ${details}`);
    results.tests.push({ name, passed, details });
    if (passed) results.passed++; else results.failed++;
}

async function runTests() {
    const pool = require('../config/database');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('    Complete Access Control API Test (Including Workflow)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // =========================================================================
    // STEP 1: Login
    // =========================================================================
    console.log('📋 STEP 1: Authentication');
    console.log('─────────────────────────────────────────────────────────────');

    const adminLogin = await apiCall('POST', '/auth/login', {
        email: 'testadmin@atsoko.com',
        password: 'TestPass123!'
    });
    const adminToken = adminLogin.data?.data?.accessToken;
    logTest('Admin login', !!adminToken, adminToken ? 'Token received' : 'Failed');

    const agentLogin = await apiCall('POST', '/auth/login', {
        email: 'testagent@atsoko.com',
        password: 'TestPass123!'
    });
    const agentToken = agentLogin.data?.data?.accessToken;
    logTest('Agent login', !!agentToken, agentToken ? 'Token received' : 'Failed');

    if (!adminToken || !agentToken) {
        console.log('\n❌ Cannot proceed without tokens. Run create-test-users.js first.');
        await pool.end();
        return;
    }

    console.log('');

    // =========================================================================
    // STEP 2: Workflow Status Changes (Admin)
    // =========================================================================
    console.log('📋 STEP 2: Workflow Status Changes (Admin)');
    console.log('─────────────────────────────────────────────────────────────');

    // Create or get a pending property
    let testPropertyId = null;

    // First check for existing pending property
    const pendingProps = await pool.query(`
        SELECT id, property_id, workflow_status, approve_status 
        FROM properties WHERE approve_status = 'pending' LIMIT 1
    `);

    if (pendingProps.rows.length > 0) {
        testPropertyId = pendingProps.rows[0].id;
        console.log(`  Using existing pending property: ID ${testPropertyId}`);
    } else {
        // Get any property and make it pending for testing
        const anyProp = await pool.query('SELECT id FROM properties LIMIT 1');
        testPropertyId = anyProp.rows[0].id;
        await pool.query(`
            UPDATE properties 
            SET approve_status = 'pending', workflow_status = 'pending', agent_team = 'Team A'
            WHERE id = $1
        `, [testPropertyId]);
        console.log(`  Created test pending property: ID ${testPropertyId}`);
    }

    // Test 1: Change workflow_status to wait_to_fix
    const changeToWaitToFix = await apiCall('PUT', `/property-workflow/${testPropertyId}/status`, {
        workflow_status: 'wait_to_fix',
        note: 'Please fix the images and update the price'
    }, adminToken);
    logTest('PUT /property-workflow/:id/status (pending -> wait_to_fix)',
        changeToWaitToFix.data?.success === true,
        changeToWaitToFix.data?.message || changeToWaitToFix.data?.error);

    // Test 2: Agent cannot change workflow status
    const agentChangeStatus = await apiCall('PUT', `/property-workflow/${testPropertyId}/status`, {
        workflow_status: 'ready_to_publish'
    }, agentToken);
    logTest('PUT /property-workflow/:id/status (agent - should fail)',
        agentChangeStatus.status === 403,
        `Status: ${agentChangeStatus.status}`);

    // Test 3: Change to fixed
    await pool.query('UPDATE properties SET workflow_status = $1 WHERE id = $2', ['wait_to_fix', testPropertyId]);
    const changeToFixed = await apiCall('PUT', `/property-workflow/${testPropertyId}/status`, {
        workflow_status: 'fixed',
        note: 'Agent has fixed the issues'
    }, adminToken);
    logTest('PUT /property-workflow/:id/status (wait_to_fix -> fixed)',
        changeToFixed.data?.success === true,
        changeToFixed.data?.message || changeToFixed.data?.error);

    // Test 4: Change to ready_to_publish
    const changeToReady = await apiCall('PUT', `/property-workflow/${testPropertyId}/status`, {
        workflow_status: 'ready_to_publish',
        note: 'Ready for publication'
    }, adminToken);
    logTest('PUT /property-workflow/:id/status (fixed -> ready_to_publish)',
        changeToReady.data?.success === true,
        changeToReady.data?.message || changeToReady.data?.error);

    console.log('');

    // =========================================================================
    // STEP 3: Publish / Unpublish (Admin)
    // =========================================================================
    console.log('📋 STEP 3: Publish / Unpublish (Admin)');
    console.log('─────────────────────────────────────────────────────────────');

    // Test: Agent cannot publish
    const agentPublish = await apiCall('PUT', `/property-workflow/${testPropertyId}/publish`, {
        note: 'Publishing'
    }, agentToken);
    logTest('PUT /property-workflow/:id/publish (agent - should fail)',
        agentPublish.status === 403,
        `Status: ${agentPublish.status}`);

    // Test: Admin publish (property must be ready_to_publish)
    await pool.query('UPDATE properties SET workflow_status = $1 WHERE id = $2', ['ready_to_publish', testPropertyId]);
    const adminPublish = await apiCall('PUT', `/property-workflow/${testPropertyId}/publish`, {
        note: 'Approved and published'
    }, adminToken);
    logTest('PUT /property-workflow/:id/publish (admin)',
        adminPublish.data?.success === true,
        adminPublish.data?.message || adminPublish.data?.error);

    // Verify it's published
    const verifyPublish = await pool.query('SELECT approve_status FROM properties WHERE id = $1', [testPropertyId]);
    logTest('Property is now published',
        verifyPublish.rows[0].approve_status === 'published',
        `approve_status: ${verifyPublish.rows[0].approve_status}`);

    // Test: Cannot publish already published
    const doublePublish = await apiCall('PUT', `/property-workflow/${testPropertyId}/publish`, {
        note: 'Try again'
    }, adminToken);
    const doublePublishFailed = doublePublish.data?.success === false && doublePublish.data?.error?.includes('already published');
    logTest('PUT /property-workflow/:id/publish (already published - should fail)',
        doublePublishFailed,
        doublePublish.data?.error || 'No error returned');

    // Test: Unpublish
    const adminUnpublish = await apiCall('PUT', `/property-workflow/${testPropertyId}/unpublish`, {
        workflow_status: 'wait_to_fix',
        note: 'Need updates before republishing'
    }, adminToken);
    logTest('PUT /property-workflow/:id/unpublish (admin)',
        adminUnpublish.data?.success === true,
        adminUnpublish.data?.message || adminUnpublish.data?.error);

    // Verify unpublished
    const verifyUnpublish = await pool.query('SELECT approve_status, workflow_status FROM properties WHERE id = $1', [testPropertyId]);
    logTest('Property is now unpublished with wait_to_fix',
        verifyUnpublish.rows[0].approve_status === 'pending' && verifyUnpublish.rows[0].workflow_status === 'wait_to_fix',
        `approve_status: ${verifyUnpublish.rows[0].approve_status}, workflow_status: ${verifyUnpublish.rows[0].workflow_status}`);

    console.log('');

    // =========================================================================
    // STEP 4: Workflow History
    // =========================================================================
    console.log('📋 STEP 4: Workflow History');
    console.log('─────────────────────────────────────────────────────────────');

    const history = await apiCall('GET', `/property-workflow/${testPropertyId}/history`, null, adminToken);
    logTest('GET /property-workflow/:id/history - has entries',
        history.data?.success === true && history.data?.data?.length > 0,
        `Found ${history.data?.data?.length || 0} history entries`);

    // Agent can see history of their team's properties
    await pool.query('UPDATE properties SET agent_team = $1 WHERE id = $2', ['Team A', testPropertyId]);
    const agentHistory = await apiCall('GET', `/property-workflow/${testPropertyId}/history`, null, agentToken);
    logTest('GET /property-workflow/:id/history (agent - own team)',
        agentHistory.data?.success === true,
        `Agent can see ${agentHistory.data?.data?.length || 0} entries`);

    // Agent cannot see other team's property history
    await pool.query('UPDATE properties SET agent_team = $1 WHERE id = $2', ['Team B', testPropertyId]);
    const agentHistoryOther = await apiCall('GET', `/property-workflow/${testPropertyId}/history`, null, agentToken);
    logTest('GET /property-workflow/:id/history (agent - other team - should fail)',
        agentHistoryOther.status === 403,
        `Status: ${agentHistoryOther.status}`);

    // Restore team
    await pool.query('UPDATE properties SET agent_team = $1 WHERE id = $2', ['Team A', testPropertyId]);

    console.log('');

    // =========================================================================
    // STEP 5: Delete Request Flow
    // =========================================================================
    console.log('📋 STEP 5: Delete Request Flow');
    console.log('─────────────────────────────────────────────────────────────');

    // Make property published
    await pool.query(`UPDATE properties SET approve_status = 'published', workflow_status = 'ready_to_publish', agent_team = 'Team A' WHERE id = $1`, [testPropertyId]);

    // Agent creates delete request
    const deleteRequest = await apiCall('POST', '/property-requests', {
        property_id: testPropertyId,
        request_type: 'delete',
        reason: 'Property is no longer available for sale'
    }, agentToken);
    logTest('POST /property-requests (delete request)',
        deleteRequest.data?.success === true,
        deleteRequest.data?.success ? `Request ID: ${deleteRequest.data?.data?.id}` : deleteRequest.data?.error);

    // Admin rejects the delete request
    if (deleteRequest.data?.data?.id) {
        const rejectDelete = await apiCall('PUT', `/property-requests/${deleteRequest.data.data.id}/process`, {
            action: 'reject',
            admin_response: 'Please provide more details'
        }, adminToken);
        logTest('PUT /property-requests/:id/process (reject)',
            rejectDelete.data?.success === true,
            rejectDelete.data?.message || rejectDelete.data?.error);
    }

    console.log('');

    // =========================================================================
    // STEP 6: Note Delete Permission
    // =========================================================================
    console.log('📋 STEP 6: Note Delete Permission');
    console.log('─────────────────────────────────────────────────────────────');

    // Agent creates a note
    const agentNote = await apiCall('POST', `/property-notes/${testPropertyId}`, {
        content: 'Test note for deletion',
        note_type: 'general'
    }, agentToken);

    if (agentNote.data?.data?.id) {
        const noteId = agentNote.data.data.id;

        // Agent can delete own note (within 24h)
        const deleteOwnNote = await apiCall('DELETE', `/property-notes/${testPropertyId}/${noteId}`, null, agentToken);
        logTest('DELETE /property-notes (agent - own note)',
            deleteOwnNote.data?.success === true,
            deleteOwnNote.data?.message || deleteOwnNote.data?.error);
    }

    // Admin creates and deletes note
    const adminNote = await apiCall('POST', `/property-notes/${testPropertyId}`, {
        content: 'Admin note for deletion test',
        note_type: 'general'
    }, adminToken);

    if (adminNote.data?.data?.id) {
        const deleteAdminNote = await apiCall('DELETE', `/property-notes/${testPropertyId}/${adminNote.data.data.id}`, null, adminToken);
        logTest('DELETE /property-notes (admin)',
            deleteAdminNote.data?.success === true,
            deleteAdminNote.data?.message || deleteAdminNote.data?.error);
    }

    console.log('');

    // =========================================================================
    // STEP 7: Agent Direct Edit/Delete on Unpublished
    // =========================================================================
    console.log('📋 STEP 7: Agent Direct Edit/Delete on Unpublished');
    console.log('─────────────────────────────────────────────────────────────');

    // Set property to pending (unpublished)
    await pool.query(`UPDATE properties SET approve_status = 'pending', workflow_status = 'pending', agent_team = 'Team A' WHERE id = $1`, [testPropertyId]);

    // Agent can edit unpublished property directly
    const agentEditUnpublished = await apiCall('PUT', `/properties/${testPropertyId}`, {
        remarks: 'Updated by agent on unpublished property'
    }, agentToken);
    logTest('PUT /properties/:id (agent - unpublished = direct edit allowed)',
        agentEditUnpublished.data?.success === true,
        agentEditUnpublished.data?.success ? 'Edit successful' : agentEditUnpublished.data?.error);

    // Restore to published for other tests
    await pool.query(`UPDATE properties SET approve_status = 'published', workflow_status = 'ready_to_publish' WHERE id = $1`, [testPropertyId]);

    console.log('');

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                         SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ✅ Passed: ${results.passed}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  📊 Total:  ${results.passed + results.failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (results.failed > 0) {
        console.log('Failed tests:');
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`  • ${t.name}: ${t.details}`);
        });
    }

    await pool.end();
}

runTests().catch(console.error);
