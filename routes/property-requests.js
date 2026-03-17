const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// =====================================================
// Property Requests API
// For delete requests from agents to admins.
// =====================================================

/**
 * GET /api/property-requests
 * Get all property requests (Admin sees all, Agent sees their team's)
 */
router.get('/', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { status, request_type, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                pr.id,
                pr.property_id,
                pr.request_type,
                pr.status,
                pr.reason,
                pr.admin_response,
                pr.stale_since,
                pr.created_at,
                pr.updated_at,
                pr.processed_at,
                p.property_id as property_code,
                p.title as property_title,
                p.agent_team,
                p.publication_status as property_publication_status,
                p.moderation_status as property_moderation_status,
                u.name as requested_by_name,
                u.email as requested_by_email,
                admin_user.name as processed_by_name
            FROM property_requests pr
            JOIN properties p ON pr.property_id = p.id
            JOIN users u ON pr.requested_by = u.id
            LEFT JOIN users admin_user ON pr.processed_by = admin_user.id
            WHERE 1=1
        `;
        let countQuery = `
            SELECT COUNT(*) FROM property_requests pr
            JOIN properties p ON pr.property_id = p.id
            WHERE 1=1
        `;

        const params = [];
        const countParams = [];
        let paramCount = 1;

        // Agent can only see their team's requests
        if (req.user.role === 'agent') {
            query += ` AND p.agent_team = $${paramCount}`;
            countQuery += ` AND p.agent_team = $${paramCount}`;
            params.push(req.user.team);
            countParams.push(req.user.team);
            paramCount++;
        }

        // Filter by status
        if (status) {
            query += ` AND pr.status = $${paramCount}`;
            countQuery += ` AND pr.status = $${paramCount}`;
            params.push(status);
            countParams.push(status);
            paramCount++;
        }

        // Filter by request type (though edit requests are deprecated)
        if (request_type) {
            query += ` AND pr.request_type = $${paramCount}`;
            countQuery += ` AND pr.request_type = $${paramCount}`;
            params.push(request_type);
            countParams.push(request_type);
            paramCount++;
        }

        query += ` ORDER BY pr.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), offset);

        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[GET /property-requests] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * POST /api/property-requests
 * Create a new delete request (Agent only)
 */
router.post('/', authenticate, authorize(['agent']), async (req, res) => {
    try {
        const { property_id, request_type, reason } = req.body;

        // Validate required fields
        if (!property_id || !request_type) {
            return res.status(400).json({
                success: false,
                error: 'property_id and request_type are required'
            });
        }

        if (request_type !== 'delete') {
            return res.status(400).json({
                success: false,
                error: 'request_type must be "delete"'
            });
        }

        const client = await pool.connect();

        try {
        // Check if property exists and agent has access
        const propertyResult = await client.query(
            `SELECT id, property_id, agent_team,
                    publication_status, moderation_status
             FROM properties WHERE id = $1`,
            [property_id]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];
        const pubStatus = property.publication_status || 'draft';
        const modStatus = property.moderation_status || 'none';

        // Agent can only request for their team's properties
        if (property.agent_team !== req.user.team) {
            return res.status(403).json({
                success: false,
                error: 'You can only create requests for your team\'s properties'
            });
        }

        // Only allow requests for published properties
        // (Draft/unpublished properties can be edited/deleted directly)
        if (pubStatus !== 'published') {
            return res.status(400).json({
                success: false,
                error: 'You can edit/delete non-published properties directly. Requests are only needed for published properties.'
            });
        }

        // Check if there's any pending moderation already
        // Allow 'rejected_delete' to enable agents to resend after rejection
        if (modStatus !== 'none' && modStatus !== 'rejected_delete') {
            return res.status(400).json({
                success: false,
                error: `This property already has a pending moderation (${modStatus}). Wait for it to be processed first.`
            });
        }

        // Check if there's already a pending request of the same type
        const existingRequest = await client.query(
            'SELECT id, request_type FROM property_requests WHERE property_id = $1 AND status = $2',
            [property_id, 'pending']
        );

        if (existingRequest.rows.length > 0) {
            const existing = existingRequest.rows[0];
            return res.status(400).json({
                success: false,
                error: `There is already a pending ${existing.request_type} request for this property`
            });
        }

        await client.query('BEGIN');

        // Archive old rejected request as 'superseded' if creating new delete request
        if (request_type === 'delete' && modStatus === 'rejected_delete') {
            await client.query(
                `UPDATE property_requests 
                 SET status = 'superseded', updated_at = NOW()
                 WHERE property_id = $1 AND request_type = 'delete' AND status = 'rejected'`,
                [property_id]
            );
        }

        // Create a snapshot of live data at request time
        const snapshotResult = await client.query(
            `SELECT type, status, labels, province, district, sub_district,
                    location, price, price_postfix, price_alternative, size, size_prefix,
                    terms_conditions, warehouse_length, electricity_system, clear_height,
                    features, floor_load, land_size, land_postfix, remarks, images
             FROM properties WHERE id = $1`,
            [property_id]
        );
        const liveSnapshot = snapshotResult.rows[0] || null;

        // Create the request with live snapshot
        const result = await client.query(
            `INSERT INTO property_requests 
            (property_id, request_type, status, requested_by, reason, live_snapshot_at_request)
            VALUES ($1, $2, 'pending', $3, $4, $5)
            RETURNING *`,
            [property_id, request_type, req.user.id, reason,
             liveSnapshot ? JSON.stringify(liveSnapshot) : null]
        );

        // Update property moderation_status
        const newModStatus = 'pending_delete';
        await client.query(
            `UPDATE properties 
             SET moderation_status = $1, updated_at = NOW()
             WHERE id = $2`,
            [newModStatus, property_id]
        );

        // Create a note for this request
        if (reason) {
            await client.query(
                `INSERT INTO property_notes 
                (property_id, request_id, author_id, note_type, content)
                VALUES ($1, $2, $3, $4, $5)`,
                [property_id, result.rows[0].id, req.user.id,
                    'general',
                    reason]
            );
        }

        // Record in workflow history (use new model fields)
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_publication_status, new_publication_status, changed_by, reason)
             VALUES ($1, $2, $2, $3, $4)`,
            [property_id, property.publication_status || 'draft', req.user.id,
             `Agent created ${request_type} request. Reason: ${reason || 'N/A'}`]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: `${request_type} request created successfully`,
            data: result.rows[0]
        });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[POST /property-requests] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * PUT /api/property-requests/:id/process
 * Process a request - approve or reject (Admin only)
 */
router.put('/:id/process', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { action, admin_response } = req.body;

        if (!['approve', 'reject', 'approve_unpublish'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action must be "approve", "approve_unpublish", or "reject"'
            });
        }

        await client.query('BEGIN');

        // Get the request
        const requestResult = await client.query(
            `SELECT pr.*, p.publication_status, p.moderation_status, p.agent_team
             FROM property_requests pr
             JOIN properties p ON pr.property_id = p.id
             WHERE pr.id = $1`,
            [id]
        );

        if (requestResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }

        const request = requestResult.rows[0];

        if (request.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'This request has already been processed'
            });
        }

        const newStatus = (action === 'approve' || action === 'approve_unpublish') ? 'approved' : 'rejected';

        // Update the request
        await client.query(
            `UPDATE property_requests 
             SET status = $1, admin_response = $2, processed_by = $3, processed_at = NOW(), updated_at = NOW()
             WHERE id = $4`,
            [newStatus, admin_response, req.user.id, id]
        );

        // If approved, perform the action
        if (action === 'approve') {
            if (request.request_type === 'delete') {
                // Soft delete: set publication_status to 'deleted'
                await client.query(
                    `UPDATE properties 
                     SET publication_status = 'deleted', moderation_status = 'none',
                         deleted_at = NOW(), deleted_by = $2,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [request.property_id, req.user.id]
                );

                // Discard any pending versions
                await client.query(
                    `UPDATE property_versions 
                     SET status = 'discarded', admin_note = 'Property deleted via approved request', updated_at = NOW()
                     WHERE property_id = $1 AND status IN ('draft', 'pending')`,
                    [request.property_id]
                );

                // Record in workflow history
                await client.query(
                    `INSERT INTO workflow_history 
                     (property_id, previous_publication_status, new_publication_status, changed_by, reason)
                     VALUES ($1, $2, 'deleted', $3, $4)`,
                    [request.property_id, request.publication_status || 'published', req.user.id,
                    `Delete request approved. Reason: ${admin_response || 'N/A'}`]
                );
            }
        }

        // approve_unpublish: mark request approved but unpublish the listing instead of deleting
        if (action === 'approve_unpublish') {
            // Set property to unpublished — data preserved, admin can restore later
            await client.query(
                `UPDATE properties 
                 SET publication_status = 'unpublished', moderation_status = 'none',
                     updated_at = NOW()
                 WHERE id = $1`,
                [request.property_id]
            );

            // Discard any pending versions since property is unpublished
            await client.query(
                `UPDATE property_versions 
                 SET status = 'discarded', admin_note = 'Property unpublished via approved request', updated_at = NOW()
                 WHERE property_id = $1 AND status IN ('draft', 'pending')`,
                [request.property_id]
            );

            // Record in workflow history
            await client.query(
                `INSERT INTO workflow_history 
                 (property_id, previous_publication_status, new_publication_status, changed_by, reason)
                 VALUES ($1, $2, 'pending', $3, $4)`,
                [request.property_id, request.publication_status || 'published', req.user.id,
                `Delete request approved as unpublish. Reason: ${admin_response || 'N/A'}`]
            );
        }

        // Add admin note
        if (admin_response) {
            await client.query(
                `INSERT INTO property_notes 
                 (property_id, request_id, author_id, note_type, content)
                 VALUES ($1, $2, $3, $4, $5)`,
                [request.property_id, id, req.user.id,
                action === 'reject' ? 'rejection' : 'approval',
                    admin_response]
            );
        }

        // If rejected, update moderation_status to rejected_* so agent can revise
        if (action === 'reject') {
            const rejectedModStatus = 'rejected_delete';
            await client.query(
                `UPDATE properties SET moderation_status = $1, updated_at = NOW() WHERE id = $2`,
                [rejectedModStatus, request.property_id]
            );

            // Record in workflow history
            await client.query(
                `INSERT INTO workflow_history 
                 (property_id, changed_by, reason)
                 VALUES ($1, $2, $3)`,
                [request.property_id, req.user.id,
                `${request.request_type} request rejected. Reason: ${admin_response || 'N/A'}`]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Request ${action}d successfully`,
            data: {
                request_id: id,
                action,
                admin_response
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-requests/:id/process] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/property-requests/:id
 * Get a single request detail
 */
router.get('/:id', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { id } = req.params;

        let query = `
            SELECT 
                pr.*,
                p.property_id as property_code,
                p.title as property_title,
                p.agent_team,
                p.publication_status as property_publication_status,
                p.moderation_status as property_moderation_status,
                u.name as requested_by_name,
                u.email as requested_by_email,
                admin_user.name as processed_by_name
            FROM property_requests pr
            JOIN properties p ON pr.property_id = p.id
            JOIN users u ON pr.requested_by = u.id
            LEFT JOIN users admin_user ON pr.processed_by = admin_user.id
            WHERE pr.id = $1
        `;
        const params = [id];

        // Agent can only see their team's requests
        if (req.user.role === 'agent') {
            query += ` AND p.agent_team = $2`;
            params.push(req.user.team);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }

        // Get related notes
        const notesResult = await pool.query(
            `SELECT pn.*, u.name as author_name, u.role as author_role
             FROM property_notes pn
             JOIN users u ON pn.author_id = u.id
             WHERE pn.request_id = $1
             ORDER BY pn.created_at ASC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                ...result.rows[0],
                notes: notesResult.rows
            }
        });
    } catch (error) {
        console.error('[GET /property-requests/:id] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
