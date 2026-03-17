const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { broadcastEvent } = require('../services/sse');

async function getNoteCounts(propertyId) {
    const result = await pool.query(
        `SELECT
            COUNT(*)::int AS note_count,
            COUNT(*) FILTER (WHERE is_internal = false)::int AS public_note_count
         FROM property_notes
         WHERE property_id = $1`,
        [propertyId]
    );

    return result.rows[0] || { note_count: 0, public_note_count: 0 };
}

// =====================================================
// Property Notes API
// For communication between admin and agent
// =====================================================

/**
 * GET /api/property-notes/:propertyId
 * Get all notes for a property
 */
router.get('/:propertyId', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { propertyId } = req.params;

        // Check if property exists and user has access
        const propertyResult = await pool.query(
            'SELECT id, agent_team FROM properties WHERE id = $1',
            [propertyId]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];

        // Agent can only see notes for their team's properties
        if (req.user.role === 'agent' && property.agent_team !== req.user.team) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This property belongs to another team.'
            });
        }

        // Build query - Admin sees all notes, Agent doesn't see internal notes
        let query = `
            SELECT 
                pn.id,
                pn.property_id,
                pn.request_id,
                pn.note_type,
                pn.content,
                pn.is_internal,
                pn.created_at,
                u.id as author_id,
                u.name as author_name,
                u.role as author_role
            FROM property_notes pn
            JOIN users u ON pn.author_id = u.id
            WHERE pn.property_id = $1
        `;

        if (req.user.role === 'agent') {
            query += ` AND pn.is_internal = false`;
        }

        query += ` ORDER BY pn.created_at ASC`;

        const result = await pool.query(query, [propertyId]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('[GET /property-notes/:propertyId] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * POST /api/property-notes/:propertyId
 * Add a note to a property
 */
router.post('/:propertyId', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { content, note_type = 'general', is_internal = false, request_id } = req.body;

        // Validate content
        if (!content || content.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Note content is required'
            });
        }

        // Check if property exists and user has access
        const propertyResult = await pool.query(
            'SELECT id, property_id, agent_team, moderation_status FROM properties WHERE id = $1',
            [propertyId]
        );

        if (propertyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = propertyResult.rows[0];

        // Agent can only add notes to their team's properties
        if (req.user.role === 'agent' && property.agent_team !== req.user.team) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. This property belongs to another team.'
            });
        }

        // Agent cannot create internal notes
        const actualIsInternal = req.user.role === 'admin' ? is_internal : false;

        // Validate note_type from database
        const noteTypeResult = await pool.query(
            'SELECT * FROM note_types WHERE code = $1 AND is_active = true',
            [note_type]
        );

        if (noteTypeResult.rows.length === 0) {
            // Get valid types for error message
            const validTypes = await pool.query('SELECT code FROM note_types WHERE is_active = true');
            const validCodes = validTypes.rows.map(r => r.code).join(', ');
            return res.status(400).json({
                success: false,
                error: `Invalid note_type. Must be one of: ${validCodes}`
            });
        }

        const noteTypeConfig = noteTypeResult.rows[0];

        // Check if user's role is allowed to use this note_type
        if (!noteTypeConfig.allowed_roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Your role (${req.user.role}) cannot create notes of type '${note_type}'`
            });
        }

        // If agent is responding to a fix request, transition moderation status
        // New model: rejected_add → pending_add, rejected_edit → pending_edit
        let workflowUpdated = false;
        let newModStatus = null;
        const modStatus = property.moderation_status || 'none';
        if (req.user.role === 'agent' && note_type === 'fix_response') {
            if (modStatus === 'rejected_add') {
                newModStatus = 'pending_add';
                await pool.query(
                    `UPDATE properties SET moderation_status = $1, updated_at = NOW() WHERE id = $2`,
                    [newModStatus, propertyId]
                );
                // Insert workflow history with explicit record
                await pool.query(
                    `INSERT INTO workflow_history (property_id, previous_moderation_status, new_moderation_status, changed_by, reason)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [propertyId, modStatus, newModStatus, req.user.id, `Fix response submitted for review`]
                );
                workflowUpdated = true;
            } else if (modStatus === 'rejected_edit') {
                newModStatus = 'pending_edit';
                await pool.query(
                    `UPDATE properties SET moderation_status = $1, updated_at = NOW() WHERE id = $2`,
                    [newModStatus, propertyId]
                );
                // Insert workflow history with explicit record
                await pool.query(
                    `INSERT INTO workflow_history (property_id, previous_moderation_status, new_moderation_status, changed_by, reason)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [propertyId, modStatus, newModStatus, req.user.id, `Fix response submitted for review`]
                );
                workflowUpdated = true;
            }
        }

        // Insert the note
        const result = await pool.query(
            `INSERT INTO property_notes 
             (property_id, request_id, author_id, note_type, content, is_internal)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [propertyId, request_id || null, req.user.id, note_type, content.trim(), actualIsInternal]
        );

        // Get author info for response
        const noteWithAuthor = {
            ...result.rows[0],
            author_name: req.user.name,
            author_role: req.user.role
        };

        const noteCounts = await getNoteCounts(propertyId);

        broadcastEvent('note:created', {
            propertyId: Number(propertyId),
            property_id: property.property_id,
            noteId: result.rows[0].id,
            note_type,
            author_id: req.user.id,
            is_internal: actualIsInternal,
            note_count: noteCounts.note_count,
            public_note_count: noteCounts.public_note_count
        });

        // Emit SSE event if workflow was updated due to fix_response
        if (workflowUpdated && newModStatus) {
            broadcastEvent('note:fix_response_submitted', {
                propertyId: Number(propertyId),
                property_id: property.property_id,
                noteId: result.rows[0].id,
                note_type: note_type,
                author_id: req.user.id,
                is_internal: actualIsInternal,
                note_count: noteCounts.note_count,
                public_note_count: noteCounts.public_note_count,
                previous_moderation_status: modStatus,
                new_moderation_status: newModStatus
            });
            // Also emit the general status_changed event for backward compatibility
            broadcastEvent('property:status_changed', {
                propertyId: Number(propertyId),
                property_id: property.property_id,
                moderation_status: newModStatus
            });
        }

        res.status(201).json({
            success: true,
            message: 'Note added successfully',
            data: noteWithAuthor,
            workflow_updated: workflowUpdated
        });
    } catch (error) {
        console.error('[POST /property-notes/:propertyId] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * DELETE /api/property-notes/:propertyId/:noteId
 * Delete a note (Admin only, or author can delete own note within 24 hours)
 */
router.delete('/:propertyId/:noteId', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const { propertyId, noteId } = req.params;

        // Get the note
        const noteResult = await pool.query(
            'SELECT pn.*, p.agent_team, p.property_id AS property_code FROM property_notes pn JOIN properties p ON pn.property_id = p.id WHERE pn.id = $1 AND pn.property_id = $2',
            [noteId, propertyId]
        );

        if (noteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note not found'
            });
        }

        const note = noteResult.rows[0];

        // Admin can delete any note
        // Agent can only delete their own notes within 24 hours
        if (req.user.role === 'agent') {
            if (note.author_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own notes'
                });
            }

            // Check if within 24 hours
            const noteAge = Date.now() - new Date(note.created_at).getTime();
            const twentyFourHours = 24 * 60 * 60 * 1000;
            if (noteAge > twentyFourHours) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete notes within 24 hours of creation'
                });
            }
        }

        await pool.query('DELETE FROM property_notes WHERE id = $1', [noteId]);

        const noteCounts = await getNoteCounts(propertyId);

        broadcastEvent('note:deleted', {
            propertyId: Number(propertyId),
            property_id: note.property_code,
            noteId: Number(noteId),
            note_type: note.note_type,
            author_id: note.author_id,
            is_internal: note.is_internal,
            note_count: noteCounts.note_count,
            public_note_count: noteCounts.public_note_count
        });

        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('[DELETE /property-notes/:propertyId/:noteId] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
