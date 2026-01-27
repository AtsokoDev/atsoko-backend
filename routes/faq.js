const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const sanitizeHtml = require('sanitize-html');

// Sanitize options for HTML content (same as tips)
const sanitizeOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'hr', 'table',
        'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'],
    allowedAttributes: {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title'],
        '*': ['class', 'id', 'style']
    },
    // Whitelist only safe CSS properties for text alignment
    allowedStyles: {
        '*': {
            'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/]
        }
    }
};

// Helper function to validate integer
const validateInteger = (value, fieldName, min = 1, max = null) => {
    const num = parseInt(value);
    if (isNaN(num) || num < min || (max && num > max)) {
        throw new Error(`Invalid ${fieldName}: must be an integer between ${min} and ${max || 'infinity'}`);
    }
    return num;
};

// GET /api/faq - List all FAQs
router.get('/', async (req, res) => {
    try {
        const {
            category,
            is_active = true,
            page = 1,
            limit = 100
        } = req.query;

        const validatedPage = validateInteger(page, 'page', 1);
        const validatedLimit = validateInteger(limit, 'limit', 1, 100);

        let query = 'SELECT * FROM faq WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM faq WHERE 1=1';
        const params = [];
        const countParams = [];
        let paramCount = 1;

        // Filter by active status
        if (is_active !== undefined && is_active !== 'all') {
            const active = is_active === 'true' || is_active === true;
            query += ` AND is_active = $${paramCount}`;
            countQuery += ` AND is_active = $${paramCount}`;
            params.push(active);
            countParams.push(active);
            paramCount++;
        }

        // Filter by category
        if (category) {
            query += ` AND category = $${paramCount}`;
            countQuery += ` AND category = $${paramCount}`;
            params.push(category);
            countParams.push(category);
            paramCount++;
        }

        // Order by display_order, then by id
        query += ` ORDER BY display_order ASC, id ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(validatedLimit, (validatedPage - 1) * validatedLimit);

        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: validatedPage,
                limit: validatedLimit,
                total,
                pages: Math.ceil(total / validatedLimit)
            }
        });
    } catch (error) {
        console.error(error);
        if (error.message.startsWith('Invalid')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// GET /api/faq/:id - Get single FAQ
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM faq WHERE id = $1',
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'FAQ not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// POST /api/faq - Create new FAQ
// TODO: Add authentication middleware to protect this route
router.post('/', async (req, res) => {
    try {
        const {
            question,
            answer,
            category,
            display_order = 0,
            is_active = true
        } = req.body;

        // Validate required fields
        if (!question || !answer) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: question, answer'
            });
        }

        // Sanitize HTML content in answer
        const sanitizedAnswer = sanitizeHtml(answer, sanitizeOptions);

        const result = await pool.query(
            `INSERT INTO faq (question, answer, category, display_order, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [question, sanitizedAnswer, category, display_order, is_active]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'FAQ created successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// PUT /api/faq/:id - Update FAQ
// TODO: Add authentication middleware to protect this route
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;

        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Request body is empty'
            });
        }

        const allowedFields = [
            'question',
            'answer',
            'category',
            'display_order',
            'is_active'
        ];

        const fieldsToUpdate = Object.keys(data).filter(key => allowedFields.includes(key));

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }

        const setClauses = [];
        const params = [];
        let idx = 1;

        fieldsToUpdate.forEach(field => {
            let value = data[field];

            // Sanitize HTML content in answer
            if (field === 'answer') {
                value = sanitizeHtml(value, sanitizeOptions);
            }

            setClauses.push(`"${field}" = $${idx}`);
            params.push(value);
            idx++;
        });

        // Auto-update updated_at
        setClauses.push(`"updated_at" = NOW()`);

        const query = `
            UPDATE faq 
            SET ${setClauses.join(', ')} 
            WHERE id = $${idx} 
            RETURNING *
        `;
        params.push(parseInt(id));

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'FAQ not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'FAQ updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// DELETE /api/faq/:id - Delete FAQ
// TODO: Add authentication middleware to protect this route
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM faq WHERE id = $1 RETURNING *',
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'FAQ not found'
            });
        }

        res.json({
            success: true,
            message: 'FAQ deleted successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
