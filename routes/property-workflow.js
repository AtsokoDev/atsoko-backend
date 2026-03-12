const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createSnapshot } = require('../utils/propertyDiff');

// =====================================================
// Property Workflow API
// For admin to manage property approval workflow
// Updated: 2-layer status model (publication_status + moderation_status)
// =====================================================

/**
 * GET /api/property-workflow/pending
 * Get all properties pending review (Admin only)
 * Filters by moderation_status
 */
router.get('/pending', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { page = 1, limit = 20, moderation_status: filterModStatus } = req.query;
        const offset = (page - 1) * limit;

        // Properties needing admin attention: any non-'none' moderation_status
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
                p.publication_status,
                p.moderation_status,
                p.created_at,
                p.updated_at
            FROM properties p
            WHERE COALESCE(p.moderation_status, 'none') != 'none'
            AND p.publication_status != 'deleted'
        `;

        let countQuery = `
            SELECT COUNT(*) FROM properties p
            WHERE COALESCE(p.moderation_status, 'none') != 'none'
            AND p.publication_status != 'deleted'
        `;

        const params = [];
        const countParams = [];
        let paramCount = 1;

        // Filter by moderation_status
        if (filterModStatus) {
            query += ` AND COALESCE(p.moderation_status, 'none') = $${paramCount}`;
            countQuery += ` AND COALESCE(p.moderation_status, 'none') = $${paramCount}`;
            params.push(filterModStatus);
            countParams.push(filterModStatus);
            paramCount++;
        }

        query += ` ORDER BY p.created_at ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), offset);

        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const total = parseInt(countResult.rows[0].count);

        // Count by moderation_status for summary
        const summaryResult = await pool.query(`
            SELECT COALESCE(moderation_status, 'none') as moderation_status, COUNT(*) as count
            FROM properties
            WHERE COALESCE(moderation_status, 'none') != 'none'
            AND publication_status != 'deleted'
            GROUP BY COALESCE(moderation_status, 'none')
        `);

        const summary = {};
        summaryResult.rows.forEach(row => {
            summary[row.moderation_status] = parseInt(row.count);
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
 * Admin sets moderation_status directly.
 * body: { moderation_status: string, note?: string }
 */
router.put('/:id/status', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { moderation_status: newModStatus, note } = req.body;

        const validModStatuses = ['none', 'pending_add', 'pending_edit', 'pending_delete', 'rejected_add', 'rejected_edit', 'rejected_delete'];
        if (!newModStatus || !validModStatuses.includes(newModStatus)) {
            return res.status(400).json({
                success: false,
                error: `moderation_status is required and must be one of: ${validModStatuses.join(', ')}`
            });
        }

        await client.query('BEGIN');
        const propertyResult = await client.query(
            `SELECT id, property_id, publication_status, moderation_status FROM properties WHERE id = $1`, [id]
        );
        if (propertyResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Property not found' });
        }
        const property = propertyResult.rows[0];
        const prevMod = property.moderation_status || 'none';

        await client.query(
            `UPDATE properties SET moderation_status = $1, updated_at = NOW() WHERE id = $2`,
            [newModStatus, id]
        );
        await client.query(
            `INSERT INTO workflow_history (property_id, previous_workflow_status, new_workflow_status, changed_by, reason)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, prevMod, newModStatus, req.user.id, note]
        );
        if (['rejected_add', 'rejected_edit'].includes(newModStatus) && note) {
            await client.query(
                `INSERT INTO property_notes (property_id, author_id, note_type, content) VALUES ($1, $2, 'fix_request', $3)`,
                [id, req.user.id, note]
            );
        }
        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Moderation status updated to ${newModStatus}`,
            data: { property_id: property.property_id, previous_moderation_status: prevMod, new_moderation_status: newModStatus }
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
 * Updated: also sets publication_status = 'published'
 */
router.put('/:id/publish', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { note } = req.body;

        await client.query('BEGIN');

        // Get current property
        const propertyResult = await client.query(
            `SELECT id, property_id,
                    publication_status, moderation_status
             FROM properties WHERE id = $1`,
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
        const pubStatus = property.publication_status;

        // Check if already published
        if (pubStatus === 'published') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Property is already published'
            });
        }

        // Admin can publish any non-published, non-deleted property
        if (pubStatus === 'deleted') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Cannot publish a deleted property. Restore it first.'
            });
        }

        // Publish the property — new model is source of truth
        await client.query(
            `UPDATE properties 
             SET publication_status = 'published', moderation_status = 'none',
                 updated_at = NOW()
             WHERE id = $1`,
            [id]
        );

        // Mark any pending versions for this property as archived/approved
        await client.query(
            `UPDATE property_versions 
             SET status = 'approved', is_live = true, updated_at = NOW()
             WHERE property_id = $1 AND status = 'pending'`,
            [id]
        );

        // Archive previous live versions
        await client.query(
            `UPDATE property_versions 
             SET is_live = false, updated_at = NOW()
             WHERE property_id = $1 AND is_live = true 
               AND id != (SELECT id FROM property_versions WHERE property_id = $1 AND status = 'approved' ORDER BY version_number DESC LIMIT 1)`,
            [id]
        );

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, 
              previous_approval_status, new_approval_status, changed_by, reason)
             VALUES ($1, $2, $2, $3, 'published', $4, $5)`,
            [id, property.moderation_status || 'none', pubStatus, req.user.id, note || 'Property published']
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
                publication_status: 'published',
                moderation_status: 'none'
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
 * Updated: sets publication_status = 'unpublished'
 */
router.put('/:id/unpublish', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { note } = req.body;

        await client.query('BEGIN');

        // Get current property
        const propertyResult = await client.query(
            `SELECT id, property_id,
                    publication_status, moderation_status
             FROM properties WHERE id = $1`,
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
        const pubStatus = property.publication_status;

        if (pubStatus !== 'published') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Property is not currently published'
            });
        }

        // Unpublish the property — new model is source of truth
        await client.query(
            `UPDATE properties 
             SET publication_status = 'unpublished', moderation_status = 'none',
                 updated_at = NOW()
             WHERE id = $1`,
            [id]
        );

        // Discard any pending versions since property is unpublished
        // (agent can now edit directly)
        await client.query(
            `UPDATE property_versions 
             SET status = 'discarded', admin_note = 'Property unpublished — pending versions discarded', updated_at = NOW()
             WHERE property_id = $1 AND status IN ('draft', 'pending')`,
            [id]
        );

        // Discard any pending requests
        await client.query(
            `UPDATE property_requests 
             SET status = 'rejected', admin_response = 'Property unpublished — request no longer applicable',
                 processed_by = $1, processed_at = NOW(), updated_at = NOW()
             WHERE property_id = $2 AND status = 'pending'`,
            [req.user.id, id]
        );

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, 
              previous_approval_status, new_approval_status, changed_by, reason)
             VALUES ($1, $2, 'none', 'published', 'pending', $3, $4)`,
            [id, property.moderation_status || 'none', req.user.id, note || 'Property unpublished']
        );

        // Add note with unpublish reason
        if (note) {
            await client.query(
                `INSERT INTO property_notes 
                 (property_id, author_id, note_type, content)
                 VALUES ($1, $2, 'general', $3)`,
                [id, req.user.id, note]
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Property unpublished successfully',
            data: {
                property_id: property.property_id,
                publication_status: 'unpublished',
                moderation_status: 'none'
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
 * PUT /api/property-workflow/:id/submit
 * Agent submits a draft property for admin review
 * Changes: publication_status stays 'draft', moderation_status → 'pending_add'
 */
router.put('/:id/submit', authenticate, authorize(['agent', 'admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { note } = req.body;

        console.log(`[SUBMIT] ========================================`);
        console.log(`[SUBMIT] User: ${req.user.id} (${req.user.role}) - Team: ${req.user.team}`);
        console.log(`[SUBMIT] Property ID: ${id}`);
        console.log(`[SUBMIT] Timestamp: ${new Date().toISOString()}`);
        console.log(`[SUBMIT] ========================================`);

        await client.query('BEGIN');

        // Get current property
        const propertyResult = await client.query(
            `SELECT id, property_id, agent_team, publication_status, moderation_status
             FROM properties WHERE id = $1`,
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
        const pubStatus = property.publication_status;
        const modStatus = property.moderation_status || 'none';

        // Agent can only submit their team's properties
        if (req.user.role === 'agent' && property.agent_team !== req.user.team) {
            await client.query('ROLLBACK');
            return res.status(403).json({
                success: false,
                error: 'Access denied. This property belongs to another team.'
            });
        }

        // Only draft or unpublished properties with none/rejected moderation can be submitted
        if (pubStatus === 'published') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Published properties cannot be submitted. Use the edit request flow instead.'
            });
        }

        if (pubStatus === 'deleted') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Deleted properties cannot be submitted.'
            });
        }

        // Check moderation status - only none or rejected_add can be submitted
        if (!['none', 'rejected_add'].includes(modStatus)) {
            await client.query('ROLLBACK');
            console.log(`[SUBMIT] ❌ REJECTED - Property already in moderation: ${modStatus}`);
            return res.status(400).json({
                success: false,
                error: `Cannot submit. Property moderation status is '${modStatus}'. Only properties with 'none' or 'rejected_add' moderation can be submitted.`,
                current_status: modStatus,
                already_submitted: modStatus === 'pending_add'
            });
        }

        // Update property: moderation_status → pending_add (source of truth)
        await client.query(
            `UPDATE properties 
             SET moderation_status = 'pending_add',
                 updated_at = NOW()
             WHERE id = $1`,
            [id]
        );

        console.log(`[SUBMIT] ✅ Updated property ${property.property_id} (id: ${id}) - moderation_status: ${modStatus} → pending_add`);

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, changed_by, reason)
             VALUES ($1, $2, 'pending_add', $3, $4)`,
            [id, property.moderation_status || 'none', req.user.id, note || 'Agent submitted property for review']
        );

        // Add a note if provided
        if (note) {
            await client.query(
                `INSERT INTO property_notes 
                 (property_id, author_id, note_type, content)
                 VALUES ($1, $2, 'general', $3)`,
                [id, req.user.id, note]
            );
        }

        // Create version snapshot for diff comparison on next review
        const fullPropertyResult = await client.query(
            'SELECT * FROM properties WHERE id = $1', [id]
        );
        if (fullPropertyResult.rows.length > 0) {
            const versionResult = await client.query(
                `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
                 FROM property_versions WHERE property_id = $1`, [id]
            );
            const nextVersion = versionResult.rows[0].next_version;
            const versionData = createSnapshot(fullPropertyResult.rows[0]);

            await client.query(
                `INSERT INTO property_versions
                 (property_id, version_number, version_data, status, created_by, created_by_role, reason)
                 VALUES ($1, $2, $3, 'pending', $4, $5, $6)`,
                [id, nextVersion, JSON.stringify(versionData), req.user.id, req.user.role,
                 note || 'Submitted for review']
            );

            console.log(`[SUBMIT] ✅ Created version snapshot v${nextVersion} for property ${property.property_id}`);
            console.log(`[SUBMIT] 📸 Snapshot includes ${versionData.images?.length || 0} images`);
        }

        await client.query('COMMIT');
        console.log(`[SUBMIT] ✅ Transaction committed successfully - NO NEW PROPERTY CREATED`);

        res.json({
            success: true,
            message: 'Property submitted for review successfully',
            data: {
                property_id: property.property_id,
                publication_status: pubStatus,
                moderation_status: 'pending_add'
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-workflow/:id/submit] Error:', error);
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
