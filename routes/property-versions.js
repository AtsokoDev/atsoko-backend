const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { computeDiff, createSnapshot, buildApplyVersionQuery } = require('../utils/propertyDiff');
const { generateTitles } = require('../services/titleGenerator');
const { broadcastEvent } = require('../services/sse');

// =====================================================
// Property Versions API
// Versioning system for property edit workflow
// =====================================================

/**
 * GET /api/property-versions/:propertyId
 * Get version history for a property
 */
router.get('/:propertyId', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { status: versionStatus, limit = 50 } = req.query;

        // Check property exists and user has access
        const propertyResult = await pool.query(
            'SELECT id, property_id, agent_team, publication_status, moderation_status FROM properties WHERE id = $1',
            [propertyId]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const property = propertyResult.rows[0];

        // Agent can only see their team's properties
        if (req.user.role === 'agent' && property.agent_team !== req.user.team) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        let query = `
            SELECT 
                pv.*,
                u.name as created_by_name,
                u.email as created_by_email,
                u.role as creator_role
            FROM property_versions pv
            JOIN users u ON pv.created_by = u.id
            WHERE pv.property_id = $1
        `;
        const params = [propertyId];
        let paramCount = 2;

        if (versionStatus) {
            query += ` AND pv.status = $${paramCount}`;
            params.push(versionStatus);
            paramCount++;
        }

        query += ` ORDER BY pv.version_number DESC LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            property: {
                id: property.id,
                property_id: property.property_id,
                publication_status: property.publication_status,
                moderation_status: property.moderation_status || 'none'
            }
        });
    } catch (error) {
        console.error('[GET /property-versions/:propertyId] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/property-versions/:propertyId/latest
 * Get the latest pending version for a property
 */
router.get('/:propertyId/latest', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { propertyId } = req.params;

        // Check property exists and user has access
        const propertyResult = await pool.query(
            'SELECT id, property_id, agent_team, publication_status, moderation_status FROM properties WHERE id = $1',
            [propertyId]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const property = propertyResult.rows[0];

        if (req.user.role === 'agent' && property.agent_team !== req.user.team) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const result = await pool.query(
            `SELECT pv.*, u.name as created_by_name
             FROM property_versions pv
             JOIN users u ON pv.created_by = u.id
             WHERE pv.property_id = $1 AND pv.status IN ('pending', 'draft', 'rejected')
             ORDER BY pv.version_number DESC
             LIMIT 1`,
            [propertyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'No pending version found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[GET /property-versions/:propertyId/latest] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * POST /api/property-versions/:propertyId/request-edit
 * Agent creates a new pending version from live data to edit
 */
router.post('/:propertyId/request-edit', authenticate, authorize(['agent']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { propertyId } = req.params;
        const { reason } = req.body;

        await client.query('BEGIN');

        // Get current property
        const propertyResult = await client.query(
            'SELECT * FROM properties WHERE id = $1',
            [propertyId]
        );

        if (propertyResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const property = propertyResult.rows[0];
        const pubStatus = property.publication_status;
        const modStatus = property.moderation_status || 'none';

        // Must be own team
        if (property.agent_team !== req.user.team) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Must be published
        if (pubStatus !== 'published') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Only published properties need edit requests. Draft/Unpublished can be edited directly.'
            });
        }

        // Cannot have existing pending edit
        if (['pending_edit', 'pending_delete'].includes(modStatus)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Cannot create edit request. Property already has ${modStatus} status.`
            });
        }

        // Get next version number
        const maxVersionResult = await client.query(
            'SELECT COALESCE(MAX(version_number), 0) as max_ver FROM property_versions WHERE property_id = $1',
            [propertyId]
        );
        const nextVersion = maxVersionResult.rows[0].max_ver + 1;

        // Create snapshot of current live data
        const snapshot = createSnapshot(property);

        // Create pending version
        const versionResult = await client.query(
            `INSERT INTO property_versions 
             (property_id, version_number, version_data, is_live, status, created_by, created_by_role, reason)
             VALUES ($1, $2, $3, false, 'draft', $4, $5, $6)
             RETURNING *`,
            [propertyId, nextVersion, JSON.stringify(snapshot), req.user.id, req.user.role, reason]
        );

        // Update property moderation status (source of truth)
        await client.query(
            `UPDATE properties 
             SET moderation_status = 'pending_edit',
                 updated_at = NOW()
             WHERE id = $1`,
            [propertyId]
        );

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, changed_by, reason)
             VALUES ($1, $2, 'pending_edit', $3, $4)`,
            [propertyId, property.moderation_status || 'none', req.user.id, reason || 'Edit request created']
        );

        // Add note
        if (reason) {
            await client.query(
                `INSERT INTO property_notes 
                 (property_id, author_id, note_type, content)
                 VALUES ($1, $2, 'fix_request', $3)`,
                [propertyId, req.user.id, reason]
            );
        }

        await client.query('COMMIT');

        broadcastEvent('property:updated', {
            propertyId: propertyId,
            action: 'request_edit',
            moderation_status: 'pending_edit'
        });

        res.status(201).json({
            success: true,
            message: 'Edit request created. You can now edit the pending version.',
            data: versionResult.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[POST /property-versions/:propertyId/request-edit] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/property-versions/version/:versionId
 * Agent edits a pending/draft/rejected version
 */
router.put('/version/:versionId', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { versionId } = req.params;
        const updates = req.body;

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No changes provided' });
        }

        // Get the version
        const versionResult = await pool.query(
            `SELECT pv.*, p.agent_team, p.publication_status
             FROM property_versions pv
             JOIN properties p ON pv.property_id = p.id
             WHERE pv.id = $1`,
            [versionId]
        );

        if (versionResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Version not found' });
        }

        const version = versionResult.rows[0];

        // Check permissions
        if (req.user.role === 'agent') {
            if (version.agent_team !== req.user.team) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
            // Agent can only edit draft or rejected versions
            if (!['draft', 'rejected'].includes(version.status)) {
                return res.status(403).json({
                    success: false,
                    error: `Cannot edit version with status '${version.status}'. Only draft or rejected versions can be edited.`
                });
            }
        }

        // Merge updates into version_data
        // Support both { price: 100 } and { updates: { price: 100 } } format
        const actualUpdates = updates.updates && typeof updates.updates === 'object' ? updates.updates : updates;
        const currentData = version.version_data || {};
        const mergedData = { ...currentData, ...actualUpdates };

        await pool.query(
            `UPDATE property_versions 
             SET version_data = $1, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(mergedData), versionId]
        );

        res.json({
            success: true,
            message: 'Version updated successfully',
            data: {
                id: version.id,
                version_number: version.version_number,
                version_data: mergedData,
                status: version.status
            }
        });
    } catch (error) {
        console.error('[PUT /property-versions/version/:versionId] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * PUT /api/property-versions/version/:versionId/submit
 * Agent submits a version for admin review
 */
router.put('/version/:versionId/submit', authenticate, authorize(['agent']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { versionId } = req.params;

        await client.query('BEGIN');

        // Get version + property
        const versionResult = await client.query(
            `SELECT pv.*, p.agent_team, p.publication_status, p.moderation_status
             FROM property_versions pv
             JOIN properties p ON pv.property_id = p.id
             WHERE pv.id = $1`,
            [versionId]
        );

        if (versionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Version not found' });
        }

        const version = versionResult.rows[0];

        // Check permissions
        if (version.agent_team !== req.user.team) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!['draft', 'rejected'].includes(version.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Cannot submit version with status '${version.status}'`
            });
        }

        // Update version status to pending
        await client.query(
            `UPDATE property_versions SET status = 'pending', updated_at = NOW() WHERE id = $1`,
            [versionId]
        );

        // Update property moderation status
        const pubStatus = version.publication_status;
        const newModStatus = pubStatus === 'published' ? 'pending_edit' : 'pending_add';

        await client.query(
            `UPDATE properties SET moderation_status = $1, updated_at = NOW() WHERE id = $2`,
            [newModStatus, version.property_id]
        );

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, changed_by, reason)
             VALUES ($1, $2, $3, $4, 'Version submitted for review')`,
            [version.property_id, version.moderation_status || 'none', newModStatus, req.user.id]
        );

        await client.query('COMMIT');

        broadcastEvent('property:updated', {
            propertyId: version.property_id,
            action: 'version_submitted',
            moderation_status: newModStatus
        });

        res.json({
            data: { version_id: versionId, moderation_status: newModStatus }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-versions/version/:versionId/submit] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/property-versions/version/:versionId/diff
 * Get diff between live property and a pending version
 */
router.get('/version/:versionId/diff', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { versionId } = req.params;

        // Get version
        const versionResult = await pool.query(
            `SELECT pv.*, p.agent_team
             FROM property_versions pv
             JOIN properties p ON pv.property_id = p.id
             WHERE pv.id = $1`,
            [versionId]
        );

        if (versionResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Version not found' });
        }

        const version = versionResult.rows[0];

        // Check access
        if (req.user.role === 'agent' && version.agent_team !== req.user.team) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Get current live property data
        const propertyResult = await pool.query(
            'SELECT * FROM properties WHERE id = $1',
            [version.property_id]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const liveData = createSnapshot(propertyResult.rows[0]);
        const pendingData = version.version_data;

        // Compute diff
        const diff = computeDiff(liveData, pendingData);

        res.json({
            success: true,
            data: {
                version_id: version.id,
                version_number: version.version_number,
                version_status: version.status,
                diff: diff.changes,
                summary: diff.summary,
                live_version: liveData,
                pending_version: pendingData,
                created_by: version.created_by,
                created_at: version.created_at
            }
        });
    } catch (error) {
        console.error('[GET /property-versions/version/:versionId/diff] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * PUT /api/property-versions/version/:versionId/approve
 * Admin approves a pending version
 */
router.put('/version/:versionId/approve', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { versionId } = req.params;
        const { note } = req.body;

        await client.query('BEGIN');

        // Get version + property
        const versionResult = await client.query(
            `SELECT pv.*, p.publication_status, p.moderation_status
             FROM property_versions pv
             JOIN properties p ON pv.property_id = p.id
             WHERE pv.id = $1`,
            [versionId]
        );

        if (versionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Version not found' });
        }

        const version = versionResult.rows[0];

        if (version.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Cannot approve version with status '${version.status}'`
            });
        }

        const pubStatus = version.publication_status;
        const modStatus = version.moderation_status || 'none';

        // 1. Archive current live version (if exists)
        await client.query(
            `UPDATE property_versions 
             SET is_live = false, status = 'archived', updated_at = NOW()
             WHERE property_id = $1 AND is_live = true`,
            [version.property_id]
        );

        // 2. If this is a published property with pending_edit, create archive snapshot first
        if (pubStatus === 'published' && modStatus === 'pending_edit') {
            // Get current live data
            const currentLiveResult = await client.query(
                'SELECT * FROM properties WHERE id = $1',
                [version.property_id]
            );

            if (currentLiveResult.rows.length > 0) {
                const liveSnapshot = createSnapshot(currentLiveResult.rows[0]);

                // Check if we already have a live version recorded
                const existingLive = await client.query(
                    'SELECT id FROM property_versions WHERE property_id = $1 AND is_live = true',
                    [version.property_id]
                );

                if (existingLive.rows.length === 0) {
                    // Create a snapshot of current live before overwriting
                    const archiveMaxVer = await client.query(
                        'SELECT COALESCE(MAX(version_number), 0) as max_ver FROM property_versions WHERE property_id = $1',
                        [version.property_id]
                    );

                    // Only create archive if the version_number won't conflict
                    // and there isn't already an archive for this state
                }
            }
        }

        // 3. Mark approved version as live
        await client.query(
            `UPDATE property_versions 
             SET is_live = true, status = 'approved', admin_note = $1, updated_at = NOW()
             WHERE id = $2`,
            [note, versionId]
        );

        // 4. Apply version data to properties table
        const versionData = version.version_data;
        const { setClauses, params, nextIdx } = buildApplyVersionQuery(versionData);

        if (setClauses.length > 1) { // > 1 because updated_at is always there
            // New model is source of truth
            setClauses.push(`publication_status = 'published'`);
            setClauses.push(`moderation_status = 'none'`);

            params.push(version.property_id);
            const updateQuery = `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $${nextIdx}`;

            await client.query(updateQuery, params);
        } else {
            // No data fields to update, just update status
            await client.query(
                `UPDATE properties 
                 SET publication_status = 'published', moderation_status = 'none',
                     updated_at = NOW()
                 WHERE id = $1`,
                [version.property_id]
            );
        }

        // 5. Auto-regenerate titles if relevant fields changed
        try {
            const updatedProp = await client.query('SELECT * FROM properties WHERE id = $1', [version.property_id]);
            if (updatedProp.rows.length > 0) {
                const p = updatedProp.rows[0];
                const generatedTitles = await generateTitles({
                    type_id: p.type_id, status_id: p.status_id, subdistrict_id: p.subdistrict_id,
                    size: p.size, property_id: p.property_id,
                    type: p.type, status: p.status, province: p.province,
                    district: p.district, sub_district: p.sub_district
                });
                await client.query(
                    'UPDATE properties SET title = $1, title_en = $2, title_th = $3, title_zh = $4 WHERE id = $5',
                    [generatedTitles.title_en, generatedTitles.title_en, generatedTitles.title_th, generatedTitles.title_zh, version.property_id]
                );
            }
        } catch (titleErr) {
            console.warn('[APPROVE VERSION] Title regeneration failed:', titleErr.message);
        }

        // 6. Discard other pending versions for this property
        await client.query(
            `UPDATE property_versions 
             SET status = 'discarded', admin_note = 'Discarded: another version was approved', updated_at = NOW()
             WHERE property_id = $1 AND id != $2 AND status IN ('pending', 'draft', 'rejected')`,
            [version.property_id, versionId]
        );

        // 7. Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status,
              previous_approval_status, new_approval_status, changed_by, reason)
             VALUES ($1, $2, 'none', $3, 'published', $4, $5)`,
            [version.property_id, modStatus, pubStatus, req.user.id,
            note || `Version ${version.version_number} approved`]
        );

        // 8. Add approval note
        await client.query(
            `INSERT INTO property_notes 
             (property_id, author_id, note_type, content)
             VALUES ($1, $2, 'approval', $3)`,
            [version.property_id, req.user.id, note || `Version ${version.version_number} approved and applied`]
        );

        await client.query('COMMIT');

        broadcastEvent('property:published', {
            propertyId: version.property_id,
            action: 'version_approved',
            version_number: version.version_number,
            publication_status: 'published',
            moderation_status: 'none'
        });

        res.json({
            data: {
                version_id: versionId,
                version_number: version.version_number,
                publication_status: 'published',
                moderation_status: 'none'
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-versions/version/:versionId/approve] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/property-versions/version/:versionId/reject
 * Admin rejects or returns a version for revision
 * body: { action: 'return' | 'reject', note: string }
 */
router.put('/version/:versionId/reject', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { versionId } = req.params;
        const { action = 'return', note } = req.body;

        if (!['return', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'action must be "return" or "reject"'
            });
        }

        await client.query('BEGIN');

        // Get version + property
        const versionResult = await client.query(
            `SELECT pv.*, p.publication_status, p.moderation_status
             FROM property_versions pv
             JOIN properties p ON pv.property_id = p.id
             WHERE pv.id = $1`,
            [versionId]
        );

        if (versionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Version not found' });
        }

        const version = versionResult.rows[0];

        if (version.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Cannot process version with status '${version.status}'`
            });
        }

        const pubStatus = version.publication_status;
        const modStatus = version.moderation_status || 'none';

        if (action === 'return') {
            // Return for revision — agent can edit the same version
            await client.query(
                `UPDATE property_versions SET status = 'rejected', admin_note = $1, updated_at = NOW() WHERE id = $2`,
                [note, versionId]
            );

            // Determine rejected moderation status
            let rejectedModStatus;
            if (modStatus === 'pending_add') rejectedModStatus = 'rejected_add';
            else if (modStatus === 'pending_edit') rejectedModStatus = 'rejected_edit';
            else rejectedModStatus = 'rejected_edit'; // fallback

            await client.query(
                `UPDATE properties SET moderation_status = $1, updated_at = NOW() WHERE id = $2`,
                [rejectedModStatus, version.property_id]
            );

            // Record in workflow history
            await client.query(
                `INSERT INTO workflow_history 
                 (property_id, previous_workflow_status, new_workflow_status, changed_by, reason)
                 VALUES ($1, $2, $3, $4, $5)`,
                [version.property_id, modStatus, rejectedModStatus, req.user.id,
                note || 'Returned for revision']
            );

            // Add rejection note
            if (note) {
                await client.query(
                    `INSERT INTO property_notes 
                     (property_id, author_id, note_type, content)
                     VALUES ($1, $2, 'rejection', $3)`,
                    [version.property_id, req.user.id, note]
                );
            }

            await client.query('COMMIT');

            broadcastEvent('property:updated', {
                propertyId: version.property_id,
                action: 'version_returned',
                moderation_status: rejectedModStatus
            });

            res.json({
                data: { version_id: versionId, moderation_status: rejectedModStatus }
            });
        } else {
            // Reject completely — discard version, live stays as-is
            await client.query(
                `UPDATE property_versions SET status = 'discarded', admin_note = $1, updated_at = NOW() WHERE id = $2`,
                [note || 'Rejected by admin', versionId]
            );

            // If it was a new property (pending_add), mark as deleted
            let newModStatus = 'none';
            let newPubStatus = pubStatus;

            if (modStatus === 'pending_add') {
                newPubStatus = 'deleted';
                await client.query(
                    `UPDATE properties 
                     SET publication_status = 'deleted', moderation_status = 'none',
                         deleted_at = NOW(), deleted_by = $1,
                         updated_at = NOW()
                     WHERE id = $2`,
                    [req.user.id, version.property_id]
                );
            } else {
                // Published property — just remove moderation status
                await client.query(
                    `UPDATE properties SET moderation_status = 'none', updated_at = NOW() WHERE id = $1`,
                    [version.property_id]
                );
            }

            // Record in workflow history
            await client.query(
                `INSERT INTO workflow_history 
                 (property_id, previous_workflow_status, new_workflow_status,
                  previous_approval_status, new_approval_status, changed_by, reason)
                 VALUES ($1, $2, 'none', $3, $4, $5, $6)`,
                [version.property_id, modStatus, pubStatus, newPubStatus, req.user.id,
                note || 'Version rejected']
            );

            if (note) {
                await client.query(
                    `INSERT INTO property_notes 
                     (property_id, author_id, note_type, content)
                     VALUES ($1, $2, 'rejection', $3)`,
                    [version.property_id, req.user.id, note]
                );
            }

            await client.query('COMMIT');

            broadcastEvent('property:updated', {
                propertyId: version.property_id,
                action: 'version_rejected',
                publication_status: newPubStatus,
                moderation_status: newModStatus
            });

            res.json({
                data: {
                    version_id: versionId,
                    publication_status: newPubStatus,
                    moderation_status: newModStatus
                }
            });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-versions/version/:versionId/reject] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/property-versions/version/:versionId/revert
 * Admin reverts a property to a previous version
 * Creates a NEW version from the old version's data, then applies it
 */
router.put('/version/:versionId/revert', authenticate, authorize(['admin']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { versionId } = req.params;
        const { note } = req.body;

        await client.query('BEGIN');

        // Get the target version
        const versionResult = await client.query(
            `SELECT pv.*, p.publication_status, p.moderation_status
             FROM property_versions pv
             JOIN properties p ON pv.property_id = p.id
             WHERE pv.id = $1`,
            [versionId]
        );

        if (versionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Version not found' });
        }

        const targetVersion = versionResult.rows[0];

        // Get next version number
        const maxVerResult = await client.query(
            'SELECT COALESCE(MAX(version_number), 0) as max_ver FROM property_versions WHERE property_id = $1',
            [targetVersion.property_id]
        );
        const nextVersion = maxVerResult.rows[0].max_ver + 1;

        // 1. Archive current live version
        await client.query(
            `UPDATE property_versions 
             SET is_live = false, status = 'archived', updated_at = NOW()
             WHERE property_id = $1 AND is_live = true`,
            [targetVersion.property_id]
        );

        // 2. Create new version from target version's data
        const newVersionResult = await client.query(
            `INSERT INTO property_versions 
             (property_id, version_number, version_data, is_live, status, 
              created_by, created_by_role, reason, reverted_from_version)
             VALUES ($1, $2, $3, true, 'approved', $4, 'admin', $5, $6)
             RETURNING *`,
            [
                targetVersion.property_id, nextVersion,
                JSON.stringify(targetVersion.version_data),
                req.user.id,
                note || `Reverted to version ${targetVersion.version_number}`,
                targetVersion.id
            ]
        );

        // 3. Apply reverted data to properties table
        const { setClauses, params, nextIdx } = buildApplyVersionQuery(targetVersion.version_data);

        if (setClauses.length > 1) {
            setClauses.push(`moderation_status = 'none'`);
            params.push(targetVersion.property_id);
            const updateQuery = `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $${nextIdx}`;
            await client.query(updateQuery, params);
        }

        // 4. Discard any pending versions
        await client.query(
            `UPDATE property_versions 
             SET status = 'discarded', admin_note = 'Discarded: property reverted to previous version', updated_at = NOW()
             WHERE property_id = $1 AND status IN ('pending', 'draft', 'rejected')`,
            [targetVersion.property_id]
        );

        // 5. Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, changed_by, reason)
             VALUES ($1, $2, $3)`,
            [targetVersion.property_id, req.user.id,
            `Reverted to version ${targetVersion.version_number}. ${note || ''}`]
        );

        // 6. Add note
        await client.query(
            `INSERT INTO property_notes 
             (property_id, author_id, note_type, content)
             VALUES ($1, $2, 'general', $3)`,
            [targetVersion.property_id, req.user.id,
            `Property reverted to version ${targetVersion.version_number}`]
        );

        await client.query('COMMIT');

        broadcastEvent('property:updated', {
            propertyId: targetVersion.property_id,
            action: 'version_reverted',
            version_number: targetVersion.version_number
        });

        res.json({
            data: {
                new_version: newVersionResult.rows[0],
                reverted_from_version: targetVersion.version_number
            }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PUT /property-versions/version/:versionId/revert] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/property-versions/version/:versionId
 * Agent cancels/discards a draft version before submitting
 */
router.delete('/version/:versionId', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    const client = await pool.connect();

    try {
        const { versionId } = req.params;

        await client.query('BEGIN');

        const versionResult = await client.query(
            `SELECT pv.*, p.agent_team, p.moderation_status, p.publication_status
             FROM property_versions pv
             JOIN properties p ON pv.property_id = p.id
             WHERE pv.id = $1`,
            [versionId]
        );

        if (versionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Version not found' });
        }

        const version = versionResult.rows[0];

        // Agent can only cancel their own team's versions
        if (req.user.role === 'agent' && version.agent_team !== req.user.team) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Only allow canceling draft or rejected versions
        if (!['draft', 'rejected'].includes(version.status)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Can only discard draft or rejected versions. Current status: '${version.status}'`
            });
        }

        // Delete the version
        await client.query('DELETE FROM property_versions WHERE id = $1', [versionId]);

        // Reset moderation_status back to 'none' if this was the cause
        const modStatus = version.moderation_status || 'none';
        if (['pending_edit', 'rejected_edit'].includes(modStatus)) {
            await client.query(
                `UPDATE properties SET moderation_status = 'none', updated_at = NOW() WHERE id = $1`,
                [version.property_id]
            );
        }

        // Record in workflow history
        await client.query(
            `INSERT INTO workflow_history 
             (property_id, previous_workflow_status, new_workflow_status, changed_by, reason)
             VALUES ($1, $2, 'none', $3, 'Version draft discarded')`,
            [version.property_id, modStatus, req.user.id]
        );

        await client.query('COMMIT');

        broadcastEvent('property:updated', {
            propertyId: version.property_id,
            action: 'version_discarded',
            moderation_status: 'none'
        });

        res.json({
            data: { property_id: version.property_id, moderation_status: 'none' }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DELETE /property-versions/version/:versionId] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        client.release();
    }
});

module.exports = router;
