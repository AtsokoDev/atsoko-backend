/**
 * Options Routes
 * Provides endpoints for cascading dropdowns (types, statuses, locations)
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

/**
 * GET /api/options/types
 * Returns all property types with multi-language names
 */
router.get('/types', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name FROM master_types ORDER BY name->>\'en\''
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name  // Full JSONB object
            }))
        });
    } catch (error) {
        console.error('Error fetching types:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/statuses
 * Returns all property statuses with multi-language names
 */
router.get('/statuses', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name FROM master_statuses ORDER BY id'
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name
            }))
        });
    } catch (error) {
        console.error('Error fetching statuses:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/provinces
 * Returns all provinces (level = 'province') with multi-language names
 */
router.get('/provinces', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT id, name 
      FROM master_locations 
      WHERE level = 'province' 
      ORDER BY name->>'en'
    `);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name
            }))
        });
    } catch (error) {
        console.error('Error fetching provinces:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/districts/:provinceId
 * Returns districts for a specific province
 */
router.get('/districts/:provinceId', async (req, res) => {
    try {
        const { provinceId } = req.params;

        // Validate provinceId
        const provinceIdNum = parseInt(provinceId, 10);
        if (isNaN(provinceIdNum) || provinceIdNum < 1) {
            return res.status(400).json({ success: false, error: 'Invalid province ID' });
        }

        const result = await pool.query(`
      SELECT id, name 
      FROM master_locations 
      WHERE level = 'district' AND parent_id = $1
      ORDER BY name->>'en'
    `, [provinceIdNum]);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name
            })),
            province_id: provinceIdNum
        });
    } catch (error) {
        console.error('Error fetching districts:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/subdistricts/:districtId
 * Returns subdistricts for a specific district
 */
router.get('/subdistricts/:districtId', async (req, res) => {
    try {
        const { districtId } = req.params;

        // Validate districtId
        const districtIdNum = parseInt(districtId, 10);
        if (isNaN(districtIdNum) || districtIdNum < 1) {
            return res.status(400).json({ success: false, error: 'Invalid district ID' });
        }

        const result = await pool.query(`
      SELECT id, name 
      FROM master_locations 
      WHERE level = 'subdistrict' AND parent_id = $1
      ORDER BY name->>'en'
    `, [districtIdNum]);

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name
            })),
            district_id: districtIdNum
        });
    } catch (error) {
        console.error('Error fetching subdistricts:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/location/:id
 * Get full location hierarchy by subdistrict ID
 */
router.get('/location/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const idNum = parseInt(id, 10);
        if (isNaN(idNum) || idNum < 1) {
            return res.status(400).json({ success: false, error: 'Invalid location ID' });
        }

        // Get location with its full hierarchy
        const result = await pool.query(`
      WITH RECURSIVE location_tree AS (
        SELECT id, parent_id, level, name
        FROM master_locations
        WHERE id = $1
        
        UNION ALL
        
        SELECT ml.id, ml.parent_id, ml.level, ml.name
        FROM master_locations ml
        INNER JOIN location_tree lt ON ml.id = lt.parent_id
      )
      SELECT level, id, name FROM location_tree ORDER BY 
        CASE level 
          WHEN 'province' THEN 1 
          WHEN 'district' THEN 2 
          WHEN 'subdistrict' THEN 3 
        END
    `, [idNum]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }

        const hierarchy = {};
        for (const row of result.rows) {
            hierarchy[row.level] = {
                id: row.id,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name
            };
        }

        res.json({
            success: true,
            data: hierarchy
        });
    } catch (error) {
        console.error('Error fetching location hierarchy:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/features
 * Returns all features with multi-language names
 * Query: ?category=feature|zone (optional, filter by category)
 */
router.get('/features', async (req, res) => {
    try {
        // Fetch distinct features from properties table
        const result = await pool.query('SELECT DISTINCT features FROM properties');
        const uniqueSet = new Set();

        result.rows.forEach(row => {
            if (!row.features) return;
            let list = [];
            // Handle JSON string or pipe/comma separated
            if (row.features.trim().startsWith('[')) {
                try {
                    list = JSON.parse(row.features);
                } catch (e) {
                    list = [row.features];
                }
            } else {
                list = row.features.split(/[|,]/);
            }

            list.forEach(item => {
                let trimmed = item.trim();
                // Remove surrounding quotes if any
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                    trimmed = trimmed.slice(1, -1);
                }
                // Filter out invalid or junk data like '99' or JSON artifacts
                if (trimmed &&
                    trimmed !== '99' &&
                    !trimmed.startsWith('{') &&
                    !trimmed.includes('{\\"')
                ) {
                    uniqueSet.add(trimmed);
                }
            });
        });

        const sorted = Array.from(uniqueSet).sort();

        res.json({
            success: true,
            data: sorted.map((name, index) => ({
                id: index + 1,
                name_en: name,
                name_th: name, // Default to name_en if no translation
                name_zh: name,
                name: { en: name, th: name, zh: name }
            }))
        });
    } catch (error) {
        console.error('Error fetching features:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/electricity
 * Returns all electricity system options with multi-language names
 */
router.get('/electricity', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name FROM master_electricity ORDER BY sort_order'
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name
            }))
        });
    } catch (error) {
        console.error('Error fetching electricity:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/clear-height
 * Returns all clear height options with multi-language names
 */
router.get('/clear-height', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, value, name FROM master_clear_height ORDER BY sort_order'
        );

        res.json({
            success: true,
            data: result.rows.map(row => ({
                id: row.id,
                value: row.value,
                name_en: row.name.en,
                name_th: row.name.th,
                name_zh: row.name.zh,
                name: row.name
            }))
        });
    } catch (error) {
        console.error('Error fetching clear height:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/floor-load
 * Returns distinct floor load options from properties
 */
router.get('/floor-load', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT DISTINCT floor_load FROM properties WHERE floor_load IS NOT NULL AND floor_load != '' ORDER BY floor_load"
        );
        res.json({
            success: true,
            data: result.rows.map((row, index) => ({
                id: index + 1,
                name_en: row.floor_load,
                name_th: row.floor_load,
                name_zh: row.floor_load,
                value: row.floor_load
            }))
        });
    } catch (error) {
        console.error('Error fetching floor load:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

/**
 * GET /api/options/terms
 * Returns distinct terms & conditions from properties
 */
router.get('/terms', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT terms_conditions FROM properties WHERE terms_conditions IS NOT NULL AND terms_conditions != ''"
        );

        // Deduplicate in JS to handle whitespace better
        const uniqueTerms = new Set();
        result.rows.forEach(row => {
            if (row.terms_conditions) {
                const trimmed = row.terms_conditions.trim();
                if (trimmed) uniqueTerms.add(trimmed);
            }
        });

        const sorted = Array.from(uniqueTerms).sort();

        res.json({
            success: true,
            data: sorted.map((term, index) => ({
                id: index + 1,
                name_en: term,
                name_th: term,
                name_zh: term,
                value: term
            }))
        });
    } catch (error) {
        console.error('Error fetching terms:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// Get agent teams
router.get('/teams', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT team FROM (
                SELECT agent_team as team FROM properties WHERE agent_team IS NOT NULL AND agent_team != ''
                UNION
                SELECT team FROM users WHERE team IS NOT NULL AND team != ''
            ) t
            ORDER BY team
        `;
        const result = await pool.query(query);

        // Format to match other options structure
        const teams = result.rows.map((row, index) => ({
            id: index + 1,
            name_en: row.team,
            name_th: row.team, // use same name
            value: row.team
        }));
        res.json({ success: true, data: teams });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
