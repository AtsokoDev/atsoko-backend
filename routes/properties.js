const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const {
    authenticate,
    optionalAuth,
    authorize,
    canModifyProperty,
    canDeleteProperty,
    getPropertyPermissions,
    removeSecretFields
} = require('../middleware/auth');
const { generateTitles } = require('../services/titleGenerator');

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

/**
 * Find the next available property number.
 * This function looks for "gaps" in existing property IDs (e.g., if AT1R, AT3R exist, it returns 2)
 * If no gaps exist, it returns max + 1.
 * 
 * @param {Object} client - Database client (from transaction) or pool
 * @returns {Promise<number>} - The next available number to use
 * 
 * Algorithm:
 * 1. Extract all numbers from existing property_id (ignoring R/S/SR suffix)
 * 2. Find the smallest missing number in the sequence
 * 3. If no gaps, use max + 1
 */
const findNextAvailablePropertyNumber = async (client) => {
    // Query to find the first available (missing) number
    // This uses generate_series to create a sequence and LEFT JOIN to find gaps
    const query = `
        WITH used_numbers AS (
            -- Extract numbers from property_id (format: AT{number}{R|S|SR})
            SELECT DISTINCT
                CAST(SUBSTRING(property_id FROM '^AT([0-9]+)') AS INTEGER) as num
            FROM properties 
            WHERE property_id ~ '^AT[0-9]+(R|S|SR)$'
        ),
        max_num AS (
            SELECT COALESCE(MAX(num), 0) as max_val FROM used_numbers
        ),
        all_numbers AS (
            -- Generate series from 1 to max (or 1 if empty)
            SELECT generate_series(1, GREATEST((SELECT max_val FROM max_num), 1)) as num
        )
        -- Find the first missing number, or max + 1 if no gaps
        SELECT 
            COALESCE(
                (SELECT a.num FROM all_numbers a 
                 LEFT JOIN used_numbers u ON a.num = u.num 
                 WHERE u.num IS NULL 
                 ORDER BY a.num ASC 
                 LIMIT 1),
                (SELECT max_val + 1 FROM max_num)
            ) as next_number
    `;

    const result = await client.query(query);
    return result.rows[0].next_number;
};

// GET /api/properties/remarks-suggestions
// Autocomplete endpoint for remarks field (Admin only)
router.get('/remarks-suggestions', authenticate, async (req, res) => {
    try {
        const { q } = req.query; // q = query string ที่ user พิมพ์

        // เช็คว่าเป็น admin เท่านั้น
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Only admins can search remarks'
            });
        }

        // ถ้าไม่มีคำค้นหา หรือสั้นเกินไป
        if (!q || q.trim().length < 2) {
            return res.json({
                success: true,
                data: []
            });
        }

        const sanitizedQuery = sanitizePattern(q);

        // Query เพื่อหา remarks ที่ตรงกับคำค้นหา
        const query = `
            SELECT DISTINCT remarks 
            FROM properties 
            WHERE remarks IS NOT NULL 
              AND remarks != '' 
              AND remarks ILIKE $1
            ORDER BY remarks
            LIMIT 10
        `;

        const result = await pool.query(query, [`%${sanitizedQuery}%`]);

        // ส่งกลับเฉพาะ remarks ที่ไม่ซ้ำกัน
        const suggestions = result.rows.map(row => row.remarks);

        res.json({
            success: true,
            data: suggestions
        });

    } catch (error) {
        console.error('Error fetching remarks suggestions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch suggestions'
        });
    }
});

// GET all properties with filters
// Uses optionalAuth - guests can access but won't see secret fields
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            keyword,           // Search by title
            remarks,           // Search by remarks (Admin only)
            property_id,       // Search by property_id (partial match)
            status,            // Rent or Sale
            type,              // Warehouse or Factory
            province,
            district,
            sub_district,      // Subdistrict filter
            // Size filters - support both naming conventions
            min_size,          // Area min (legacy)
            max_size,          // Area max (legacy)
            size_min,          // Area min (frontend)
            size_max,          // Area max (frontend)
            // Price filters - support both naming conventions
            min_price,         // Price min (legacy)
            max_price,         // Price max (legacy)
            price_min,         // Price min (frontend)
            price_max,         // Price max (frontend)
            // Feature filters
            features,          // Features array (comma-separated or array)
            feature,           // Single feature filter (frontend)
            // Label/Zone filters
            labels,            // Zone Type (database column name)
            zone_type,         // Zone Type (frontend name)
            // Height filters
            min_height,        // Clear height min
            max_height,        // Clear height max
            clear_height,      // Clear height exact match (frontend)
            // Other filters
            floor_load,        // Floor loading
            // Sorting options (no defaults - handled in sorting logic below)
            sort,              // Sort field or combined format (e.g., 'updated_desc', 'price_asc')
            order,             // Sort order ('asc' or 'desc') - for legacy format only
            page = 1,
            limit
        } = req.query;

        // Use frontend naming if provided, fallback to legacy
        const effectiveMinSize = size_min || min_size;
        const effectiveMaxSize = size_max || max_size;
        const effectiveMinPrice = price_min || min_price;
        const effectiveMaxPrice = price_max || max_price;
        const effectiveLabelsParam = labels || zone_type; // For response object


        // Validate pagination parameters
        const validatedPage = validateInteger(page, 'page', 1);

        // If limit is not provided or is 0, return all results
        // Otherwise, validate and cap at 1000 for performance
        let validatedLimit;
        if (!limit || limit === '0' || parseInt(limit) === 0) {
            validatedLimit = null; // No limit - return all
        } else {
            validatedLimit = validateInteger(limit, 'limit', 1, 1000); // Max 1000 items per page
        }

        let query = 'SELECT * FROM properties WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM properties WHERE 1=1';
        const params = [];
        const countParams = [];
        let paramCount = 1;

        // Authorization filters based on user role
        if (!req.user) {
            // Guest: only see published properties
            query += ` AND approve_status = 'published'`;
            countQuery += ` AND approve_status = 'published'`;
        } else if (req.user.role === 'agent') {
            // Agent: see their team's properties (any status)
            query += ` AND agent_team = $${paramCount}`;
            countQuery += ` AND agent_team = $${paramCount}`;
            params.push(req.user.team);
            countParams.push(req.user.team);
            paramCount++;
        }
        // Admin: can see all properties (no filter needed)

        // 1. Keyword search in title, property_id, and remarks
        if (keyword) {
            const sanitizedKeyword = sanitizePattern(keyword);
            query += ` AND (title ILIKE $${paramCount} OR property_id ILIKE $${paramCount} OR remarks ILIKE $${paramCount})`;
            countQuery += ` AND (title ILIKE $${paramCount} OR property_id ILIKE $${paramCount} OR remarks ILIKE $${paramCount})`;
            params.push(`%${sanitizedKeyword}%`);
            countParams.push(`%${sanitizedKeyword}%`);
            paramCount++;
        }

        // 1b. Property ID search (partial match)
        if (property_id) {
            const sanitizedPropertyId = sanitizePattern(property_id);
            query += ` AND property_id ILIKE $${paramCount}`;
            countQuery += ` AND property_id ILIKE $${paramCount}`;
            params.push(`%${sanitizedPropertyId}%`);
            countParams.push(`%${sanitizedPropertyId}%`);
            paramCount++;
        }

        // 1c. Remarks-only search (Admin only)
        if (remarks) {
            // เช็คว่าเป็น admin เท่านั้น
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only admins can search remarks'
                });
            }

            const sanitizedRemarks = sanitizePattern(remarks);
            query += ` AND remarks ILIKE $${paramCount}`;
            countQuery += ` AND remarks ILIKE $${paramCount}`;
            params.push(`%${sanitizedRemarks}%`);
            countParams.push(`%${sanitizedRemarks}%`);
            paramCount++;
        }

        // 2. Status filter (Rent or Sale)
        if (status) {
            const sanitizedStatus = sanitizePattern(status);
            query += ` AND status ILIKE $${paramCount}`;
            countQuery += ` AND status ILIKE $${paramCount}`;
            params.push(`%${sanitizedStatus}%`);
            countParams.push(`%${sanitizedStatus}%`);
            paramCount++;
        }

        // 3. Type filter (Warehouse or Factory)
        // Special: "Warehouse" shows ALL, "Factory" filters only Factory
        if (type && type.toLowerCase() !== 'warehouse') {
            const sanitizedType = sanitizePattern(type);
            query += ` AND type ILIKE $${paramCount}`;
            countQuery += ` AND type ILIKE $${paramCount}`;
            params.push(`%${sanitizedType}%`);
            countParams.push(`%${sanitizedType}%`);
            paramCount++;
        }

        // 4. Province filter (supports multiselect with comma-separated values)
        if (province) {
            // Convert to array (supports both comma-separated string and array)
            const provinceArray = Array.isArray(province)
                ? province
                : province.split(',').map(p => p.trim()).filter(p => p);

            if (provinceArray.length === 1) {
                // Single value - use original logic
                const sanitizedProvince = sanitizePattern(provinceArray[0]);
                query += ` AND province ILIKE $${paramCount}`;
                countQuery += ` AND province ILIKE $${paramCount}`;
                params.push(`%${sanitizedProvince}%`);
                countParams.push(`%${sanitizedProvince}%`);
                paramCount++;
            } else if (provinceArray.length > 1) {
                // Multiple values - use OR logic
                const orConditions = [];
                const countOrConditions = [];
                provinceArray.forEach(p => {
                    const sanitizedProvince = sanitizePattern(p);
                    orConditions.push(`province ILIKE $${paramCount}`);
                    countOrConditions.push(`province ILIKE $${paramCount}`);
                    params.push(`%${sanitizedProvince}%`);
                    countParams.push(`%${sanitizedProvince}%`);
                    paramCount++;
                });
                query += ` AND (${orConditions.join(' OR ')})`;
                countQuery += ` AND (${countOrConditions.join(' OR ')})`;
            }
        }

        // 5. District filter (supports multiselect with comma-separated values)
        if (district) {
            // Convert to array (supports both comma-separated string and array)
            const districtArray = Array.isArray(district)
                ? district
                : district.split(',').map(d => d.trim()).filter(d => d);

            if (districtArray.length === 1) {
                // Single value - use original logic
                const sanitizedDistrict = sanitizePattern(districtArray[0]);
                query += ` AND district ILIKE $${paramCount}`;
                countQuery += ` AND district ILIKE $${paramCount}`;
                params.push(`%${sanitizedDistrict}%`);
                countParams.push(`%${sanitizedDistrict}%`);
                paramCount++;
            } else if (districtArray.length > 1) {
                // Multiple values - use OR logic
                const orConditions = [];
                const countOrConditions = [];
                districtArray.forEach(d => {
                    const sanitizedDistrict = sanitizePattern(d);
                    orConditions.push(`district ILIKE $${paramCount}`);
                    countOrConditions.push(`district ILIKE $${paramCount}`);
                    params.push(`%${sanitizedDistrict}%`);
                    countParams.push(`%${sanitizedDistrict}%`);
                    paramCount++;
                });
                query += ` AND (${orConditions.join(' OR ')})`;
                countQuery += ` AND (${countOrConditions.join(' OR ')})`;
            }
        }

        // 6. Sub-district filter (supports multiselect with comma-separated values)
        if (sub_district) {
            // Convert to array (supports both comma-separated string and array)
            const subDistrictArray = Array.isArray(sub_district)
                ? sub_district
                : sub_district.split(',').map(s => s.trim()).filter(s => s);

            if (subDistrictArray.length === 1) {
                // Single value - use original logic
                const sanitizedSubDistrict = sanitizePattern(subDistrictArray[0]);
                query += ` AND sub_district ILIKE $${paramCount}`;
                countQuery += ` AND sub_district ILIKE $${paramCount}`;
                params.push(`%${sanitizedSubDistrict}%`);
                countParams.push(`%${sanitizedSubDistrict}%`);
                paramCount++;
            } else if (subDistrictArray.length > 1) {
                // Multiple values - use OR logic
                const orConditions = [];
                const countOrConditions = [];
                subDistrictArray.forEach(s => {
                    const sanitizedSubDistrict = sanitizePattern(s);
                    orConditions.push(`sub_district ILIKE $${paramCount}`);
                    countOrConditions.push(`sub_district ILIKE $${paramCount}`);
                    params.push(`%${sanitizedSubDistrict}%`);
                    countParams.push(`%${sanitizedSubDistrict}%`);
                    paramCount++;
                });
                query += ` AND (${orConditions.join(' OR ')})`;
                countQuery += ` AND (${countOrConditions.join(' OR ')})`;
            }
        }

        // 7. Area (Size) filter - Min (supports both min_size and size_min)
        if (effectiveMinSize) {
            const validatedMinSize = validateNumber(effectiveMinSize, 'size_min');
            query += ` AND size >= $${paramCount}`;
            countQuery += ` AND size >= $${paramCount}`;
            params.push(validatedMinSize);
            countParams.push(validatedMinSize);
            paramCount++;
        }

        // 8. Area (Size) filter - Max (supports both max_size and size_max)
        if (effectiveMaxSize) {
            const validatedMaxSize = validateNumber(effectiveMaxSize, 'size_max');
            query += ` AND size <= $${paramCount}`;
            countQuery += ` AND size <= $${paramCount}`;
            params.push(validatedMaxSize);
            countParams.push(validatedMaxSize);
            paramCount++;
        }

        // 9. Price filter - Smart selection based on status
        // If status is "sale", use price_alternative, otherwise use price (default for rent)
        const priceField = status && status.toLowerCase().includes('sale') ? 'price_alternative' : 'price';

        if (effectiveMinPrice) {
            const validatedMinPrice = validateNumber(effectiveMinPrice, 'price_min');
            query += ` AND ${priceField} >= $${paramCount}`;
            countQuery += ` AND ${priceField} >= $${paramCount}`;
            params.push(validatedMinPrice);
            countParams.push(validatedMinPrice);
            paramCount++;
        }

        if (effectiveMaxPrice) {
            const validatedMaxPrice = validateNumber(effectiveMaxPrice, 'price_max');
            query += ` AND ${priceField} <= $${paramCount}`;
            countQuery += ` AND ${priceField} <= $${paramCount}`;
            params.push(validatedMaxPrice);
            countParams.push(validatedMaxPrice);
            paramCount++;
        }

        // 10. Features filter - Array support (expects JSON Array from frontend)
        if (features) {
            // Support both JSON array and comma-separated string
            const featuresArray = Array.isArray(features) ? features : features.split(',').map(f => f.trim());

            // Use JSONB contains operator (@>) to check if all requested features exist
            query += ` AND (features LIKE '[%]' AND features::jsonb @> $${paramCount}::jsonb)`;
            countQuery += ` AND (features LIKE '[%]' AND features::jsonb @> $${paramCount}::jsonb)`;
            params.push(JSON.stringify(featuresArray));
            countParams.push(JSON.stringify(featuresArray));
            paramCount++;
        }

        // 11. Labels / Zone Type Filter (expects JSON Array, stored as JSON Array string)
        const effectiveLabels = labels || zone_type;
        if (effectiveLabels) {
            // Support both JSON array and comma-separated string
            const labelsArray = Array.isArray(effectiveLabels) ? effectiveLabels : effectiveLabels.split(',').map(l => l.trim());

            // Use JSONB contains operator (@>) - same as features
            query += ` AND (labels LIKE '[%]' AND labels::jsonb @> $${paramCount}::jsonb)`;
            countQuery += ` AND (labels LIKE '[%]' AND labels::jsonb @> $${paramCount}::jsonb)`;
            params.push(JSON.stringify(labelsArray));
            countParams.push(JSON.stringify(labelsArray));
            paramCount++;
        }

        // 10b. Single Feature filter (frontend) - ILIKE search for single feature
        if (feature && !features) {
            const sanitizedFeature = sanitizePattern(feature);
            query += ` AND features ILIKE $${paramCount}`;
            countQuery += ` AND features ILIKE $${paramCount}`;
            params.push(`%${sanitizedFeature}%`);
            countParams.push(`%${sanitizedFeature}%`);
            paramCount++;
        }

        // 11. Clear Height filter (NEW) - Min
        // clear_height stored as VARCHAR like "6m", "7m" - extract number for comparison
        if (min_height) {
            const validatedMinHeight = validateNumber(min_height, 'min_height');
            query += ` AND clear_height IS NOT NULL AND clear_height != '' AND CAST(REGEXP_REPLACE(clear_height, '[^0-9]', '', 'g') AS INTEGER) >= $${paramCount}`;
            countQuery += ` AND clear_height IS NOT NULL AND clear_height != '' AND CAST(REGEXP_REPLACE(clear_height, '[^0-9]', '', 'g') AS INTEGER) >= $${paramCount}`;
            params.push(validatedMinHeight);
            countParams.push(validatedMinHeight);
            paramCount++;
        }

        // 12. Clear Height filter - Max
        if (max_height) {
            const validatedMaxHeight = validateNumber(max_height, 'max_height');
            query += ` AND clear_height IS NOT NULL AND clear_height != '' AND CAST(REGEXP_REPLACE(clear_height, '[^0-9]', '', 'g') AS INTEGER) <= $${paramCount}`;
            countQuery += ` AND clear_height IS NOT NULL AND clear_height != '' AND CAST(REGEXP_REPLACE(clear_height, '[^0-9]', '', 'g') AS INTEGER) <= $${paramCount}`;
            params.push(validatedMaxHeight);
            countParams.push(validatedMaxHeight);
            paramCount++;
        }

        // 12b. Clear Height filter - Exact match (frontend)
        if (clear_height && !min_height && !max_height) {
            const sanitizedClearHeight = sanitizePattern(clear_height);
            query += ` AND clear_height ILIKE $${paramCount}`;
            countQuery += ` AND clear_height ILIKE $${paramCount}`;
            params.push(`%${sanitizedClearHeight}%`);
            countParams.push(`%${sanitizedClearHeight}%`);
            paramCount++;
        }

        // 13. Floor Load filter - Minimum logic (>= selected value)
        if (floor_load) {
            const minFloorLoad = parseFloat(floor_load);
            if (!isNaN(minFloorLoad)) {
                // Extract number from floor_load text (e.g., "3 Ton/sqm" -> 3) and compare >= minimum
                query += ` AND CAST(NULLIF(REGEXP_REPLACE(floor_load, '[^0-9.]', '', 'g'), '') AS DECIMAL) >= $${paramCount}`;
                countQuery += ` AND CAST(NULLIF(REGEXP_REPLACE(floor_load, '[^0-9.]', '', 'g'), '') AS DECIMAL) >= $${paramCount}`;
                params.push(minFloorLoad);
                countParams.push(minFloorLoad);
                paramCount++;
            }
        }



        // ========================================================================
        // SORTING LOGIC
        // Supports two formats:
        // 1. Legacy: ?sort=created_at&order=desc
        // 2. Combined: ?sort=created_desc (field_order format from frontend)
        // ========================================================================

        // Parse sort parameter - check if it contains underscore (combined format)
        let sortField = 'updated_at'; // Default: Last Modified
        let sortOrder = 'DESC';       // Default: Newest first

        if (sort) {
            // Check if sort is in combined format (e.g., "updated_desc", "price_asc")
            if (sort.includes('_')) {
                const parts = sort.split('_');
                const lastPart = parts[parts.length - 1];

                // Check if last part is asc or desc
                if (lastPart === 'asc' || lastPart === 'desc') {
                    sortOrder = lastPart.toUpperCase();
                    sortField = parts.slice(0, -1).join('_'); // Everything except last part
                } else {
                    // Not a valid combined format, treat as legacy field name
                    sortField = sort;
                }
            } else {
                // Legacy format: just field name
                sortField = sort;
            }
        }

        // Override with explicit order parameter if provided (legacy support)
        if (order) {
            sortOrder = (order.toLowerCase() === 'asc') ? 'ASC' : 'DESC';
        }

        // Map frontend field names to database column names
        // Frontend sends: created, updated | Database has: created_at, updated_at
        const fieldMapping = {
            'created': 'created_at',
            'updated': 'updated_at'
        };
        if (fieldMapping[sortField]) {
            sortField = fieldMapping[sortField];
        }

        // Validate sort field
        const allowedSortFields = ['created_at', 'updated_at', 'price', 'size', 'id'];
        const validatedSort = allowedSortFields.includes(sortField) ? sortField : 'updated_at';
        const validatedOrder = sortOrder; // Already validated above

        // Build ORDER BY clause
        let orderByClause;
        if (validatedSort === 'price') {
            // Use priceField (already determined based on status earlier)
            orderByClause = `ORDER BY ${priceField} ${validatedOrder}`;
        } else {
            orderByClause = `ORDER BY ${validatedSort} ${validatedOrder}`;
        }

        // Add ordering and pagination
        if (validatedLimit === null) {
            // No limit - return all results
            query += ` ${orderByClause}`;
        } else {
            // With limit - add pagination
            query += ` ${orderByClause} LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
            params.push(validatedLimit, (validatedPage - 1) * validatedLimit);
        }

        // Execute both queries
        const [result, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
        ]);

        const total = parseInt(countResult.rows[0].count);

        // Hide secret fields for guests
        let responseData = result.rows;
        if (!req.user) {
            responseData = removeSecretFields(responseData);
        }

        res.json({
            success: true,
            data: responseData,
            pagination: {
                page: validatedPage,
                limit: validatedLimit || total, // Show total if no limit
                total,
                pages: validatedLimit ? Math.ceil(total / validatedLimit) : 1
            },
            filters: {
                keyword,
                remarks,
                property_id,
                status,
                type,
                province,
                district,
                sub_district,
                price_range: { min: effectiveMinPrice, max: effectiveMaxPrice, field: priceField },
                size_range: { min: effectiveMinSize, max: effectiveMaxSize },
                height_range: { min: min_height, max: max_height },
                features,
                feature,
                floor_load,
                labels: effectiveLabelsParam,
                zone_type: effectiveLabelsParam
            },
            sorting: {
                sort: validatedSort,
                order: validatedOrder
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
// Uses optionalAuth - guests can access but won't see secret fields
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const id = req.params.id;
        let result;

        // DEBUG: Log authentication state
        console.log('[GET /properties/:id] Property ID:', id);
        console.log('[GET /properties/:id] req.user:', req.user ? {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            team: req.user.team
        } : 'null (GUEST)');
        console.log('[GET /properties/:id] Authorization header:', req.headers.authorization ? req.headers.authorization.substring(0, 30) + '...' : 'none');

        // Build base query
        let baseQuery = 'SELECT * FROM properties WHERE ';
        let params = [];

        if (/^\d+$/.test(id)) {
            baseQuery += 'id = $1';
            params = [parseInt(id)];
        } else {
            baseQuery += 'property_id = $1';
            params = [id];
        }

        // Apply access restrictions
        if (!req.user) {
            // Guest: only published properties
            baseQuery += " AND approve_status = 'published'";
            console.log('[GET /properties/:id] Applying GUEST restrictions (published only)');
        } else if (req.user.role === 'agent') {
            // Agent: only their team's properties
            baseQuery += ' AND agent_team = $2';
            params.push(req.user.team);
            console.log('[GET /properties/:id] Applying AGENT restrictions (team:', req.user.team, ')');
        } else {
            console.log('[GET /properties/:id] ADMIN access - no restrictions');
        }
        // Admin: no restrictions

        result = await pool.query(baseQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        // Hide secret fields for guests
        let responseData = result.rows[0];
        console.log('[GET /properties/:id] Before filtering - landlord_name:', responseData.landlord_name);
        console.log('[GET /properties/:id] Before filtering - landlord_contact:', responseData.landlord_contact);
        console.log('[GET /properties/:id] Before filtering - agent_team:', responseData.agent_team);
        console.log('[GET /properties/:id] Before filtering - coordinates:', responseData.coordinates);

        if (!req.user) {
            console.log('[GET /properties/:id] Removing SECRET_FIELDS for GUEST');
            responseData = removeSecretFields(responseData);
        } else {
            console.log('[GET /properties/:id] User authenticated - SECRET_FIELDS will be INCLUDED');
        }

        console.log('[GET /properties/:id] After filtering - landlord_name:', responseData.landlord_name);
        console.log('[GET /properties/:id] After filtering - landlord_contact:', responseData.landlord_contact);

        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// POST /api/properties
// Requires authentication - Admin or Agent
router.post('/', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const data = req.body;

        // Validate request body exists
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, error: 'Request body is empty' });
        }

        // Define required fields (property_id and titles are auto-generated)
        // Can use either legacy text fields OR new ID fields for type/status/location
        const requiredFields = ['type', 'province', 'district', 'sub_district', 'size', 'status'];
        const missingFields = requiredFields.filter(field => !data[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate price based on status
        const statusLower = data.status.toLowerCase();
        const isRent = statusLower.includes('rent');
        const isSale = statusLower.includes('sale');

        if (isRent && isSale) {
            // For Rent & Sale: require both price and price_alternative
            if (!data.price || !data.price_alternative) {
                return res.status(400).json({
                    success: false,
                    error: 'Status "For Rent & Sale" requires both price (rent) and price_alternative (sale)'
                });
            }
        } else if (isRent) {
            // For Rent only: require price
            if (!data.price) {
                return res.status(400).json({
                    success: false,
                    error: 'Status "For Rent" requires price field'
                });
            }
        } else if (isSale) {
            // For Sale only: require price_alternative
            if (!data.price_alternative) {
                return res.status(400).json({
                    success: false,
                    error: 'Status "For Sale" requires price_alternative field'
                });
            }
        }

        // Define all allowed fields (excluding property_id as it will be auto-generated)
        const allowedFields = [
            "title", "date", "type",
            "status",
            "labels",
            "country",
            "province",
            "district",
            "sub_district",
            "location",
            "price",
            "price_postfix",
            "price_alternative",
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
            // New multi-language fields
            "type_id",
            "status_id",
            "subdistrict_id",
            "title_en",
            "title_th",
            "title_zh",
            // Category and Tags
            "category",
            "tags",
            // Workflow fields
            "workflow_status",
            "approve_status"
        ];

        // Filter only allowed fields from request
        let fieldsToInsert = Object.keys(data).filter(key => allowedFields.includes(key));

        if (fieldsToInsert.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields provided' });
        }

        // For agents: force agent_team to their team, approve_status to pending, and workflow_status to pending
        if (req.user.role === 'agent') {
            data.agent_team = req.user.team;
            data.approve_status = 'pending';
            data.workflow_status = 'pending';
            // Ensure these fields are included
            if (!fieldsToInsert.includes('agent_team')) fieldsToInsert.push('agent_team');
            if (!fieldsToInsert.includes('approve_status')) fieldsToInsert.push('approve_status');
            if (!fieldsToInsert.includes('workflow_status')) fieldsToInsert.push('workflow_status');
        } else if (req.user.role === 'admin') {
            // Admin can set any status, default to published if not specified
            if (!data.approve_status) {
                data.approve_status = 'published';
                if (!fieldsToInsert.includes('approve_status')) fieldsToInsert.push('approve_status');
            }
            // Admin default workflow_status
            if (!data.workflow_status) {
                // If approve_status is 'published', set workflow_status to 'ready_to_publish'
                // Otherwise, set to 'pending'
                data.workflow_status = data.approve_status === 'published' ? 'ready_to_publish' : 'pending';
                if (!fieldsToInsert.includes('workflow_status')) fieldsToInsert.push('workflow_status');
            }
        }

        // Helper function to get status code
        const getStatusCode = (status) => {
            if (!status) return 'R';
            const statusLower = status.toLowerCase();
            if (statusLower.includes('rent') && statusLower.includes('sale')) {
                return 'SR';
            } else if (statusLower.includes('sale')) {
                return 'S';
            } else {
                return 'R';
            }
        };

        // Sanitize numeric fields - convert empty strings to null
        const numericFields = ['price', 'size', 'land_size', 'price_alternative'];
        numericFields.forEach(field => {
            if (data[field] === '' || data[field] === null || data[field] === undefined) {
                data[field] = null;
            } else if (typeof data[field] === 'string') {
                // Remove commas and convert to number
                const cleaned = data[field].replace(/,/g, '');
                const num = parseFloat(cleaned);
                data[field] = isNaN(num) ? null : num;
            }
        });

        // ========================================================================
        // Special handling for features - ensure it's stored as valid JSON string
        // ========================================================================
        if (data.features !== undefined) {
            if (Array.isArray(data.features)) {
                data.features = JSON.stringify(data.features);
            } else if (typeof data.features === 'object' && data.features !== null) {
                data.features = JSON.stringify(Object.values(data.features));
            } else if (typeof data.features === 'string') {
                // If it's already a string, check if it's valid JSON
                try {
                    JSON.parse(data.features);
                    // Valid JSON, keep as is
                } catch {
                    // Not valid JSON, treat as comma-separated and convert
                    data.features = JSON.stringify(data.features.split(',').map(f => f.trim()).filter(f => f));
                }
            } else {
                data.features = '[]';
            }
        }

        // ========================================================================
        // Special handling for labels - ensure it's stored as valid JSON string
        // ========================================================================
        if (data.labels !== undefined) {
            if (Array.isArray(data.labels)) {
                data.labels = JSON.stringify(data.labels);
            } else if (typeof data.labels === 'object' && data.labels !== null) {
                data.labels = JSON.stringify(Object.values(data.labels));
            } else if (typeof data.labels === 'string') {
                // If it's already a string, check if it's valid JSON
                try {
                    JSON.parse(data.labels);
                    // Valid JSON, keep as is
                } catch {
                    // Not valid JSON, treat as pipe/comma-separated and convert
                    data.labels = JSON.stringify(data.labels.split(/[|,]/).map(l => l.trim()).filter(l => l));
                }
            } else {
                data.labels = '[]';
            }
        }

        // ========================================================================
        // Special handling for images - ensure it's stored as valid JSON string
        // ========================================================================
        if (data.images !== undefined) {
            if (Array.isArray(data.images)) {
                data.images = JSON.stringify(data.images);
            } else if (typeof data.images === 'object' && data.images !== null) {
                data.images = JSON.stringify(Object.values(data.images));
            } else if (typeof data.images === 'string') {
                // If it's already a string, check if it's valid JSON
                try {
                    JSON.parse(data.images);
                    // Valid JSON, keep as is
                } catch {
                    // Not valid JSON, default to empty array
                    data.images = '[]';
                }
            } else {
                data.images = '[]';
            }
        }

        // ========================================================================
        // Special handling for tags - ensure it's stored as valid JSON string
        // ========================================================================
        if (data.tags !== undefined) {
            if (Array.isArray(data.tags)) {
                data.tags = JSON.stringify(data.tags);
            } else if (typeof data.tags === 'object' && data.tags !== null) {
                data.tags = JSON.stringify(Object.values(data.tags));
            } else if (typeof data.tags === 'string') {
                // If it's already a string, check if it's valid JSON
                try {
                    JSON.parse(data.tags);
                    // Valid JSON, keep as is
                } catch {
                    // Not valid JSON, treat as comma-separated and convert
                    data.tags = JSON.stringify(data.tags.split(',').map(t => t.trim()).filter(t => t));
                }
            } else {
                data.tags = '[]';
            }
        }

        // ========================================================================
        // USE TRANSACTION to prevent race condition when multiple admins create
        // properties simultaneously. This ensures atomic property_id generation.
        // ========================================================================
        const client = await pool.connect();

        try {
            // Start transaction with SERIALIZABLE isolation for maximum safety
            // This prevents two transactions from reading the same "next available number"
            await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');

            // Step 1: Find the next available property number (fills gaps first)
            // Example: if AT1R, AT3R, AT4S exist → returns 2 (the gap)
            // Example: if AT1R, AT2SR, AT3R exist → returns 4 (no gaps, max+1)
            const nextNumber = await findNextAvailablePropertyNumber(client);

            // Step 2: Generate property_id with status code
            const statusCode = getStatusCode(data.status);
            const propertyId = `AT${nextNumber}${statusCode}`;

            console.log(`[CREATE PROPERTY] Generating property_id: ${propertyId} (number: ${nextNumber}, status: ${statusCode})`);

            // Step 3: Generate multi-language titles BEFORE insert (title is NOT NULL)
            let generatedTitles = { title_en: null, title_th: null, title_zh: null };
            try {
                generatedTitles = await generateTitles({
                    type_id: data.type_id,
                    status_id: data.status_id,
                    subdistrict_id: data.subdistrict_id,
                    size: data.size,
                    property_id: propertyId,
                    // Fallback to legacy text fields
                    type: data.type,
                    status: data.status,
                    province: data.province,
                    district: data.district,
                    sub_district: data.sub_district
                });
            } catch (titleError) {
                console.warn('Title generation failed:', titleError.message);
                // Continue with fallback title
            }

            // Use explicit title if provided, otherwise use generated title or fallback
            const finalTitle = data.title || generatedTitles.title_en || `Property ${propertyId}`;

            // Step 4: Build INSERT query with property_id AND titles
            // Filter out title fields from fieldsToInsert to avoid duplicates
            const titleFields = ['title', 'title_en', 'title_th', 'title_zh'];
            const filteredFieldsToInsert = fieldsToInsert.filter(f => !titleFields.includes(f));

            const columnsWithExtras = [...filteredFieldsToInsert, 'property_id', 'title', 'title_en', 'title_th', 'title_zh'];
            const columns = columnsWithExtras.map(field => `"${field}"`).join(', ');
            const placeholders = columnsWithExtras.map((_, idx) => `$${idx + 1}`).join(', ');
            const valuesWithExtras = [
                ...filteredFieldsToInsert.map(field => data[field]),
                propertyId,
                finalTitle,
                generatedTitles.title_en,
                generatedTitles.title_th,
                generatedTitles.title_zh
            ];

            // Step 5: Insert the new property with all data
            const insertQuery = `
                INSERT INTO properties (${columns})
                VALUES (${placeholders})
                RETURNING *
            `;

            const result = await client.query(insertQuery, valuesWithExtras);

            // Step 6: Commit transaction
            await client.query('COMMIT');

            console.log(`[CREATE PROPERTY] Successfully created property: ${propertyId} (id: ${result.rows[0].id})`);

            res.status(201).json({
                success: true,
                data: result.rows[0],
                message: 'Property created successfully'
            });

        } catch (txError) {
            // Rollback on any error
            await client.query('ROLLBACK');

            // If it's a serialization failure (race condition), suggest retry
            if (txError.code === '40001') {
                console.warn('[CREATE PROPERTY] Serialization conflict, client should retry');
                return res.status(409).json({
                    success: false,
                    error: 'Concurrent modification detected. Please try again.',
                    retryable: true
                });
            }

            // Re-throw other errors to be handled by outer catch
            throw txError;
        } finally {
            // Always release the client back to the pool
            client.release();
        }

    } catch (error) {
        console.error(error);
        // Check for duplicate property_id or slug
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Property with this property_id or slug already exists'
            });
        }
        // Check for foreign key violations
        if (error.code === '23503') {
            return res.status(400).json({
                success: false,
                error: 'Invalid reference to related data'
            });
        }
        res.status(500).json({ success: false, error: 'Database error' });
    }
});

// PUT /api/properties/:id
// Requires authentication - Admin or Agent
router.put('/:id', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const id = req.params.id;
        const data = req.body;

        // Validate request body exists
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, error: 'Request body is empty' });
        }

        // First, get the property to check permissions
        let selectQuery = 'SELECT * FROM properties WHERE ';
        let selectParams = [];
        if (/^\d+$/.test(id)) {
            selectQuery += 'id = $1';
            selectParams = [parseInt(id)];
        } else {
            selectQuery += 'property_id = $1';
            selectParams = [id];
        }

        const propertyResult = await pool.query(selectQuery, selectParams);
        if (propertyResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const property = propertyResult.rows[0];

        // Check permissions using canModifyProperty
        if (!canModifyProperty(req.user, property)) {
            // Provide helpful error message
            if (req.user.role === 'agent' && property.approve_status === 'published') {
                return res.status(403).json({
                    success: false,
                    error: 'Published properties cannot be edited directly. Please use the Edit Request feature.',
                    requiresRequest: true
                });
            }
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to modify this property'
            });
        }

        let allowedFields = [
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
            "price_alternative",
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
            // New multi-language fields
            "type_id",
            "status_id",
            "subdistrict_id",
            "title_en",
            "title_th",
            "title_zh",
            // Category and Tags
            "category",
            "tags"
        ];

        // Only admin can change approve_status and agent_team
        if (req.user.role === 'admin') {
            allowedFields.push('approve_status');
        } else {
            // Agents cannot change agent_team or approve_status
            allowedFields = allowedFields.filter(f => f !== 'agent_team' && f !== 'approve_status');
        }

        const fieldsToUpdate = Object.keys(data).filter(key => allowedFields.includes(key));
        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        // Sanitize numeric fields - convert empty strings to null
        const numericFields = ['price', 'size', 'land_size', 'price_alternative'];
        numericFields.forEach(field => {
            if (data[field] !== undefined) {
                if (data[field] === '' || data[field] === null) {
                    data[field] = null;
                } else if (typeof data[field] === 'string') {
                    // Remove commas and convert to number
                    const cleaned = data[field].replace(/,/g, '');
                    const num = parseFloat(cleaned);
                    data[field] = isNaN(num) ? null : num;
                }
            }
        });

        // Build the SET clause using parameterized queries
        const setClauses = [];
        const params = [];
        let idx = 1;

        fieldsToUpdate.forEach(field => {
            let value = data[field];

            // Special handling for features - ensure it's a proper array
            if (field === 'features') {
                if (Array.isArray(value)) {
                    value = JSON.stringify(value);
                } else if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(Object.values(value));
                } else if (typeof value === 'string') {
                    // If it's a string, check if it's valid JSON first
                    try {
                        JSON.parse(value);
                        // Valid JSON, keep as is
                    } catch {
                        // Not valid JSON, treat as comma-separated and convert
                        value = JSON.stringify(value.split(',').map(f => f.trim()).filter(f => f));
                    }
                } else {
                    value = '[]';
                }
            }

            // Special handling for labels - ensure it's a proper array (same as features)
            if (field === 'labels') {
                if (Array.isArray(value)) {
                    value = JSON.stringify(value);
                } else if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(Object.values(value));
                } else if (typeof value === 'string') {
                    // If it's a string, check if it's valid JSON first
                    try {
                        JSON.parse(value);
                        // Valid JSON, keep as is
                    } catch {
                        // Not valid JSON, treat as pipe/comma-separated and convert
                        value = JSON.stringify(value.split(/[|,]/).map(l => l.trim()).filter(l => l));
                    }
                } else {
                    value = '[]';
                }
            }

            // Special handling for images - ensure it's a proper array
            if (field === 'images') {
                if (Array.isArray(value)) {
                    value = JSON.stringify(value);
                } else if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(Object.values(value));
                } else {
                    value = '[]';
                }
            }

            // Special handling for tags - ensure it's a proper array
            if (field === 'tags') {
                if (Array.isArray(value)) {
                    value = JSON.stringify(value);
                } else if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(Object.values(value));
                } else if (typeof value === 'string') {
                    // If it's a string, check if it's valid JSON first
                    try {
                        JSON.parse(value);
                        // Valid JSON, keep as is
                    } catch {
                        // Not valid JSON, treat as comma-separated and convert
                        value = JSON.stringify(value.split(',').map(t => t.trim()).filter(t => t));
                    }
                } else {
                    value = '[]';
                }
            }

            setClauses.push(`"${field}" = $${idx}`);
            params.push(value);
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

        // ========================================================================
        // AUTO-REGENERATE TITLES when relevant fields change
        // This ensures title always matches the actual property data
        // ========================================================================
        const titleRelevantFields = ['type_id', 'status_id', 'subdistrict_id', 'size', 'type', 'status', 'province', 'district', 'sub_district'];
        const needsTitleRegeneration = fieldsToUpdate.some(f => titleRelevantFields.includes(f));

        console.log('[UPDATE PROPERTY] Title Regeneration Check:');
        console.log('  - Fields updated:', fieldsToUpdate);
        console.log('  - Title-relevant fields:', titleRelevantFields);
        console.log('  - Needs regeneration?', needsTitleRegeneration);

        if (needsTitleRegeneration) {
            try {
                const updatedProperty = result.rows[0];

                console.log('[UPDATE PROPERTY] Regenerating titles with data:', {
                    type_id: updatedProperty.type_id,
                    status_id: updatedProperty.status_id,
                    subdistrict_id: updatedProperty.subdistrict_id,
                    size: updatedProperty.size,
                    property_id: updatedProperty.property_id,
                    type: updatedProperty.type,
                    status: updatedProperty.status,
                    province: updatedProperty.province,
                    district: updatedProperty.district,
                    sub_district: updatedProperty.sub_district
                });

                const generatedTitles = await generateTitles({
                    type_id: updatedProperty.type_id,
                    status_id: updatedProperty.status_id,
                    subdistrict_id: updatedProperty.subdistrict_id,
                    size: updatedProperty.size,
                    property_id: updatedProperty.property_id,
                    // Fallback to legacy text fields
                    type: updatedProperty.type,
                    status: updatedProperty.status,
                    province: updatedProperty.province,
                    district: updatedProperty.district,
                    sub_district: updatedProperty.sub_district
                });

                console.log('[UPDATE PROPERTY] Generated titles:', generatedTitles);

                // Update ALL title fields (including legacy 'title' field)
                // This ensures backward compatibility with old code that uses 'title'
                await pool.query(
                    'UPDATE properties SET title = $1, title_en = $2, title_th = $3, title_zh = $4 WHERE id = $5',
                    [generatedTitles.title_en, generatedTitles.title_en, generatedTitles.title_th, generatedTitles.title_zh, updatedProperty.id]
                );

                console.log('[UPDATE PROPERTY] ✅ Titles updated successfully');

                // Merge regenerated titles into result
                result.rows[0].title = generatedTitles.title_en; // Update legacy field
                result.rows[0].title_en = generatedTitles.title_en;
                result.rows[0].title_th = generatedTitles.title_th;
                result.rows[0].title_zh = generatedTitles.title_zh;
            } catch (titleError) {
                console.error('[UPDATE PROPERTY] ❌ Title regeneration failed:', titleError.message);
                console.error(titleError);
                // Continue without regenerating titles
            }
        } else {
            console.log('[UPDATE PROPERTY] ℹ️  No title regeneration needed');
        }

        // If images were updated, delete removed image files from disk
        if (data.images !== undefined) {
            // Ensure oldImages is an array
            let oldImages = property.images || [];
            if (!Array.isArray(oldImages)) {
                if (typeof oldImages === 'object' && oldImages !== null) {
                    oldImages = Object.values(oldImages);
                } else if (typeof oldImages === 'string') {
                    try { oldImages = JSON.parse(oldImages); } catch { oldImages = []; }
                } else {
                    oldImages = [];
                }
            }

            // Ensure newImages is an array
            let newImages = data.images || [];
            if (!Array.isArray(newImages)) {
                if (typeof newImages === 'object' && newImages !== null) {
                    newImages = Object.values(newImages);
                } else {
                    newImages = [];
                }
            }

            // Find images that were removed
            const removedImages = oldImages.filter(img => !newImages.includes(img));

            // Delete removed image files
            const uploadDir = path.join(__dirname, '../public/images');
            for (const filename of removedImages) {
                try {
                    const filePath = path.join(uploadDir, filename);
                    await fs.unlink(filePath);
                    console.log(`Deleted image file: ${filename}`);
                } catch (err) {
                    // File might not exist, just log and continue
                    console.warn(`Could not delete image file: ${filename}`, err.message);
                }
            }
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
// Requires authentication - Admin or Agent (Agent can only delete unpublished)
router.delete('/:id', authenticate, authorize(['admin', 'agent']), async (req, res) => {
    try {
        const id = req.params.id;

        // First, get the property to check permissions
        let selectQuery = 'SELECT * FROM properties WHERE ';
        let selectParams = [];
        if (/^\d+$/.test(id)) {
            selectQuery += 'id = $1';
            selectParams = [parseInt(id)];
        } else {
            selectQuery += 'property_id = $1';
            selectParams = [id];
        }

        const propertyResult = await pool.query(selectQuery, selectParams);
        if (propertyResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        const property = propertyResult.rows[0];

        // Check permissions using canDeleteProperty
        if (!canDeleteProperty(req.user, property)) {
            // Provide helpful error message for agents
            if (req.user.role === 'agent' && property.approve_status === 'published') {
                return res.status(403).json({
                    success: false,
                    error: 'Published properties cannot be deleted directly. Please use the Delete Request feature.',
                    requiresRequest: true
                });
            }
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to delete this property'
            });
        }

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