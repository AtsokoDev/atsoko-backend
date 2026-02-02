const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

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
            'SELECT id, agent_team, workflow_status FROM properties WHERE id = $1',
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

        // Validate note_type
        const validNoteTypes = ['general', 'fix_request', 'fix_response', 'approval', 'rejection'];
        if (!validNoteTypes.includes(note_type)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid note_type. Must be one of: ' + validNoteTypes.join(', ')
            });
        }

        // Agent can only create general or fix_response notes
        if (req.user.role === 'agent' && !['general', 'fix_response'].includes(note_type)) {
            return res.status(400).json({
                success: false,
                error: 'Agents can only create general or fix_response notes'
            });
        }

        // If agent is responding to a fix request, update workflow_status to 'fixed'
        let workflowUpdated = false;
        if (req.user.role === 'agent' && note_type === 'fix_response' && property.workflow_status === 'wait_to_fix') {
            await pool.query(
                'UPDATE properties SET workflow_status = $1, updated_at = NOW() WHERE id = $2',
                ['fixed', propertyId]
            );
            workflowUpdated = true;
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
            'SELECT pn.*, p.agent_team FROM property_notes pn JOIN properties p ON pn.property_id = p.id WHERE pn.id = $1 AND pn.property_id = $2',
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
