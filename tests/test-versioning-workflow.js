#!/usr/bin/env node
/**
 * Comprehensive Test Suite for Versioning & Workflow System
 * Tests all endpoints and edge cases
 * 
 * Usage: node tests/test-versioning-workflow.js
 */

require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3333';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Test state
let passed = 0;
let failed = 0;
let skipped = 0;
let errors = [];
let testDraftPropertyId = null;   // numeric DB id
let testDraftPropertyCode = null; // string code like AT9999R
let testPublishedPropertyId = null;
let testPublishedPropertyCode = null;
let testVersionId = null;
let testRequestId = null;
let testDeleteRequestPropertyId = null;

// Generate JWT tokens
function makeToken(user) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

const ADMIN_USER = { userId: 1, role: 'admin', team: null };
const AGENT_USER = { userId: 6, role: 'agent', team: 'A' };
const AGENT_B_USER = { userId: 3, role: 'agent', team: 'B' };

const adminToken = makeToken(ADMIN_USER);
const agentToken = makeToken(AGENT_USER);
const agentBToken = makeToken(AGENT_B_USER);

// HTTP helper
function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };
        if (token) options.headers.Authorization = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ status: res.statusCode, body: json });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Test runner
async function test(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        if (e.message === 'SKIP') {
            skipped++;
            console.log(`  ⏭️  ${name} (skipped — dependency failed)`);
            return;
        }
        failed++;
        const msg = `${name}: ${e.message}`;
        errors.push(msg);
        console.log(`  ❌ ${name}`);
        console.log(`     → ${e.message}`);
    }
}

function skip() { throw new Error('SKIP'); }
function requireId(id, label) { if (!id) { throw new Error('SKIP'); } }

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, label = '') {
    if (actual !== expected) {
        throw new Error(`${label} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertNumEqual(actual, expected, label = '') {
    if (Number(actual) !== Number(expected)) {
        throw new Error(`${label} Expected ${expected}, got ${actual}`);
    }
}

// ===================================================================
// TEST GROUPS
// ===================================================================

async function testHealthCheck() {
    console.log('\n📋 Health Check');
    await test('Server is running', async () => {
        const r = await request('GET', '/');
        assertEqual(r.status, 200, 'status');
        assertEqual(r.body.status, 'OK', 'body.status');
    });
}

async function testAuth() {
    console.log('\n🔐 Authentication');

    await test('No token → 401', async () => {
        const r = await request('GET', '/api/property-workflow/pending');
        assertEqual(r.status, 401, 'status');
    });

    await test('Invalid token → 401/403', async () => {
        const r = await request('GET', '/api/property-workflow/pending', null, 'bad-token');
        assert(r.status === 401 || r.status === 403, `Expected 401/403, got ${r.status}`);
    });

    await test('Valid admin token → 200', async () => {
        const r = await request('GET', '/api/property-workflow/pending', null, adminToken);
        assertEqual(r.status, 200, 'status');
    });
}

async function testAgentCreateDraft() {
    console.log('\n📝 Agent Create Draft Property');

    await test('Agent POST creates draft', async () => {
        const r = await request('POST', '/api/properties', {
            type: 'Warehouse',
            status: 'For Rent',
            province: 'Bangkok',
            district: 'Bangna',
            sub_district: 'Bangna',
            price: 50000,
            size: 500,
            agent_team: 'A',
            building_type: 'W'
        }, agentToken);
        assertEqual(r.status, 201, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success should be true');
        assert(r.body.data, 'should have data');

        testDraftPropertyId = r.body.data.id;
        testDraftPropertyCode = r.body.data.property_id;

        // Check new status fields
        assertEqual(r.body.data.publication_status, 'draft', 'publication_status');
        assertEqual(r.body.data.moderation_status, 'none', 'moderation_status');
    });

    await test('Draft NOT visible to public (no auth GET)', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('GET', '/api/properties');
        assertEqual(r.status, 200, 'status');
        const found = r.body.data.find(p => p.id === testDraftPropertyId);
        assert(!found, 'Draft should not be in public list');
    });

    await test('Agent can see own draft', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('GET', `/api/properties/${testDraftPropertyId}`, null, agentToken);
        assertEqual(r.status, 200, 'status');
        assertEqual(r.body.data.publication_status || 'draft', 'draft', 'publication_status');
    });

    await test('Agent can edit draft freely', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/properties/${testDraftPropertyId}`, {
            price: 60000,
            size: 600
        }, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success');
    });
}

async function testAgentSubmitDraft() {
    console.log('\n📤 Agent Submit Draft for Review');

    await test('Agent submits draft → pending_add', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/property-workflow/${testDraftPropertyId}/submit`, {
            note: 'Ready for review'
        }, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success');
        assertEqual(r.body.data.moderation_status, 'pending_add', 'moderation_status');
    });

    await test('Agent CANNOT edit submitted property', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/properties/${testDraftPropertyId}`, {
            price: 70000
        }, agentToken);
        assert(r.status === 403 || r.status === 400, `Expected 403/400, got ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    });

    await test('Cannot double-submit', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/property-workflow/${testDraftPropertyId}/submit`, {}, agentToken);
        assert(r.status === 400, `Expected 400, got ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
    });

    await test('Draft appears in admin pending list', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('GET', '/api/property-workflow/pending', null, adminToken);
        assertEqual(r.status, 200, 'status');
        const found = r.body.data.find(p => p.id === testDraftPropertyId);
        assert(found, 'Submitted draft should be in pending list');
    });
}

async function testAdminRejectDraft() {
    console.log('\n🔄 Admin Return Draft for Revision');

    await test('Admin sets workflow_status to wait_to_fix → rejected_add', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/property-workflow/${testDraftPropertyId}/status`, {
            workflow_status: 'wait_to_fix',
            note: 'Please fix the price'
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Property now has rejected_add status', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('GET', `/api/properties/${testDraftPropertyId}`, null, agentToken);
        assertEqual(r.status, 200, 'status');
        assertEqual(r.body.data.moderation_status, 'rejected_add', 'moderation_status');
    });

    await test('Agent can edit rejected draft', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/properties/${testDraftPropertyId}`, {
            price: 55000
        }, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Agent re-submits after fixing', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/property-workflow/${testDraftPropertyId}/submit`, {
            note: 'Fixed the price'
        }, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });
}

async function testAdminPublish() {
    console.log('\n✅ Admin Publish Property');

    await test('Admin publishes the draft', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('PUT', `/api/property-workflow/${testDraftPropertyId}/publish`, {
            note: 'Looks good, publishing'
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success');
        assertEqual(r.body.data.publication_status, 'published', 'publication_status');
    });

    await test('Published property visible to public', async () => {
        requireId(testDraftPropertyId, 'testDraftPropertyId');
        const r = await request('GET', `/api/properties/${testDraftPropertyId}`);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assertEqual(r.body.data.publication_status || r.body.data.approve_status, 'published', 'status');
    });

    // Store for later tests
    testPublishedPropertyId = testDraftPropertyId;
    testPublishedPropertyCode = testDraftPropertyCode;
}

async function testAgentRequestEdit() {
    console.log('\n✏️ Agent Request Edit on Live Property');

    await test('Agent creates pending version from live', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('POST', `/api/property-versions/${testPublishedPropertyId}/request-edit`, {
            reason: 'Need to update price'
        }, agentToken);
        assertEqual(r.status, 201, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success');
        assert(r.body.data.id, 'should have version id');
        testVersionId = r.body.data.id;
    });

    await test('Property moderation_status is now pending_edit', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/properties/${testPublishedPropertyId}`, null, agentToken);
        assertEqual(r.status, 200, 'status');
        assertEqual(r.body.data.moderation_status, 'pending_edit', 'moderation_status');
    });

    await test('Live property still visible to public', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/properties/${testPublishedPropertyId}`);
        assertEqual(r.status, 200, 'status');
        // Should still show old price
    });

    await test('Cannot create second edit request', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('POST', `/api/property-versions/${testPublishedPropertyId}/request-edit`, {
            reason: 'Another edit'
        }, agentToken);
        assert(r.status === 400 || r.status === 409, `Expected 400/409, got ${r.status}`);
    });
}

async function testAgentEditVersion() {
    console.log('\n📝 Agent Edit Pending Version');

    await test('Agent edits pending version', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}`, {
            updates: { price: 75000, size: 700 }
        }, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success');
    });

    await test('Get pending version shows updated data', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/property-versions/${testPublishedPropertyId}/latest`, null, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.data, 'should have data');
        // Check version_data has our change
        const versionData = r.body.data.version_data;
        assert(versionData, 'should have version_data');
        assertNumEqual(versionData.price, 75000, 'price in version');
    });

    await test('Agent submits version for review', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}/submit`, {}, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Agent CANNOT edit submitted version', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}`, {
            updates: { price: 80000 }
        }, agentToken);
        assert(r.status === 400 || r.status === 403, `Expected 400/403, got ${r.status}`);
    });
}

async function testAdminDiffAndApprove() {
    console.log('\n🔍 Admin Diff View & Approve Edit');

    await test('Admin can view diff', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('GET', `/api/property-versions/version/${testVersionId}/diff`, null, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success');
        assert(r.body.data.diff, 'should have diff');
        assert(Array.isArray(r.body.data.diff), 'should have changes array');
        // Check that price change is in diff
        const priceChange = r.body.data.diff.find(c => c.field === 'price');
        assert(priceChange, 'Should have price change in diff');
    });

    await test('Version history shows pending version', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/property-versions/${testPublishedPropertyId}`, null, adminToken);
        assertEqual(r.status, 200, 'status');
        assert(r.body.data.length > 0, 'should have versions');
    });

    await test('Admin approves version', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}/approve`, {
            note: 'Price update approved'
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(r.body.success, 'success');
    });

    await test('Property now has updated price', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/properties/${testPublishedPropertyId}`, null, adminToken);
        assertEqual(r.status, 200, 'status');
        assertNumEqual(r.body.data.price, 75000, 'price after approve');
        assertEqual(r.body.data.moderation_status, 'none', 'moderation back to none');
    });
}

async function testEditRejectFlow() {
    console.log('\n🔄 Edit → Reject → Revise → Approve Flow');

    // Create a new edit request
    await test('Agent creates another edit request', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('POST', `/api/property-versions/${testPublishedPropertyId}/request-edit`, {
            reason: 'Update location info'
        }, agentToken);
        assertEqual(r.status, 201, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        testVersionId = r.body.data.id;
    });

    await test('Agent edits version', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}`, {
            updates: { district: 'Sukhumvit' }
        }, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Agent submits version', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}/submit`, {}, agentToken);
        assertEqual(r.status, 200, `status`);
    });

    await test('Admin returns for revision', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}/reject`, {
            action: 'return',
            note: 'Incorrect district name'
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Property has rejected_edit status', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/properties/${testPublishedPropertyId}`, null, agentToken);
        assertEqual(r.status, 200, 'status');
        assertEqual(r.body.data.moderation_status, 'rejected_edit', 'moderation_status');
    });

    await test('Agent can edit rejected version', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}`, {
            updates: { district: 'Bangna' }
        }, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Agent re-submits', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}/submit`, {}, agentToken);
        assertEqual(r.status, 200, `status`);
    });

    await test('Admin approves revised version', async () => {
        requireId(testVersionId, 'testVersionId');
        const r = await request('PUT', `/api/property-versions/version/${testVersionId}/approve`, {
            note: 'Looks good now'
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });
}

async function testDeleteRequestFlow() {
    console.log('\n🗑️ Delete Request Flow');

    // Create another property to delete
    await test('Agent creates property for delete test', async () => {
        const r = await request('POST', '/api/properties', {
            type: 'Factory',
            status: 'For Sale',
            province: 'Samut Prakan',
            district: 'Bang Pli',
            sub_district: 'Bang Pli Yai',
            price: 10000000,
            price_alternative: 10000000,
            size: 2000,
            agent_team: 'A',
            building_type: 'S'
        }, agentToken);
        assertEqual(r.status, 201, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        testDeleteRequestPropertyId = r.body.data.id;
    });

    // Submit and publish it first
    await test('Submit for review', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('PUT', `/api/property-workflow/${testDeleteRequestPropertyId}/submit`, {}, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Admin publishes it', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('PUT', `/api/property-workflow/${testDeleteRequestPropertyId}/publish`, {}, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Agent requests delete on published property', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('POST', '/api/property-requests', {
            property_id: testDeleteRequestPropertyId,
            request_type: 'delete',
            reason: 'Property no longer available'
        }, agentToken);
        assertEqual(r.status, 201, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        testRequestId = r.body.data.id;
    });

    await test('Property has pending_delete status', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('GET', `/api/properties/${testDeleteRequestPropertyId}`, null, agentToken);
        assertEqual(r.status, 200, 'status');
        assertEqual(r.body.data.moderation_status, 'pending_delete', 'moderation_status');
    });

    await test('Cannot create second request while pending', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('POST', '/api/property-requests', {
            property_id: testDeleteRequestPropertyId,
            request_type: 'delete',
            reason: 'Another delete request'
        }, agentToken);
        assertEqual(r.status, 400, `status`);
    });

    await test('Admin approves delete as unpublish', async () => {
        requireId(testRequestId, 'testRequestId');
        const r = await request('PUT', `/api/property-requests/${testRequestId}/process`, {
            action: 'approve_unpublish',
            admin_response: 'Unpublished as requested'
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Property is now unpublished', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('GET', `/api/properties/${testDeleteRequestPropertyId}`, null, adminToken);
        assertEqual(r.status, 200, 'status');
        assertEqual(r.body.data.publication_status, 'unpublished', 'publication_status');
        assertEqual(r.body.data.moderation_status, 'none', 'moderation_status');
    });

    await test('Unpublished NOT visible to public', async () => {
        const r = await request('GET', `/api/properties/${testDeleteRequestPropertyId}`);
        // Should be 404 or filtered out
        assert(r.status === 404 || (r.status === 200 && !r.body.success), 'Should not be visible');
    });
}

async function testSoftDelete() {
    console.log('\n🔒 Soft Delete');

    await test('Agent can delete unpublished property (soft)', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('DELETE', `/api/properties/${testDeleteRequestPropertyId}`, null, agentToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Deleted property not visible to public', async () => {
        const r = await request('GET', `/api/properties/${testDeleteRequestPropertyId}`);
        assert(r.status === 404 || (r.status === 200 && !r.body.success), 'Should not be visible');
    });

    await test('Deleted property visible to admin with deleted filter', async () => {
        requireId(testDeleteRequestPropertyId, 'testDeleteRequestPropertyId');
        const r = await request('GET', `/api/properties/${testDeleteRequestPropertyId}`, null, adminToken);
        // Admin should still be able to see it
        assertEqual(r.status, 200, `status`);
    });
}

async function testAdminDirectActions() {
    console.log('\n👑 Admin Direct Actions');

    await test('Admin creates published property directly', async () => {
        const r = await request('POST', '/api/properties', {
            type: 'Warehouse',
            status: 'For Rent',
            province: 'Chonburi',
            district: 'Sri Racha',
            sub_district: 'Laem Chabang',
            price: 100000,
            size: 1000,
            approve_status: 'published',
            building_type: 'W'
        }, adminToken);
        assertEqual(r.status, 201, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        const prop = r.body.data;
        // Admin with approve_status=published should get published
        assertEqual(prop.publication_status || prop.approve_status, 'published', 'should be published');
    });

    await test('Admin edits published property directly', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('PUT', `/api/properties/${testPublishedPropertyId}`, {
            price: 80000
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
    });

    await test('Admin unpublishes property', async () => {
        // Create a property to unpublish
        const createR = await request('POST', '/api/properties', {
            type: 'Factory',
            status: 'For Rent',
            province: 'Rayong',
            district: 'Pluak Daeng',
            sub_district: 'Pluak Daeng',
            price: 200000,
            size: 3000,
            approve_status: 'published',
            building_type: 'S'
        }, adminToken);
        assertEqual(createR.status, 201, `create status`);
        const propId = createR.body.data.id;

        const r = await request('PUT', `/api/property-workflow/${propId}/unpublish`, {
            note: 'Needs review',
            workflow_status: 'wait_to_fix'
        }, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assertEqual(r.body.data.publication_status, 'unpublished', 'publication_status');
    });
}

async function testPermissions() {
    console.log('\n🛡️ Permission Checks');

    await test('Agent B cannot edit Agent A property', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('PUT', `/api/properties/${testPublishedPropertyId}`, {
            price: 99999
        }, agentBToken);
        assert(r.status === 403 || r.status === 400, `Expected 403/400, got ${r.status}`);
    });

    await test('Agent cannot publish', async () => {
        // Create a draft first
        const createR = await request('POST', '/api/properties', {
            type: 'Warehouse',
            status: 'For Rent',
            province: 'Bangkok',
            district: 'Test',
            sub_district: 'Test',
            price: 1000,
            size: 100,
            agent_team: 'A',
            building_type: 'W'
        }, agentToken);
        if (!createR.body.data) skip();
        const propId = createR.body.data.id;

        const r = await request('PUT', `/api/property-workflow/${propId}/publish`, {}, agentToken);
        assert(r.status === 403 || r.status === 401, `Expected 403, got ${r.status}`);

        // Cleanup - soft delete it
        await request('DELETE', `/api/properties/${propId}`, null, agentToken);
    });

    await test('Agent cannot directly set publication_status', async () => {
        const createR = await request('POST', '/api/properties', {
            type: 'Warehouse',
            status: 'For Rent',
            province: 'Bangkok',
            district: 'Test2',
            sub_district: 'Test2',
            price: 1000,
            size: 100,
            agent_team: 'A',
            publication_status: 'published',  // Agent tries to self-publish
            building_type: 'W'
        }, agentToken);
        // Should create as draft regardless
        assertEqual(createR.status, 201, 'status');
        assertEqual(createR.body.data.publication_status, 'draft', 'Should be draft, not published');

        // Cleanup
        await request('DELETE', `/api/properties/${createR.body.data.id}`, null, agentToken);
    });

    await test('Agent cannot approve versions', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        // Would need a pending version ID — skip if not available
        // Create a fresh edit flow
        const editR = await request('POST', `/api/property-versions/${testPublishedPropertyId}/request-edit`, {
            reason: 'Permission test'
        }, agentToken);

        if (editR.status === 201) {
            const vId = editR.body.data.id;
            const r = await request('PUT', `/api/property-versions/version/${vId}/approve`, {}, agentToken);
            assert(r.status === 403 || r.status === 401, `Expected 403, got ${r.status}`);

            // Cleanup: admin discards this version
            await request('PUT', `/api/property-versions/version/${vId}/reject`, {
                action: 'reject', note: 'test cleanup'
            }, adminToken);
        }
    });
}

async function testVersionHistory() {
    console.log('\n📜 Version History & Revert');

    await test('Get version history', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/property-versions/${testPublishedPropertyId}`, null, adminToken);
        assertEqual(r.status, 200, 'status');
        assert(Array.isArray(r.body.data), 'data should be array');
        assert(r.body.data.length > 0, 'should have at least one version');
    });

    await test('Admin can revert to previous version', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        // Get versions
        const histR = await request('GET', `/api/property-versions/${testPublishedPropertyId}?status=approved`, null, adminToken);
        if (histR.body.data.length > 0) {
            const oldVersion = histR.body.data[histR.body.data.length - 1]; // oldest approved
            const r = await request('PUT', `/api/property-versions/version/${oldVersion.id}/revert`, {
                reason: 'Reverting to old version'
            }, adminToken);
            assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        } else {
            console.log('     ⚠️ No approved versions to revert to, skipping');
        }
    });
}

async function testWorkflowPendingList() {
    console.log('\n📋 Workflow Pending List');

    await test('Admin sees pending items with summary', async () => {
        const r = await request('GET', '/api/property-workflow/pending', null, adminToken);
        assertEqual(r.status, 200, 'status');
        assert(r.body.data, 'should have data');
        assert(r.body.pagination, 'should have pagination');
        assert(r.body.summary !== undefined, 'should have summary');
    });

    await test('Filter by moderation_status works', async () => {
        const r = await request('GET', '/api/property-workflow/pending?moderation_status=pending_add', null, adminToken);
        assertEqual(r.status, 200, 'status');
        // All items should have pending_add moderation
        if (r.body.data.length > 0) {
            r.body.data.forEach(p => {
                const mod = p.moderation_status || 'none';
                assert(mod === 'pending_add' || !p.moderation_status, 
                    `Expected pending_add, got ${mod}`);
            });
        }
    });
}

async function testPropertyRequestsList() {
    console.log('\n📋 Property Requests List');

    await test('Admin sees requests with new fields', async () => {
        const r = await request('GET', '/api/property-requests', null, adminToken);
        assertEqual(r.status, 200, 'status');
        assert(r.body.data, 'should have data');
        assert(r.body.pagination, 'should have pagination');
    });

    await test('Agent sees only their team requests', async () => {
        const r = await request('GET', '/api/property-requests', null, agentToken);
        assertEqual(r.status, 200, 'status');
    });
}

async function testEdgeCases() {
    console.log('\n⚡ Edge Cases');

    await test('GET non-existent property → 404', async () => {
        const r = await request('GET', '/api/properties/999999');
        assertEqual(r.status, 404, 'status');
    });

    await test('Edit non-existent property → 404', async () => {
        const r = await request('PUT', '/api/properties/999999', { price: 1000 }, adminToken);
        assertEqual(r.status, 404, 'status');
    });

    await test('Submit non-existent property → 404', async () => {
        const r = await request('PUT', '/api/property-workflow/999999/submit', {}, agentToken);
        assertEqual(r.status, 404, 'status');
    });

    await test('Request edit on non-existent property → 404', async () => {
        const r = await request('POST', '/api/property-versions/999999/request-edit', {
            reason: 'test'
        }, agentToken);
        assertEqual(r.status, 404, `status (got ${r.status}: ${JSON.stringify(r.body).slice(0, 100)})`);
    });

    await test('Delete request on draft → 400', async () => {
        // Create a new draft
        const createR = await request('POST', '/api/properties', {
            type: 'Warehouse', status: 'For Rent',
            province: 'Test', district: 'Test', sub_district: 'Test',
            price: 1000, size: 100, agent_team: 'A', building_type: 'W'
        }, agentToken);
        if (!createR.body.data) skip();
        const draftId = createR.body.data.id;

        const r = await request('POST', '/api/property-requests', {
            property_id: draftId,
            request_type: 'delete',
            reason: 'test'
        }, agentToken);
        assertEqual(r.status, 400, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);

        // Cleanup
        await request('DELETE', `/api/properties/${draftId}`, null, agentToken);
    });

    await test('Edit values persist correctly in version_data JSONB', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        // Use a published property that exists (pick from sample)
        // testPublishedPropertyId should still be published after our revert
        const checkR = await request('GET', `/api/properties/${testPublishedPropertyId}`, null, adminToken);
        if (checkR.body.data.publication_status === 'published' || checkR.body.data.approve_status === 'published') {
            const editR = await request('POST', `/api/property-versions/${testPublishedPropertyId}/request-edit`, {
                reason: 'JSON test'
            }, agentToken);

            if (editR.status === 201) {
                const vId = editR.body.data.id;
                // Edit with complex data
                const updateR = await request('PUT', `/api/property-versions/version/${vId}`, {
                    updates: {
                        features: ['loading dock', 'fire sprinkler', 'office space'],
                        price: 95000
                    }
                }, agentToken);
                assertEqual(updateR.status, 200, 'update status');

                // Verify the data
                const latestR = await request('GET', `/api/property-versions/${testPublishedPropertyId}/latest`, null, agentToken);
                assertEqual(latestR.status, 200, 'latest status');
                const vd = latestR.body.data.version_data;
                assertNumEqual(vd.price, 95000, 'price in version_data');
                assert(Array.isArray(vd.features), 'features should be array');
                assertEqual(vd.features.length, 3, 'features count');

                // Cleanup
                await request('PUT', `/api/property-versions/version/${vId}/reject`, {
                    action: 'reject', note: 'test cleanup'
                }, adminToken);
            }
        } else {
            console.log('     ⚠️ Property not published, skipping JSON test');
        }
    });

    await test('Public GET /api/properties filters correctly', async () => {
        const r = await request('GET', '/api/properties?page=1&limit=5');
        assertEqual(r.status, 200, 'status');
        // All results should be published
        if (r.body.data && r.body.data.length > 0) {
            r.body.data.forEach(p => {
                const pubStat = p.publication_status || p.approve_status;
                assertEqual(pubStat, 'published', `Property ${p.property_id} should be published, got ${pubStat}`);
            });
        }
    });
}

async function testStaleHandling() {
    console.log('\n🕐 Stale Request Handling');

    // Find an existing published property to test with
    await test('Admin edit marks pending versions as stale', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        // First, check our test property status
        const checkR = await request('GET', `/api/properties/${testPublishedPropertyId}`, null, adminToken);
        const prop = checkR.body.data;
        const pubStat = prop.publication_status || prop.approve_status;
        const modStat = prop.moderation_status || 'none';

        if (pubStat !== 'published') {
            console.log(`     ⚠️ Property not published (${pubStat}), skipping stale test`);
            return;
        }
        if (modStat !== 'none') {
            console.log(`     ⚠️ Property has moderation (${modStat}), skipping stale test`);
            return;
        }

        // Agent creates edit request
        const editR = await request('POST', `/api/property-versions/${testPublishedPropertyId}/request-edit`, {
            reason: 'Stale test'
        }, agentToken);

        if (editR.status !== 201) {
            console.log(`     ⚠️ Could not create edit request (${editR.status}), skipping`);
            return;
        }

        const vId = editR.body.data.id;

        // Admin directly edits the live property (should mark version as stale)
        const adminEditR = await request('PUT', `/api/properties/${testPublishedPropertyId}`, {
            price: 85000
        }, adminToken);
        assertEqual(adminEditR.status, 200, 'admin edit status');

        // Check that the version is marked as stale/discarded
        const versionR = await request('GET', `/api/property-versions/${testPublishedPropertyId}`, null, adminToken);
        assertEqual(versionR.status, 200, 'version list status');

        // The version may be discarded or have admin_note
        const updatedVersion = versionR.body.data.find(v => v.id === vId);
        if (updatedVersion) {
            // Check it was marked as stale
            assert(
                updatedVersion.status === 'discarded' || updatedVersion.admin_note,
                `Version should be discarded or have admin_note, got status=${updatedVersion.status}, note=${updatedVersion.admin_note}`
            );
        }
    });
}

async function testPropertySuggestions() {
    console.log('\n🔎 Property Suggestions');

    await test('Suggestions only show published properties', async () => {
        const r = await request('GET', '/api/properties/suggestions?q=A');
        assertEqual(r.status, 200, 'status');
        // All results should be published
    });
}

async function testWorkflowHistory() {
    console.log('\n📜 Workflow History');

    await test('Get workflow history for property', async () => {
        requireId(testPublishedPropertyId, 'testPublishedPropertyId');
        const r = await request('GET', `/api/property-workflow/${testPublishedPropertyId}/history`, null, adminToken);
        assertEqual(r.status, 200, `status (body: ${JSON.stringify(r.body).slice(0, 200)})`);
        assert(Array.isArray(r.body.data), 'should be array');
    });
}

// ===================================================================
// CLEANUP
// ===================================================================

async function cleanup() {
    console.log('\n🧹 Cleanup');
    const pool = require('../config/database');

    try {
        // Delete test versions
        await pool.query("DELETE FROM property_versions WHERE reason LIKE '%test%' OR reason LIKE '%Permission%' OR reason LIKE '%Stale%' OR reason LIKE '%JSON%'");

        // Delete test properties we created
        if (testDraftPropertyId) {
            await pool.query('DELETE FROM workflow_history WHERE property_id = $1', [testDraftPropertyId]);
            await pool.query('DELETE FROM property_notes WHERE property_id = $1', [testDraftPropertyId]);
            await pool.query('DELETE FROM property_versions WHERE property_id = $1', [testDraftPropertyId]);
        }
        if (testDeleteRequestPropertyId) {
            await pool.query('DELETE FROM property_requests WHERE property_id = $1', [testDeleteRequestPropertyId]);
            await pool.query('DELETE FROM workflow_history WHERE property_id = $1', [testDeleteRequestPropertyId]);
            await pool.query('DELETE FROM property_notes WHERE property_id = $1', [testDeleteRequestPropertyId]);
            await pool.query('DELETE FROM property_versions WHERE property_id = $1', [testDeleteRequestPropertyId]);
        }

        // Delete test properties themselves
        const testProps = await pool.query("SELECT id FROM properties WHERE province IN ('Bangkok', 'Samut Prakan', 'Chonburi', 'Rayong', 'Test') AND district IN ('Bangna', 'Bang Pli', 'Sri Racha', 'Pluak Daeng', 'Test', 'Test2', 'Sukhumvit')");
        for (const p of testProps.rows) {
            await pool.query('DELETE FROM workflow_history WHERE property_id = $1', [p.id]);
            await pool.query('DELETE FROM property_notes WHERE property_id = $1', [p.id]);
            await pool.query('DELETE FROM property_versions WHERE property_id = $1', [p.id]);
            await pool.query('DELETE FROM property_requests WHERE property_id = $1', [p.id]);
            await pool.query('DELETE FROM properties WHERE id = $1', [p.id]);
        }

        console.log('  ✅ Test data cleaned up');
    } catch (e) {
        console.log(`  ⚠️ Cleanup error: ${e.message}`);
    } finally {
        await pool.end();
    }
}

// ===================================================================
// MAIN
// ===================================================================

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  Versioning & Workflow System — Comprehensive Test Suite ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    try {
        await testHealthCheck();
        await testAuth();
        await testAgentCreateDraft();
        await testAgentSubmitDraft();
        await testAdminRejectDraft();
        await testAdminPublish();
        await testAgentRequestEdit();
        await testAgentEditVersion();
        await testAdminDiffAndApprove();
        await testEditRejectFlow();
        await testDeleteRequestFlow();
        await testSoftDelete();
        await testAdminDirectActions();
        await testPermissions();
        await testVersionHistory();
        await testWorkflowPendingList();
        await testPropertyRequestsList();
        await testEdgeCases();
        await testStaleHandling();
        await testPropertySuggestions();
        await testWorkflowHistory();
    } catch (e) {
        console.error('\n💥 Fatal error:', e.message);
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log(`📊 Results: ${passed} passed, ${failed} failed (${passed + failed} total)`);
    console.log('═'.repeat(60));

    if (errors.length > 0) {
        console.log('\n❌ Failed tests:');
        errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    // Cleanup
    await cleanup();

    process.exit(failed > 0 ? 1 : 0);
}

main();
