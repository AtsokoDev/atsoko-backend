const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET statistics
router.get('/', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_properties,
        COUNT(DISTINCT type) as total_types,
        COUNT(DISTINCT province) as total_provinces,
        AVG(price) as avg_price,
        AVG(size) as avg_size
      FROM properties
    `);
    
    const typeStats = await pool.query(`
      SELECT type, COUNT(*) as count
      FROM properties
      WHERE type IS NOT NULL
      GROUP BY type
      ORDER BY count DESC
    `);

    const provinceStats = await pool.query(`
      SELECT province, COUNT(*) as count
      FROM properties
      WHERE province IS NOT NULL
      GROUP BY province
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({ 
      success: true, 
      data: {
        overview: stats.rows[0],
        by_type: typeStats.rows,
        by_province: provinceStats.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

module.exports = router;
