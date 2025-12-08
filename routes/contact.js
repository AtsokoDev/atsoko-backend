const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { contactFormLimiter } = require('../middleware/rateLimiter');

// Helper function to validate integer
const validateInteger = (value, fieldName, min = 1, max = null) => {
    const num = parseInt(value);
    if (isNaN(num) || num < min || (max && num > max)) {
        throw new Error(`Invalid ${fieldName}: must be an integer between ${min} and ${max || 'infinity'}`);
    }
    return num;
};

// Helper function to validate email format
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// POST /api/contact - Submit contact form (public with rate limiting)
router.post('/', contactFormLimiter, async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            subject,
            message
        } = req.body;

        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, email, message'
            });
        }

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Get IP address and user agent for tracking
        const ip_address = req.ip || req.connection.remoteAddress;
        const user_agent = req.get('User-Agent');

        const result = await pool.query(
            `INSERT INTO contact_messages 
             (name, email, phone, subject, message, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, email, phone, subject, message, ip_address, user_agent]
        );

        // Send email notification to admin
        const { sendContactNotification } = require('../utils/emailService');
        const emailResult = await sendContactNotification(result.rows[0]);

        // Log email result (but don't fail if email fails)
        if (emailResult.skipped) {
            console.log(`⚠️ Email skipped: ${emailResult.reason}`);
        } else if (emailResult.error) {
            console.error(`❌ Email error: ${emailResult.error}`);
        }

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Contact message submitted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// GET /api/contact - List all messages (admin only)
// TODO: Add authentication middleware to protect this route
router.get('/', async (req, res) => {
    try {
        const {
            status,
            page = 1,
            limit = 50
        } = req.query;

        const validatedPage = validateInteger(page, 'page', 1);
        const validatedLimit = validateInteger(limit, 'limit', 1, 100);

        let query = 'SELECT * FROM contact_messages WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM contact_messages WHERE 1=1';
        const params = [];
        const countParams = [];
        let paramCount = 1;

        // Filter by status
        if (status) {
            query += ` AND status = $${paramCount}`;
            countQuery += ` AND status = $${paramCount}`;
            params.push(status);
            countParams.push(status);
            paramCount++;
        }

        // Order by created_at (newest first)
        query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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

// GET /api/contact/:id - Get single message (admin only)
// TODO: Add authentication middleware to protect this route
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'SELECT * FROM contact_messages WHERE id = $1',
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
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

// PUT /api/contact/:id - Update message status (admin only)
// TODO: Add authentication middleware to protect this route
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required'
            });
        }

        // Validate status value
        const validStatuses = ['new', 'read', 'replied', 'archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const result = await pool.query(
            `UPDATE contact_messages 
             SET status = $1, updated_at = NOW() 
             WHERE id = $2 
             RETURNING *`,
            [status, parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Message status updated successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// DELETE /api/contact/:id - Delete message (admin only)
// TODO: Add authentication middleware to protect this route
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM contact_messages WHERE id = $1 RETURNING *',
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        res.json({
            success: true,
            message: 'Message deleted successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

module.exports = router;
