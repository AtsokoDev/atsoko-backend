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
        let query = `
            SELECT id, code, name_th, name_en, description, color, icon, 
                   allowed_roles, is_active, sort_order
            FROM note_types
        `;

        // If not admin, only show active ones
        // Check if user is authenticated and is admin
        const isAdmin = req.user && req.user.role === 'admin';

        if (!isAdmin) {
            query += ` WHERE is_active = true`;
        }

        query += ` ORDER BY sort_order ASC, id ASC`;

        const result = await pool.query(query);

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
        const { code, name_th, name_en, description, color, icon, allowed_roles, sort_order } = req.body;

        // Validate required fields
        if (!code || !name_th) {
            return res.status(400).json({
                success: false,
                error: 'code and name_th are required'
            });
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
            `INSERT INTO note_types (code, name_th, name_en, description, color, icon, allowed_roles, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [code, name_th, name_en || null, description || null, color || null, icon || null, roles, sort_order || 0]
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
 * PUT /api/note-types/:code
 * Update a note type (Admin only)
 */
router.put('/:code', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { code } = req.params;
        const { name_th, name_en, description, color, icon, allowed_roles, is_active, sort_order, new_code } = req.body;

        // Check if exists
        const existing = await pool.query('SELECT * FROM note_types WHERE code = $1', [code]);
        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note type not found'
            });
        }

        // If changing code, validate new code
        if (new_code && new_code !== code) {
            const codeRegex = /^[a-z_]+$/;
            if (!codeRegex.test(new_code)) {
                return res.status(400).json({
                    success: false,
                    error: 'new_code must be lowercase letters and underscores only'
                });
            }

            // Check if new code already exists
            const codeExists = await pool.query('SELECT id FROM note_types WHERE code = $1', [new_code]);
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

        if (new_code && new_code !== code) {
            updates.push(`code = $${paramCount++}`);
            values.push(new_code);
        }
        if (name_th !== undefined) {
            updates.push(`name_th = $${paramCount++}`);
            values.push(name_th);
        }
        if (name_en !== undefined) {
            updates.push(`name_en = $${paramCount++}`);
            values.push(name_en);
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

        values.push(code);
        const query = `UPDATE note_types SET ${updates.join(', ')} WHERE code = $${paramCount} RETURNING *`;

        const result = await pool.query(query, values);

        // If code was changed, update existing notes
        if (new_code && new_code !== code) {
            await pool.query(
                'UPDATE property_notes SET note_type = $1 WHERE note_type = $2',
                [new_code, code]
            );
        }

        res.json({
            success: true,
            message: 'Note type updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[PUT /note-types/:code] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * DELETE /api/note-types/:code
 * Soft delete a note type (Admin only)
 * Will just set is_active = false
 */
router.delete('/:code', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { code } = req.params;
        const { hard = false } = req.query;

        // Check if exists
        const existing = await pool.query('SELECT * FROM note_types WHERE code = $1', [code]);
        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Note type not found'
            });
        }

        // Check if any notes use this type
        const usageCount = await pool.query(
            'SELECT COUNT(*) FROM property_notes WHERE note_type = $1',
            [code]
        );

        if (hard === 'true') {
            // Hard delete - only if not used
            if (parseInt(usageCount.rows[0].count) > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot hard delete. ${usageCount.rows[0].count} notes are using this type. Use soft delete instead.`
                });
            }

            await pool.query('DELETE FROM note_types WHERE code = $1', [code]);

            res.json({
                success: true,
                message: 'Note type deleted permanently'
            });
        } else {
            // Soft delete
            await pool.query(
                'UPDATE note_types SET is_active = false, updated_at = NOW() WHERE code = $1',
                [code]
            );

            res.json({
                success: true,
                message: 'Note type deactivated successfully',
                notes_affected: parseInt(usageCount.rows[0].count)
            });
        }
    } catch (error) {
        console.error('[DELETE /note-types/:code] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * PUT /api/note-types/:code/restore
 * Restore a soft-deleted note type
 */
router.put('/:code/restore', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { code } = req.params;

        const result = await pool.query(
            'UPDATE note_types SET is_active = true, updated_at = NOW() WHERE code = $1 RETURNING *',
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
            message: 'Note type restored successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[PUT /note-types/:code/restore] Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
