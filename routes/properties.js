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
    removeSecretFields
} = require('../middleware/auth');

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
// Uses optionalAuth - guests can access but won't see secret fields
router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            keyword,           // Search by title
            status,            // Rent or Sale
            type,              // Warehouse or Factory
            province,
            district,
            sub_district,      // NEW: Subdistrict filter
            min_size,          // Area min
            max_size,          // Area max
            min_price,         // Price min
            max_price,         // Price max
            features,          // NEW: Features array (comma-separated or array)
            min_height,        // NEW: Clear height min
            max_height,        // NEW: Clear height max
            floor_load,        // NEW: Floor loading
            page = 1,
            limit = 20
        } = req.query;

        // Validate pagination parameters
        const validatedPage = validateInteger(page, 'page', 1);
        const validatedLimit = validateInteger(limit, 'limit', 1, 100); // Max 100 items per page

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

        // 1. Keyword search in title
        if (keyword) {
            const sanitizedKeyword = sanitizePattern(keyword);
            query += ` AND title ILIKE $${paramCount}`;
            countQuery += ` AND title ILIKE $${paramCount}`;
            params.push(`%${sanitizedKeyword}%`);
            countParams.push(`%${sanitizedKeyword}%`);
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
        if (type) {
            const sanitizedType = sanitizePattern(type);
            query += ` AND type ILIKE $${paramCount}`;
            countQuery += ` AND type ILIKE $${paramCount}`;
            params.push(`%${sanitizedType}%`);
            countParams.push(`%${sanitizedType}%`);
            paramCount++;
        }

        // 4. Province filter
        if (province) {
            const sanitizedProvince = sanitizePattern(province);
            query += ` AND province ILIKE $${paramCount}`;
            countQuery += ` AND province ILIKE $${paramCount}`;
            params.push(`%${sanitizedProvince}%`);
            countParams.push(`%${sanitizedProvince}%`);
            paramCount++;
        }

        // 5. District filter
        if (district) {
            const sanitizedDistrict = sanitizePattern(district);
            query += ` AND district ILIKE $${paramCount}`;
            countQuery += ` AND district ILIKE $${paramCount}`;
            params.push(`%${sanitizedDistrict}%`);
            countParams.push(`%${sanitizedDistrict}%`);
            paramCount++;
        }

        // 6. Sub-district filter (NEW)
        if (sub_district) {
            const sanitizedSubDistrict = sanitizePattern(sub_district);
            query += ` AND sub_district ILIKE $${paramCount}`;
            countQuery += ` AND sub_district ILIKE $${paramCount}`;
            params.push(`%${sanitizedSubDistrict}%`);
            countParams.push(`%${sanitizedSubDistrict}%`);
            paramCount++;
        }

        // 7. Area (Size) filter - Min
        if (min_size) {
            const validatedMinSize = validateNumber(min_size, 'min_size');
            query += ` AND size >= $${paramCount}`;
            countQuery += ` AND size >= $${paramCount}`;
            params.push(validatedMinSize);
            countParams.push(validatedMinSize);
            paramCount++;
        }

        // 8. Area (Size) filter - Max
        if (max_size) {
            const validatedMaxSize = validateNumber(max_size, 'max_size');
            query += ` AND size <= $${paramCount}`;
            countQuery += ` AND size <= $${paramCount}`;
            params.push(validatedMaxSize);
            countParams.push(validatedMaxSize);
            paramCount++;
        }

        // 9. Price filter - Smart selection based on status
        // If status is "sale", use price_alternative, otherwise use price (default for rent)
        const priceField = status && status.toLowerCase().includes('sale') ? 'price_alternative' : 'price';

        if (min_price) {
            const validatedMinPrice = validateNumber(min_price, 'min_price');
            query += ` AND ${priceField} >= $${paramCount}`;
            countQuery += ` AND ${priceField} >= $${paramCount}`;
            params.push(validatedMinPrice);
            countParams.push(validatedMinPrice);
            paramCount++;
        }

        if (max_price) {
            const validatedMaxPrice = validateNumber(max_price, 'max_price');
            query += ` AND ${priceField} <= $${paramCount}`;
            countQuery += ` AND ${priceField} <= $${paramCount}`;
            params.push(validatedMaxPrice);
            countParams.push(validatedMaxPrice);
            paramCount++;
        }

        // 10. Features filter (NEW) - Array support
        if (features) {
            // Support both comma-separated string and array
            const featuresArray = Array.isArray(features) ? features : features.split(',').map(f => f.trim());

            // Use JSONB contains operator (@>) to check if all requested features exist
            query += ` AND features @> $${paramCount}::jsonb`;
            countQuery += ` AND features @> $${paramCount}::jsonb`;
            params.push(JSON.stringify(featuresArray));
            countParams.push(JSON.stringify(featuresArray));
            paramCount++;
        }

        // 11. Clear Height filter (NEW) - Min
        if (min_height) {
            const validatedMinHeight = validateNumber(min_height, 'min_height');
            query += ` AND clear_height >= $${paramCount}`;
            countQuery += ` AND clear_height >= $${paramCount}`;
            params.push(validatedMinHeight);
            countParams.push(validatedMinHeight);
            paramCount++;
        }

        // 12. Clear Height filter (NEW) - Max
        if (max_height) {
            const validatedMaxHeight = validateNumber(max_height, 'max_height');
            query += ` AND clear_height <= $${paramCount}`;
            countQuery += ` AND clear_height <= $${paramCount}`;
            params.push(validatedMaxHeight);
            countParams.push(validatedMaxHeight);
            paramCount++;
        }

        // 13. Floor Load filter (NEW)
        if (floor_load) {
            const sanitizedFloorLoad = sanitizePattern(floor_load);
            query += ` AND floor_load ILIKE $${paramCount}`;
            countQuery += ` AND floor_load ILIKE $${paramCount}`;
            params.push(`%${sanitizedFloorLoad}%`);
            countParams.push(`%${sanitizedFloorLoad}%`);
            paramCount++;
        }

        // Add ordering and pagination
        query += ` ORDER BY id DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(validatedLimit, (validatedPage - 1) * validatedLimit);

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
                limit: validatedLimit,
                total,
                pages: Math.ceil(total / validatedLimit)
            },
            filters: {
                keyword,
                status,
                type,
                province,
                district,
                sub_district,
                price_range: { min: min_price, max: max_price, field: priceField },
                size_range: { min: min_size, max: max_size },
                height_range: { min: min_height, max: max_height },
                features,
                floor_load
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
        } else if (req.user.role === 'agent') {
            // Agent: only their team's properties
            baseQuery += ' AND agent_team = $2';
            params.push(req.user.team);
        }
        // Admin: no restrictions

        result = await pool.query(baseQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Property not found' });
        }

        // Hide secret fields for guests
        let responseData = result.rows[0];
        if (!req.user) {
            responseData = removeSecretFields(responseData);
        }

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

        // Define required fields (property_id is now auto-generated, so not required from user)
        const requiredFields = ['title', 'type', 'province', 'price', 'size', 'status'];
        const missingFields = requiredFields.filter(field => !data[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
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
        ];

        // Filter only allowed fields from request
        let fieldsToInsert = Object.keys(data).filter(key => allowedFields.includes(key));

        if (fieldsToInsert.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields provided' });
        }

        // For agents: force agent_team to their team and approve_status to pending
        if (req.user.role === 'agent') {
            data.agent_team = req.user.team;
            data.approve_status = 'pending';
            // Ensure these fields are included
            if (!fieldsToInsert.includes('agent_team')) fieldsToInsert.push('agent_team');
            if (!fieldsToInsert.includes('approve_status')) fieldsToInsert.push('approve_status');
        } else if (req.user.role === 'admin') {
            // Admin can set any status, default to published if not specified
            if (!data.approve_status) {
                data.approve_status = 'published';
                if (!fieldsToInsert.includes('approve_status')) fieldsToInsert.push('approve_status');
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

        // Create a temporary unique property_id for initial insert
        const tempPropertyId = `TEMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Build INSERT query with temporary property_id
        const columnsWithPropertyId = [...fieldsToInsert, 'property_id'];
        const columns = columnsWithPropertyId.map(field => `"${field}"`).join(', ');
        const placeholders = columnsWithPropertyId.map((_, idx) => `$${idx + 1}`).join(', ');
        const valuesWithPropertyId = [...fieldsToInsert.map(field => data[field]), tempPropertyId];

        // Insert with temporary property_id
        const insertQuery = `
            INSERT INTO properties (${columns})
            VALUES (${placeholders})
            RETURNING id, status
        `;

        const insertResult = await pool.query(insertQuery, valuesWithPropertyId);
        const newId = insertResult.rows[0].id;
        const status = insertResult.rows[0].status;

        // Generate the final property_id: AT{id}{status_code}
        const statusCode = getStatusCode(status);
        let propertyId = `AT${newId}${statusCode}`;

        // Check if this property_id already exists and find an available one if needed
        let checkQuery = 'SELECT id FROM properties WHERE property_id = $1 AND id != $2';
        let checkResult = await pool.query(checkQuery, [propertyId, newId]);

        // If duplicate exists, find the next available number
        if (checkResult.rows.length > 0) {
            // Get the maximum ID number used in property_id format AT*
            // Use regex to extract only the numeric part between AT and status code
            const maxIdQuery = `
                SELECT COALESCE(
                    MAX(
                        CAST(
                            NULLIF(SUBSTRING(property_id FROM '^AT([0-9]+)'), '') 
                            AS INTEGER
                        )
                    ), 
                    0
                ) as max_num
                FROM properties 
                WHERE property_id ~ '^AT[0-9]+(R|S|SR)$'
            `;
            const maxIdResult = await pool.query(maxIdQuery);
            const nextAvailableId = maxIdResult.rows[0].max_num + 1;
            propertyId = `AT${nextAvailableId}${statusCode}`;
        }

        // Update with the final property_id
        const updateQuery = `
            UPDATE properties 
            SET property_id = $1 
            WHERE id = $2 
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [propertyId, newId]);

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Property created successfully'
        });

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
            "images"
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
                    // If it's a comma-separated string, convert to array
                    value = JSON.stringify(value.split(',').map(f => f.trim()).filter(f => f));
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
// Requires authentication - Admin only
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
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

        // Check permissions using canModifyProperty
        if (!canModifyProperty(req.user, property)) {
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