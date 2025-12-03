const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET all properties with filters
router.get('/', async(req, res) => {
    try {
        const { type, province, district, min_price, max_price, min_size, max_size, page = 1, limit = 20 } = req.query;

        let query = 'SELECT * FROM properties WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (type) {
            query += ` AND type ILIKE $${paramCount}`;
            params.push(`%${type}%`);
            paramCount++;
        }
        if (province) {
            query += ` AND province ILIKE $${paramCount}`;
            params.push(`%${province}%`);
            paramCount++;
        }
        if (district) {
            query += ` AND district ILIKE $${paramCount}`;
            params.push(`%${district}%`);
            paramCount++;
        }
        if (min_price) {
            query += ` AND price >= $${paramCount}`;
            params.push(parseFloat(min_price));
            paramCount++;
        }
        if (max_price) {
            query += ` AND price <= $${paramCount}`;
            params.push(parseFloat(max_price));
            paramCount++;
        }
        if (min_size) {
            query += ` AND size >= $${paramCount}`;
            params.push(parseFloat(min_size));
            paramCount++;
        }
        if (max_size) {
            query += ` AND size <= $${paramCount}`;
            params.push(parseFloat(max_size));
            paramCount++;
        }

        query += ` ORDER BY id LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const result = await pool.query(query, params);

        const countResult = await pool.query('SELECT COUNT(*) FROM properties WHERE 1=1');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// GET property by ID or property_id
router.get('/:id', async(req, res) => {
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
router.put('/:id', async(req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

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
            "images",
            "created_at",
            "updated_at"
        ];


        const fieldsToUpdate = Object.keys(data).filter(key => allowedFields.includes(key));
        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        let setQuery = '';
        const params = [];
        let idx = 1;

        fieldsToUpdate.forEach(field => {
            setQuery += `"${field}" = $${idx}, `;
            params.push(data[field]);
            idx++;
        });
        setQuery = setQuery.slice(0, -2);

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

        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// ✅ เอา module.exports ออกมาทีเดียว
module.exports = router;