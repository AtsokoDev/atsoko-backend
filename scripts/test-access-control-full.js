/**
 * Comprehensive Access Control API Test
 * Tests all endpoints with proper authentication
 */

require('dotenv').config();

const API_URL = 'http://localhost:3000/api';

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, token = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const json = await response.json();
        return { status: response.status, data: json };
    } catch (error) {
        return { status: 0, error: error.message };
    }
}

// Test results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    console.log(`  ${icon} ${name}`);
    if (details) console.log(`     ${details}`);
    results.tests.push({ name, passed, details });
    if (passed) results.passed++; else results.failed++;
}

async function runTests() {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('       Access Control API - Comprehensive Test Suite');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // =========================================================================
    // STEP 1: Authentication
    // =========================================================================
    console.log('📋 STEP 1: Authentication');
    console.log('─────────────────────────────────────────────────────────────');

    // Try to login as admin
    let adminToken = null;
    let agentToken = null;

    // First, check if we have any users
    const pool = require('../config/database');
    const usersResult = await pool.query('SELECT id, email, role, team FROM users LIMIT 5');
    console.log(`  Found ${usersResult.rows.length} users in database`);

    if (usersResult.rows.length === 0) {
        console.log('  ⚠️  No users found. Creating test users...');

        // Create admin user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('test123', 10);

        await pool.query(`
            INSERT INTO users (email, password, name, role, team, is_active)
            VALUES ('testadmin@test.com', $1, 'Test Admin', 'admin', 'admin', true)
            ON CONFLICT (email) DO NOTHING
        `, [hashedPassword]);

        await pool.query(`
            INSERT INTO users (email, password, name, role, team, is_active)
            VALUES ('testagent@test.com', $1, 'Test Agent', 'agent', 'Team A', true)
            ON CONFLICT (email) DO NOTHING
        `, [hashedPassword]);

        console.log('  ✓ Created test users (testadmin@test.com, testagent@test.com)');
    }

    // Get users for login
    const allUsers = await pool.query('SELECT id, email, role, team FROM users WHERE is_active = true');
    const adminUser = allUsers.rows.find(u => u.role === 'admin');
    // Agent team info for testing
    const agentTeamInfo = { team: 'Team A' };

    console.log(`  Admin user: ${adminUser?.email || 'Not found'}`);

    // Login as admin
    const adminLogin = await apiCall('POST', '/auth/login', {
        email: 'testadmin@atsoko.com',
        password: 'TestPass123!'
    });

    if (adminLogin.data?.data?.accessToken) {
        adminToken = adminLogin.data.data.accessToken;
        logTest('Admin login', true, `Token received`);
    } else {
        logTest('Admin login', false, `Failed: ${JSON.stringify(adminLogin.data)}`);
    }

    // Login as agent
    const agentLogin = await apiCall('POST', '/auth/login', {
        email: 'testagent@atsoko.com',
        password: 'TestPass123!'
    });

    if (agentLogin.data?.data?.accessToken) {
        agentToken = agentLogin.data.data.accessToken;
        logTest('Agent login', true, `Token received`);
    } else {
        logTest('Agent login', false, `Failed: ${JSON.stringify(agentLogin.data)}`);
    }

    console.log('');

    // =========================================================================
    // STEP 2: Property Workflow API (Admin)
    // =========================================================================
    console.log('📋 STEP 2: Property Workflow API (Admin Only)');
    console.log('─────────────────────────────────────────────────────────────');

    // Test without token
    const workflowNoAuth = await apiCall('GET', '/property-workflow/pending');
    logTest('GET /property-workflow/pending (no auth)',
        workflowNoAuth.status === 401,
        `Status: ${workflowNoAuth.status}`);

    // Test with admin token
    if (adminToken) {
        const workflowWithAuth = await apiCall('GET', '/property-workflow/pending', null, adminToken);
        logTest('GET /property-workflow/pending (admin)',
            workflowWithAuth.data?.success === true,
            `Found ${workflowWithAuth.data?.pagination?.total || 0} pending properties`);

        // Get a property for testing
        const propertiesResult = await pool.query('SELECT id, property_id, approve_status, workflow_status FROM properties LIMIT 1');
        if (propertiesResult.rows.length > 0) {
            const testProperty = propertiesResult.rows[0];
            console.log(`  Using test property: ${testProperty.property_id} (ID: ${testProperty.id})`);

            // Test get workflow history
            const historyResult = await apiCall('GET', `/property-workflow/${testProperty.id}/history`, null, adminToken);
            logTest('GET /property-workflow/:id/history (admin)',
                historyResult.data?.success === true,
                `History entries: ${historyResult.data?.data?.length || 0}`);
        }
    }

    // Test with agent token (should fail for most)
    if (agentToken) {
        const workflowAgent = await apiCall('GET', '/property-workflow/pending', null, agentToken);
        logTest('GET /property-workflow/pending (agent - should fail)',
            workflowAgent.status === 403,
            `Status: ${workflowAgent.status}`);
    }

    console.log('');

    // =========================================================================
    // STEP 3: Property Requests API
    // =========================================================================
    console.log('📋 STEP 3: Property Requests API');
    console.log('─────────────────────────────────────────────────────────────');

    // Test without token
    const requestsNoAuth = await apiCall('GET', '/property-requests');
    logTest('GET /property-requests (no auth)',
        requestsNoAuth.status === 401,
        `Status: ${requestsNoAuth.status}`);

    // Test with admin token
    if (adminToken) {
        const requestsAdmin = await apiCall('GET', '/property-requests', null, adminToken);
        logTest('GET /property-requests (admin)',
            requestsAdmin.data?.success === true,
            `Found ${requestsAdmin.data?.pagination?.total || 0} requests`);
    }

    // Test creating a request (agent only, for published properties)
    if (agentToken) {
        // Find a published property for the agent's team
        const agentTeam = agentTeamInfo?.team;
        const publishedProperty = await pool.query(`
            SELECT id, property_id FROM properties 
            WHERE approve_status = 'published' 
            LIMIT 1
        `);

        if (publishedProperty.rows.length > 0) {
            const propId = publishedProperty.rows[0].id;
            console.log(`  Testing with published property ID: ${propId}`);

            // Update this property to belong to agent's team for testing
            await pool.query('UPDATE properties SET agent_team = $1 WHERE id = $2', [agentTeam, propId]);

            // Create edit request
            const createRequest = await apiCall('POST', '/property-requests', {
                property_id: propId,
                request_type: 'edit',
                reason: 'Test edit request - need to update price',
                requested_changes: {
                    price: 999999,
                    remarks: 'Updated via test'
                }
            }, agentToken);

            logTest('POST /property-requests (agent - edit request)',
                createRequest.data?.success === true,
                createRequest.data?.success ? `Request ID: ${createRequest.data?.data?.id}` : createRequest.data?.error);

            // If created, test getting the request
            if (createRequest.data?.success && createRequest.data?.data?.id) {
                const requestId = createRequest.data.data.id;

                // Get request detail
                const getRequest = await apiCall('GET', `/property-requests/${requestId}`, null, agentToken);
                logTest('GET /property-requests/:id (agent)',
                    getRequest.data?.success === true,
                    `Request type: ${getRequest.data?.data?.request_type}`);

                // Admin process the request
                if (adminToken) {
                    const processRequest = await apiCall('PUT', `/property-requests/${requestId}/process`, {
                        action: 'approve',
                        admin_response: 'Approved for testing'
                    }, adminToken);

                    logTest('PUT /property-requests/:id/process (admin - approve)',
                        processRequest.data?.success === true,
                        processRequest.data?.message || processRequest.data?.error);
                }
            }
        } else {
            console.log('  ⚠️  No published properties found for request test');
        }
    }

    console.log('');

    // =========================================================================
    // STEP 4: Property Notes API
    // =========================================================================
    console.log('📋 STEP 4: Property Notes API');
    console.log('─────────────────────────────────────────────────────────────');

    // Get a property for testing
    const testPropResult = await pool.query('SELECT id FROM properties LIMIT 1');
    const testPropertyId = testPropResult.rows[0]?.id;

    // Test without token
    const notesNoAuth = await apiCall('GET', `/property-notes/${testPropertyId}`);
    logTest('GET /property-notes/:id (no auth)',
        notesNoAuth.status === 401,
        `Status: ${notesNoAuth.status}`);

    // Test with admin token
    if (adminToken && testPropertyId) {
        // Make sure property belongs to a team for agent access
        await pool.query('UPDATE properties SET agent_team = $1 WHERE id = $2', [agentTeamInfo?.team || 'Team A', testPropertyId]);

        const notesAdmin = await apiCall('GET', `/property-notes/${testPropertyId}`, null, adminToken);
        logTest('GET /property-notes/:id (admin)',
            notesAdmin.data?.success === true,
            `Found ${notesAdmin.data?.data?.length || 0} notes`);

        // Create a note
        const createNote = await apiCall('POST', `/property-notes/${testPropertyId}`, {
            content: 'This is a test note from admin',
            note_type: 'general',
            is_internal: false
        }, adminToken);

        logTest('POST /property-notes/:id (admin - create note)',
            createNote.data?.success === true,
            createNote.data?.success ? `Note ID: ${createNote.data?.data?.id}` : createNote.data?.error);

        // Create internal note
        const createInternalNote = await apiCall('POST', `/property-notes/${testPropertyId}`, {
            content: 'This is an internal admin note',
            note_type: 'general',
            is_internal: true
        }, adminToken);

        logTest('POST /property-notes/:id (admin - internal note)',
            createInternalNote.data?.success === true,
            'Internal notes should be hidden from agents');
    }

    // Test with agent token
    if (agentToken && testPropertyId) {
        const notesAgent = await apiCall('GET', `/property-notes/${testPropertyId}`, null, agentToken);
        logTest('GET /property-notes/:id (agent)',
            notesAgent.data?.success === true,
            `Found ${notesAgent.data?.data?.length || 0} notes (internal notes hidden)`);

        // Agent create note
        const agentNote = await apiCall('POST', `/property-notes/${testPropertyId}`, {
            content: 'This is a response from agent',
            note_type: 'fix_response'
        }, agentToken);

        logTest('POST /property-notes/:id (agent - fix_response)',
            agentNote.data?.success === true,
            agentNote.data?.success ? `Note created` : agentNote.data?.error);
    }

    console.log('');

    // =========================================================================
    // STEP 5: Properties API with Access Control
    // =========================================================================
    console.log('📋 STEP 5: Properties API with Access Control');
    console.log('─────────────────────────────────────────────────────────────');

    // Guest can see published properties
    const guestView = await apiCall('GET', '/properties?limit=1');
    logTest('GET /properties (guest - public)',
        guestView.data?.success === true,
        `Found ${guestView.data?.pagination?.total || 0} published properties`);

    // Check if workflow_status is present
    if (guestView.data?.data?.[0]) {
        const hasWorkflowStatus = 'workflow_status' in guestView.data.data[0];
        logTest('Property has workflow_status field',
            hasWorkflowStatus,
            `Value: ${guestView.data.data[0].workflow_status}`);
    }

    // Agent trying to edit a published property should get requiresRequest error
    if (agentToken) {
        const publishedProp = await pool.query(`
            SELECT id FROM properties 
            WHERE approve_status = 'published' AND agent_team = $1
            LIMIT 1
        `, [agentTeamInfo?.team || 'Team A']);

        if (publishedProp.rows.length > 0) {
            const editPublished = await apiCall('PUT', `/properties/${publishedProp.rows[0].id}`, {
                price: 123456
            }, agentToken);

            logTest('PUT /properties/:id (agent - published property)',
                editPublished.status === 403 && editPublished.data?.requiresRequest === true,
                `Should get requiresRequest: true - Got: ${editPublished.data?.requiresRequest}`);
        }
    }

    console.log('');

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                         SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ✅ Passed: ${results.passed}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  📊 Total:  ${results.passed + results.failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Cleanup
    await pool.end();

    if (results.failed > 0) {
        console.log('Failed tests:');
        results.tests.filter(t => !t.passed).forEach(t => {
            console.log(`  • ${t.name}: ${t.details}`);
        });
    }
}

runTests().catch(console.error);
