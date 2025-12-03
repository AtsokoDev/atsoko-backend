const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// PATCH /api/propertyUpdate/:id
router.patch('/:id', async(req, res) => {
    try {
        const { id } = req.params;
        const allowedFields = [
            'title', 'type', 'status', 'labels', 'province', 'district', 'sub_district',
            'location', 'price', 'price_postfix', 'size', 'size_prefix', 'terms_conditions',
            'warehouse_length', 'electricity_system', 'clear_height', 'features', 'landlord_name',
            'landlord_contact', 'agent_team', 'coordinates', 'floor_load', 'land_size', 'land_postfix',
            'remarks', 'slug', 'images'
        ];

        const fields = [];
        const params = [];
        let idx = 1;

        for (const key of allowedFields) {
            if (req.body[key] !== undefined) {
                fields.push(`"${key}" = $${idx++}`);
                params.push(req.body[key]);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        // Update updated_at timestamp
        fields.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(id); // WHERE id
        const query = `
      UPDATE properties
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `;

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

module.exports = router;