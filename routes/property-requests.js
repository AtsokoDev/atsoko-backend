const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// =====================================================
// Property Requests API
// For edit/delete requests from agents to admins
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
                pr.requested_changes,
                pr.admin_response,
                pr.created_at,
                pr.updated_at,
                pr.processed_at,
                p.property_id as property_code,
                p.title as property_title,
                p.agent_team,
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

        // Filter by request type
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
 * Create a new edit or delete request (Agent only)
 */
router.post('/', authenticate, authorize(['agent']), async (req, res) => {
    try {
        const { property_id, request_type, reason, requested_changes } = req.body;

        // Validate required fields
        if (!property_id || !request_type) {
            return res.status(400).json({
                success: false,
                error: 'property_id and request_type are required'
            });
        }

        if (!['edit', 'delete'].includes(request_type)) {
            return res.status(400).json({
                success: false,
                error: 'request_type must be "edit" or "delete"'
            });
        }

        // For edit requests, requested_changes is required
        if (request_type === 'edit' && !requested_changes) {
            return res.status(400).json({
                success: false,
                error: 'requested_changes is required for edit requests'
            });
        }

        // Check if property exists and agent has access
        const propertyResult = await pool.query(
            'SELECT id, property_id, agent_team, approve_status, workflow_status FROM properties WHERE id = $1',
            [property_id]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];

        // Agent can only request for their team's properties
        if (property.agent_team !== req.user.team) {
            return res.status(403).json({
                success: false,
                error: 'You can only create requests for your team\'s properties'
            });
        }

        // Only allow requests for published properties
        // (Unpublished properties can be edited/deleted directly)
        if (property.approve_status !== 'published') {
            return res.status(400).json({
                success: false,
                error: 'You can edit/delete unpublished properties directly. Requests are only needed for published properties.'
            });
        }

        // Check if there's already a pending request of the same type
        const existingRequest = await pool.query(
            'SELECT id FROM property_requests WHERE property_id = $1 AND request_type = $2 AND status = $3',
            [property_id, request_type, 'pending']
        );

        if (existingRequest.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: `There is already a pending ${request_type} request for this property`
            });
        }

        // Create the request
        const result = await pool.query(
            `INSERT INTO property_requests 
            (property_id, request_type, status, requested_by, reason, requested_changes)
            VALUES ($1, $2, 'pending', $3, $4, $5)
            RETURNING *`,
            [property_id, request_type, req.user.id, reason, requested_changes ? JSON.stringify(requested_changes) : null]
        );

        // Create a note for this request
        if (reason) {
            await pool.query(
                `INSERT INTO property_notes 
                (property_id, request_id, author_id, note_type, content)
                VALUES ($1, $2, $3, $4, $5)`,
                [property_id, result.rows[0].id, req.user.id,
                    request_type === 'edit' ? 'fix_request' : 'general',
                    reason]
            );
        }

        res.status(201).json({
            success: true,
            message: `${request_type} request created successfully`,
            data: result.rows[0]
        });
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

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action must be "approve" or "reject"'
            });
        }

        await client.query('BEGIN');

        // Get the request
        const requestResult = await client.query(
            `SELECT pr.*, p.approve_status, p.workflow_status, p.agent_team
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

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

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
                // Soft delete: set approve_status to 'deleted' instead of actually deleting
                await client.query(
                    `UPDATE properties SET approve_status = 'deleted', updated_at = NOW() WHERE id = $1`,
                    [request.property_id]
                );

                // Record in workflow history
                await client.query(
                    `INSERT INTO workflow_history 
                     (property_id, previous_approval_status, new_approval_status, changed_by, reason)
                     VALUES ($1, $2, 'deleted', $3, $4)`,
                    [request.property_id, request.approve_status, req.user.id,
                    `Delete request approved. Reason: ${admin_response || 'N/A'}`]
                );
            } else if (request.request_type === 'edit') {
                // Apply the requested changes
                const changes = request.requested_changes;
                if (changes && typeof changes === 'object') {
                    const setClauses = [];
                    const params = [];
                    let idx = 1;

                    // Allowed fields for edit requests
                    const allowedFields = [
                        'title', 'type', 'status', 'labels', 'province', 'district', 'sub_district',
                        'location', 'price', 'price_postfix', 'price_alternative', 'size', 'size_prefix',
                        'terms_conditions', 'warehouse_length', 'electricity_system', 'clear_height',
                        'features', 'floor_load', 'land_size', 'land_postfix', 'remarks', 'images'
                    ];

                    Object.entries(changes).forEach(([field, value]) => {
                        if (allowedFields.includes(field)) {
                            setClauses.push(`${field} = $${idx}`);
                            params.push(value);
                            idx++;
                        }
                    });

                    if (setClauses.length > 0) {
                        setClauses.push(`updated_at = NOW()`);
                        params.push(request.property_id);

                        await client.query(
                            `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $${idx}`,
                            params
                        );
                    }
                }

                // Record in workflow history
                await client.query(
                    `INSERT INTO workflow_history 
                     (property_id, changed_by, reason)
                     VALUES ($1, $2, $3)`,
                    [request.property_id, req.user.id,
                    `Edit request approved. Changes applied. Reason: ${admin_response || 'N/A'}`]
                );
            }
        }

        // Add admin note
        if (admin_response) {
            await client.query(
                `INSERT INTO property_notes 
                 (property_id, request_id, author_id, note_type, content)
                 VALUES ($1, $2, $3, $4, $5)`,
                [request.property_id, id, req.user.id,
                action === 'approve' ? 'approval' : 'rejection',
                    admin_response]
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
                p.approve_status as property_approve_status,
                p.workflow_status as property_workflow_status,
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
