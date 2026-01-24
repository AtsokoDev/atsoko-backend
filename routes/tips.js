const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const sanitizeHtml = require('sanitize-html');

// Helper function to validate integer
const validateInteger = (value, fieldName, min = 1, max = null) => {
    const num = parseInt(value);
    if (isNaN(num) || num < min || (max && num > max)) {
        throw new Error(`Invalid ${fieldName}: must be an integer between ${min} and ${max || 'infinity'}`);
    }
    return num;
};

// Sanitize options for HTML content
const sanitizeOptions = {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                  'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'hr', 'table',
                  'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'],
    allowedAttributes: {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title'],
        '*': ['class', 'id']
    }
};

// GET /api/tips - List all articles
// Public endpoint - no authentication required
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            published = true,
            sort = 'published_at' // 'published_at' (default) or 'display_order'
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

        // Order by selected sort option
        if (sort === 'display_order') {
            query += ` ORDER BY display_order ASC, COALESCE(published_at, created_at) DESC`;
        } else {
            query += ` ORDER BY COALESCE(published_at, created_at) DESC`;
        }

        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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
            },
            sort: sort
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
// Public endpoint - no authentication required
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
// Protected: Admin only
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const {
            slug,
            title,
            excerpt,
            content,
            featured_image,
            author,
            published_at,
            display_order,
            category,
            tags
        } = req.body;

        // Validate required fields
        if (!slug || !title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: slug, title, content'
            });
        }

        // Sanitize HTML content
        const sanitizedContent = sanitizeHtml(content, sanitizeOptions);

        // Handle tags - convert to JSON string if array
        let tagsValue = tags;
        if (Array.isArray(tags)) {
            tagsValue = JSON.stringify(tags);
        } else if (typeof tags === 'string' && !tags.startsWith('[')) {
            // Comma-separated string to JSON array
            tagsValue = JSON.stringify(tags.split(',').map(t => t.trim()).filter(t => t));
        }

        // If display_order not provided, get max + 1
        let finalDisplayOrder = display_order;
        if (finalDisplayOrder === undefined || finalDisplayOrder === null) {
            const maxResult = await pool.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM tips');
            finalDisplayOrder = maxResult.rows[0].next_order;
        }

        const result = await pool.query(
            `INSERT INTO tips (slug, title, excerpt, content, featured_image, author, published_at, display_order, category, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [slug, title, excerpt, sanitizedContent, featured_image, author, published_at, finalDisplayOrder, category, tagsValue]
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
// Protected: Admin only
router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {
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
            'published_at',
            'display_order',
            'category',
            'tags'
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
            
            if (field === 'content') {
                value = sanitizeHtml(value, sanitizeOptions);
            } else if (field === 'tags') {
                // Handle tags - convert to JSON string if array
                if (Array.isArray(value)) {
                    value = JSON.stringify(value);
                } else if (typeof value === 'string' && !value.startsWith('[')) {
                    value = JSON.stringify(value.split(',').map(t => t.trim()).filter(t => t));
                }
            }
            
            params.push(value);
            setClauses.push(`"${field}" = $${idx}`);
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

// POST /api/tips/reorder - Reorder multiple articles at once
// Protected: Admin only
router.post('/reorder', authenticate, authorize(['admin']), async (req, res) => {
    try {
        const { items } = req.body;

        // Validate input: expect array of { id, display_order }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'items array is required with format: [{ id, display_order }, ...]'
            });
        }

        // Validate each item
        for (const item of items) {
            if (!item.id || item.display_order === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Each item must have id and display_order'
                });
            }
        }

        // Use transaction for atomic update
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const updatedItems = [];
            for (const item of items) {
                const result = await client.query(
                    'UPDATE tips SET display_order = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, display_order',
                    [item.display_order, item.id]
                );
                if (result.rows.length > 0) {
                    updatedItems.push(result.rows[0]);
                }
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `${updatedItems.length} articles reordered successfully`,
                data: updatedItems
            });
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// DELETE /api/tips/:id - Delete article
// Protected: Admin only
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
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
