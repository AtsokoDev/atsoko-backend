const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// =====================================================
// Property Workflow API
// For admin to manage property approval workflow
// =====================================================

/**
 * GET /api/property-workflow/pending
 * Get all properties pending review (Admin only)
 */
router.get('/pending', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 20, workflow_status } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                p.id,
                p.property_id,
                p.title,
                p.type,
                p.status,
                p.province,
                p.district,
                p.price,
                p.size,
                p.agent_team,
                p.approve_status,
                p.workflow_status,
                p.created_at,
                p.updated_at
            FROM properties p
            WHERE p.approve_status = 'pending'
        `;

        let countQuery = `
            SELECT COUNT(*) FROM properties p
            WHERE p.approve_status = 'pending'
        `;

        const params = [];
        const countParams = [];
        let paramCount = 1;

        // Filter by workflow_status
        if (workflow_status) {
            query += ` AND p.workflow_status = $${paramCount}`;
            countQuery += ` AND p.workflow_status = $${paramCount}`;
            params.push(workflow_status);
            countParams.push(workflow_status);
            paramCount++;
        }

        query += ` ORDER BY p.created_at ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), offset);

        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const total = parseInt(countResult.rows[0].count);

        // Count by workflow_status for summary
        const summaryResult = await pool.query(`
            SELECT workflow_status, COUNT(*) as count
            FROM properties
            WHERE approve_status = 'pending'
            GROUP BY workflow_status
        `);

        const summary = {};
        summaryResult.rows.forEach(row => {
            summary[row.workflow_status || 'null'] = parseInt(row.count);
        });

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            summary
        });
    } catch (error) {
        console.error('[GET /property-workflow/pending] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * PUT /api/property-workflow/:id/status
 * Update workflow status (Admin only)
 */
router.put('/:id/status', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { workflow_status, note } = req.body;

        // Validate workflow_status
        const validStatuses = ['pending', 'wait_to_fix', 'fixed', 'ready_to_publish'];
        if (!validStatuses.includes(workflow_status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid workflow_status. Must be one of: ' + validStatuses.join(', ')
            });
        }

        await client.query('BEGIN');

        // Get current property
        const propertyResult = await client.query(
            'SELECT id, property_id, workflow_status, approve_status FROM properties WHERE id = $1',
            [id]
        );

        if (propertyResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];

        // Update workflow status
        await client.query(
            'UPDATE properties SET workflow_status = $1, updated_at = NOW() WHERE id = $2',
            [workflow_status, id]
        );

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, changed_by, reason)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, property.workflow_status, workflow_status, req.user.id, note]
        );

        // If admin sets to wait_to_fix, add a note with the reason
        if (workflow_status === 'wait_to_fix' && note) {
            await client.query(
                `INSERT INTO property_notes 
                 (property_id, author_id, note_type, content)
                 VALUES ($1, $2, 'fix_request', $3)`,
                [id, req.user.id, note]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Workflow status updated to ${workflow_status}`,
            data: {
                property_id: property.property_id,
                previous_status: property.workflow_status,
                new_status: workflow_status
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-workflow/:id/status] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/property-workflow/:id/publish
 * Publish a property (Admin only)
 * Only allowed when workflow_status = 'ready_to_publish'
 */
router.put('/:id/publish', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { note } = req.body;

        await client.query('BEGIN');

        // Get current property
        const propertyResult = await client.query(
            'SELECT id, property_id, workflow_status, approve_status FROM properties WHERE id = $1',
            [id]
        );

        if (propertyResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];

        // Check if ready to publish
        if (property.workflow_status !== 'ready_to_publish') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Cannot publish. Property workflow_status must be 'ready_to_publish', but is '${property.workflow_status}'`
            });
        }

        // Publish the property
        await client.query(
            `UPDATE properties 
             SET approve_status = 'published', updated_at = NOW()
             WHERE id = $1`,
            [id]
        );

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, 
              previous_approval_status, new_approval_status, changed_by, reason)
             VALUES ($1, $2, $2, $3, 'published', $4, $5)`,
            [id, property.workflow_status, property.approve_status, req.user.id, note || 'Property published']
        );

        // Add publish note
        await client.query(
            `INSERT INTO property_notes 
             (property_id, author_id, note_type, content)
             VALUES ($1, $2, 'approval', $3)`,
            [id, req.user.id, note || 'Property approved and published']
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Property published successfully',
            data: {
                property_id: property.property_id,
                approve_status: 'published'
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-workflow/:id/publish] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/property-workflow/:id/unpublish
 * Unpublish a property (Admin only)
 */
router.put('/:id/unpublish', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { note, workflow_status = 'pending' } = req.body;

        // Validate workflow_status
        const validStatuses = ['pending', 'wait_to_fix'];
        if (!validStatuses.includes(workflow_status)) {
            return res.status(400).json({
                success: false,
                error: 'When unpublishing, workflow_status must be either "pending" or "wait_to_fix"'
            });
        }

        await client.query('BEGIN');

        // Get current property
        const propertyResult = await client.query(
            'SELECT id, property_id, workflow_status, approve_status FROM properties WHERE id = $1',
            [id]
        );

        if (propertyResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];

        if (property.approve_status !== 'published') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Property is not currently published'
            });
        }

        // Unpublish the property
        await client.query(
            `UPDATE properties 
             SET approve_status = 'pending', workflow_status = $1, updated_at = NOW()
             WHERE id = $2`,
            [workflow_status, id]
        );

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, 
              previous_approval_status, new_approval_status, changed_by, reason)
             VALUES ($1, $2, $3, 'published', 'pending', $4, $5)`,
            [id, property.workflow_status, workflow_status, req.user.id, note || 'Property unpublished']
        );

        // Add note if workflow_status is wait_to_fix
        if (workflow_status === 'wait_to_fix' && note) {
            await client.query(
                `INSERT INTO property_notes 
                 (property_id, author_id, note_type, content)
                 VALUES ($1, $2, 'fix_request', $3)`,
                [id, req.user.id, note]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Property unpublished successfully',
            data: {
                property_id: property.property_id,
                approve_status: 'pending',
                workflow_status: workflow_status
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-workflow/:id/unpublish] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/property-workflow/:id/history
 * Get workflow history for a property
 */
router.get('/:id/history', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if property exists and user has access
        const propertyResult = await pool.query(
            'SELECT id, agent_team FROM properties WHERE id = $1',
            [id]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];

        // Agent can only see their team's properties
        if (req.user.role === 'agent' && property.agent_team !== req.user.team) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This property belongs to another team.'
            });
        }

        const result = await pool.query(
            `SELECT 
                wh.*,
                u.name as changed_by_name,
                u.role as changed_by_role
             FROM workflow_history wh
             JOIN users u ON wh.changed_by = u.id
             WHERE wh.property_id = $1
             ORDER BY wh.created_at DESC`,
            [id]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('[GET /property-workflow/:id/history] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
