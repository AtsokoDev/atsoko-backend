const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Helper function to validate and sanitize numeric input
const validateNumber = (value, fieldName) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
        throw new Error(`Invalid ${fieldName}: must be a positive number`);
    }
    return num;
};

// Helper function to validate and sanitize integer input
const validateInteger = (value, fieldName, min = 1, max = null) => {
    const num = parseInt(value);
    if (isNaN(num) || num < min || (max && num > max)) {
        throw new Error(`Invalid ${fieldName}: must be an integer between ${min} and ${max || 'infinity'}`);
    }
    return num;
};

// Helper function to sanitize ILIKE patterns
const sanitizePattern = (value) => {
    // Escape special characters for ILIKE
    return value.replace(/[%_]/g, '\\$&');
};

// GET all properties with filters
router.get('/', async (req, res) => {
    try {
        const { type, province, district, min_price, max_price, min_size, max_size, page = 1, limit = 20 } = req.query;

        // Validate pagination parameters
        const validatedPage = validateInteger(page, 'page', 1);
        const validatedLimit = validateInteger(limit, 'limit', 1, 100); // Max 100 items per page

        let query = 'SELECT * FROM properties WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM properties WHERE 1=1';
        const params = [];
        const countParams = [];
        let paramCount = 1;

        if (type) {
            const sanitizedType = sanitizePattern(type);
            query += ` AND type ILIKE $${paramCount}`;
            countQuery += ` AND type ILIKE $${paramCount}`;
            params.push(`%${sanitizedType}%`);
            countParams.push(`%${sanitizedType}%`);
            paramCount++;
        }
        if (province) {
            const sanitizedProvince = sanitizePattern(province);
            query += ` AND province ILIKE $${paramCount}`;
            countQuery += ` AND province ILIKE $${paramCount}`;
            params.push(`%${sanitizedProvince}%`);
            countParams.push(`%${sanitizedProvince}%`);
            paramCount++;
        }
        if (district) {
            const sanitizedDistrict = sanitizePattern(district);
            query += ` AND district ILIKE $${paramCount}`;
            countQuery += ` AND district ILIKE $${paramCount}`;
            params.push(`%${sanitizedDistrict}%`);
            countParams.push(`%${sanitizedDistrict}%`);
            paramCount++;
        }
        if (min_price) {
            const validatedMinPrice = validateNumber(min_price, 'min_price');
            query += ` AND price >= $${paramCount}`;
            countQuery += ` AND price >= $${paramCount}`;
            params.push(validatedMinPrice);
            countParams.push(validatedMinPrice);
            paramCount++;
        }
        if (max_price) {
            const validatedMaxPrice = validateNumber(max_price, 'max_price');
            query += ` AND price <= $${paramCount}`;
            countQuery += ` AND price <= $${paramCount}`;
            params.push(validatedMaxPrice);
            countParams.push(validatedMaxPrice);
            paramCount++;
        }
        if (min_size) {
            const validatedMinSize = validateNumber(min_size, 'min_size');
            query += ` AND size >= $${paramCount}`;
            countQuery += ` AND size >= $${paramCount}`;
            params.push(validatedMinSize);
            countParams.push(validatedMinSize);
            paramCount++;
        }
        if (max_size) {
            const validatedMaxSize = validateNumber(max_size, 'max_size');
            query += ` AND size <= $${paramCount}`;
            countQuery += ` AND size <= $${paramCount}`;
            params.push(validatedMaxSize);
            countParams.push(validatedMaxSize);
            paramCount++;
        }

        // Add ordering and pagination
        query += ` ORDER BY id LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(validatedLimit, (validatedPage - 1) * validatedLimit);

        // Execute both queries
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

// GET property by ID or property_id
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        let result;

        if (/^\d+$/.test(id)) {
            result = await pool.query('SELECT * FROM properties WHERE id = $1', [parseInt(id)]);
        } else {
            result = await pool.query('SELECT * FROM properties WHERE property_id = $1', [id]);
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// PUT /api/properties/:id
// TODO: Add authentication middleware to protect this route
router.put('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        // Validate request body exists
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, error: 'Request body is empty' });
        }

        const allowedFields = [
            "property_id", "title", "date", "type",
            "status",
            "labels",
            "country",
            "province",
            "district",
            "sub_district",
            "location",
            "price",
            "price_postfix",
            "size",
            "size_prefix",
            "terms_conditions",
            "warehouse_length",
            "electricity_system",
            "clear_height",
            "features",
            "landlord_name",
            "landlord_contact",
            "agent_team",
            "coordinates",
            "floor_load",
            "land_size",
            "land_postfix",
            "remarks",
            "slug",
            "images"
            // Note: created_at and updated_at should not be manually updated
        ];

        const fieldsToUpdate = Object.keys(data).filter(key => allowedFields.includes(key));
        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        // Build the SET clause using parameterized queries
        const setClauses = [];
        const params = [];
        let idx = 1;

        fieldsToUpdate.forEach(field => {
            setClauses.push(`"${field}" = $${idx}`);
            params.push(data[field]);
            idx++;
        });

        // Automatically update the updated_at field
        setClauses.push(`"updated_at" = NOW()`);

        const setQuery = setClauses.join(', ');

        let query = '';
        if (/^\d+$/.test(id)) {
            query = `UPDATE properties SET ${setQuery} WHERE id = $${idx} RETURNING *`;
            params.push(Number(id));
        } else {
            query = `UPDATE properties SET ${setQuery} WHERE property_id = $${idx} RETURNING *`;
            params.push(id);
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        res.json({ success: true, data: result.rows[0], message: 'Property updated successfully' });

    } catch (error) {
        console.error(error);
        // Check for specific database errors
        if (error.code === '23505') {
            return res.status(409).json({ success: false, error: 'Duplicate property_id or slug' });
        }
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// DELETE /api/properties/:id
// TODO: Add authentication middleware to protect this route
router.delete('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        let query = '';
        let params = [];

        // Check if id is numeric (internal id) or string (property_id)
        if (/^\d+$/.test(id)) {
            query = 'DELETE FROM properties WHERE id = $1 RETURNING *';
            params = [Number(id)];
        } else {
            query = 'DELETE FROM properties WHERE property_id = $1 RETURNING *';
            params = [id];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        res.json({
            success: true,
            message: 'Property deleted successfully',
            data: result.rows[0] // Return the deleted property data
        });

    } catch (error) {
        console.error(error);
        // Check for foreign key constraint violations
        if (error.code === '23503') {
            return res.status(409).json({
                success: false,
                error: 'Cannot delete property due to existing references'
            });
        }
        res.status(500).json({ success: false, error: 'Database error' });
    }
});


module.exports = router;