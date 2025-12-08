const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Helper function to validate integer
const validateInteger = (value, fieldName, min = 1, max = null) => {
    const num = parseInt(value);
    if (isNaN(num) || num < min || (max && num > max)) {
        throw new Error(`Invalid ${fieldName}: must be an integer between ${min} and ${max || 'infinity'}`);
    }
    return num;
};

// GET /api/tips - List all articles
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            published = true // Filter by published status
        } = req.query;

        const validatedPage = validateInteger(page, 'page', 1);
        const validatedLimit = validateInteger(limit, 'limit', 1, 100);

        let query = 'SELECT * FROM tips WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM tips WHERE 1=1';
        const params = [];
        const countParams = [];
        let paramCount = 1;

        // Filter by published status
        if (published !== undefined && published !== 'all') {
            const isPublished = published === 'true' || published === true;
            if (isPublished) {
                query += ` AND published_at IS NOT NULL AND published_at <= NOW()`;
                countQuery += ` AND published_at IS NOT NULL AND published_at <= NOW()`;
            } else {
                query += ` AND (published_at IS NULL OR published_at > NOW())`;
                countQuery += ` AND (published_at IS NULL OR published_at > NOW())`;
            }
        }

        // Order by published date (newest first)
        query += ` ORDER BY COALESCE(published_at, created_at) DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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

// GET /api/tips/:slug - Get single article by slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const result = await pool.query(
            'SELECT * FROM tips WHERE slug = $1',
            [slug]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Article not found'
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

// POST /api/tips - Create new article
// TODO: Add authentication middleware to protect this route
router.post('/', async (req, res) => {
    try {
        const {
            slug,
            title,
            excerpt,
            content,
            featured_image,
            author,
            published_at
        } = req.body;

        // Validate required fields
        if (!slug || !title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: slug, title, content'
            });
        }

        const result = await pool.query(
            `INSERT INTO tips (slug, title, excerpt, content, featured_image, author, published_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [slug, title, excerpt, content, featured_image, author, published_at]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Article created successfully'
        });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Article with this slug already exists'
            });
        }
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// PUT /api/tips/:id - Update article
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
            'slug',
            'title',
            'excerpt',
            'content',
            'featured_image',
            'author',
            'published_at'
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
            setClauses.push(`"${field}" = $${idx}`);
            params.push(data[field]);
            idx++;
        });

        // Auto-update updated_at
        setClauses.push(`"updated_at" = NOW()`);

        const query = `
            UPDATE tips 
            SET ${setClauses.join(', ')} 
            WHERE id = $${idx} 
            RETURNING *
        `;
        params.push(parseInt(id));

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Article not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Article updated successfully'
        });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Duplicate slug'
            });
        }
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// DELETE /api/tips/:id - Delete article
// TODO: Add authentication middleware to protect this route
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM tips WHERE id = $1 RETURNING *',
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Article not found'
            });
        }

        res.json({
            success: true,
            message: 'Article deleted successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
