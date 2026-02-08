const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// =====================================================
// Note Types API
// For admin to manage note categories dynamically
// =====================================================

/**
 * GET /api/note-types
 * Get all note types (active ones for regular users, all for admin)
 */
router.get('/', async (req, res) => {
    try {
        const { exclude_system } = req.query;

        let query = `
            SELECT id, code, name, description, color, icon, 
                   allowed_roles, is_active, sort_order, is_system
            FROM note_types
        `;

        const conditions = [];
        const params = [];
        let paramCount = 1;

        // If not admin, only show active ones
        const isAdmin = req.user && req.user.role === 'admin';

        if (!isAdmin) {
            conditions.push(`is_active = true`);
        }

        if (exclude_system === 'true') {
            conditions.push(`is_system = FALSE`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ` ORDER BY sort_order ASC, id ASC`;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('[GET /note-types] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/note-types/:code
 * Get a single note type by code
 */
router.get('/:code', async (req, res) => {
    try {
        const { code } = req.params;

        const result = await pool.query(
            'SELECT * FROM note_types WHERE code = $1',
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note type not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[GET /note-types/:code] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * POST /api/note-types
 * Create a new note type (Admin only)
 */
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
    try {
        let { code, name, description, color, icon, allowed_roles, sort_order } = req.body;

        // Validate required fields - only name is required
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'name is required'
            });
        }

        // Auto-generate code from name if not provided
        if (!code) {
            code = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
        }

        // Validate code format (lowercase, no spaces)
        const codeRegex = /^[a-z_]+$/;
        if (!codeRegex.test(code)) {
            return res.status(400).json({
                success: false,
                error: 'code must be lowercase letters and underscores only'
            });
        }

        // Check if code already exists
        const existing = await pool.query('SELECT id FROM note_types WHERE code = $1', [code]);
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Note type with this code already exists'
            });
        }

        // Default allowed_roles
        const roles = allowed_roles || ['admin', 'agent'];

        const result = await pool.query(
            `INSERT INTO note_types (code, name, description, color, icon, allowed_roles, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [code, name, description || null, color || null, icon || null, roles, sort_order || 0]
        );

        res.status(201).json({
            success: true,
            message: 'Note type created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[POST /note-types] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * PUT /api/note-types/:id
 * Update a note type (Admin only)
 */
router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, description, color, icon, allowed_roles, is_active, sort_order } = req.body;

        // Check if id is valid integer
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }

        // Check if exists
        const checkQuery = 'SELECT * FROM note_types WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);




        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note type not found'
            });
        }

        const currentNoteType = checkResult.rows[0];

        // If changing code, validate new code
        if (code && code !== currentNoteType.code) {
            // Prevent changing code of system types
            if (currentNoteType.is_system) {
                return res.status(403).json({
                    success: false,
                    error: 'Cannot change code of system note type. The code is hard-coded in workflow automation.',
                    code: 'SYSTEM_TYPE_CODE_PROTECTED'
                });
            }

            const codeRegex = /^[a-z_]+$/;
            if (!codeRegex.test(code)) {
                return res.status(400).json({
                    success: false,
                    error: 'code must be lowercase letters and underscores only'
                });
            }

            // Check if new code already exists
            const codeExists = await pool.query('SELECT id FROM note_types WHERE code = $1 AND id != $2', [code, id]);
            if (codeExists.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Note type with this code already exists'
                });
            }
        }

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (code !== undefined) {
            updates.push(`code = $${paramCount++}`);
            values.push(code);
        }
        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramCount++}`);
            values.push(description);
        }
        if (color !== undefined) {
            updates.push(`color = $${paramCount++}`);
            values.push(color);
        }
        if (icon !== undefined) {
            updates.push(`icon = $${paramCount++}`);
            values.push(icon);
        }
        if (allowed_roles !== undefined) {
            updates.push(`allowed_roles = $${paramCount++}`);
            values.push(allowed_roles);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }
        if (sort_order !== undefined) {
            updates.push(`sort_order = $${paramCount++}`);
            values.push(sort_order);
        }

        updates.push(`updated_at = NOW()`);

        if (updates.length === 1) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update'
            });
        }

        values.push(id);
        const query = `UPDATE note_types SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

        const result = await pool.query(query, values);

        // If code was changed, update existing notes
        if (code && code !== currentNoteType.code) {
            await pool.query(
                'UPDATE property_notes SET note_type = $1 WHERE note_type = $2',
                [code, currentNoteType.code]
            );
        }

        res.json({
            success: true,
            message: 'Note type updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[PUT /note-types/:id] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * DELETE /api/note-types/:id
 * Soft delete a note type (Admin only)
 */
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { soft = false } = req.query;

        // Check if id is valid integer
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }

        // Check if exists
        const checkQuery = 'SELECT * FROM note_types WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [id]);



        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note type not found'
            });
        }

        const noteType = checkResult.rows[0];

        // Check if system type
        if (noteType.is_system) {
            return res.status(403).json({
                success: false,
                error: `Cannot delete system note type "${noteType.name}". This type is used by workflow automation and is required for the system to function properly.`,
                code: 'SYSTEM_TYPE_PROTECTED'
            });
        }

        // Check if any notes use this type
        const usageCount = await pool.query(
            'SELECT COUNT(*) FROM property_notes WHERE note_type = $1',
            [noteType.code]
        );

        if (soft === 'true') {
            // Soft delete - just deactivate
            await pool.query(
                'UPDATE note_types SET is_active = false, updated_at = NOW() WHERE id = $1',
                [id]
            );

            res.json({
                success: true,
                message: 'Note type deactivated successfully',
                notes_affected: parseInt(usageCount.rows[0].count)
            });
        } else {
            // Hard delete - actually remove from database
            if (parseInt(usageCount.rows[0].count) > 0) {
                // If notes are using this type, just deactivate instead
                await pool.query(
                    'UPDATE note_types SET is_active = false, updated_at = NOW() WHERE id = $1',
                    [id]
                );

                res.json({
                    success: true,
                    message: `Note type deactivated (${usageCount.rows[0].count} notes are using this type)`,
                    notes_affected: parseInt(usageCount.rows[0].count)
                });
            } else {
                await pool.query('DELETE FROM note_types WHERE id = $1', [id]);

                res.json({
                    success: true,
                    message: 'Note type deleted permanently'
                });
            }
        }
    } catch (error) {
        console.error('[DELETE /note-types/:id] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * PUT /api/note-types/:id/restore
 * Restore a soft-deleted note type
 */
router.put('/:id/restore', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if id is valid integer
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ID format'
            });
        }

        const result = await pool.query(
            'UPDATE note_types SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note type not found'
            });
        }

        res.json({
            success: true,
            message: 'Note type restored successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[PUT /note-types/:id/restore] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
