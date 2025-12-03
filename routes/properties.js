const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET all properties with filters
router.get('/', async (req, res) => {
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
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let result;

    // Check if id is numeric
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

module.exports = router;
