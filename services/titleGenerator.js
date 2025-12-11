/**
 * Title Generator Service
 * Generates multi-language property titles based on selected master data IDs
 * 
 * Format EN: [Type_EN] [Size] sqm for [Status_EN] at [Subdistrict_EN], [District_EN], [Province_EN] (Property ID: [Code])
 * Format TH: [Type_TH] [Size] ตร.ม. [Status_TH] ที่ [Subdistrict_TH], [District_TH], [Province_TH] (รหัส: [Code])
 * Format ZH: [Type_ZH] [Size] 平方米 [Status_ZH] [Subdistrict_ZH], [District_ZH], [Province_ZH] (ID: [Code])
 * 
 * Rule: If Type is "Factory", display "Factory or Warehouse" in the EN title.
 */

const pool = require('../config/database');

/**
 * Generate titles in all 3 languages
 * @param {Object} data - Property data with IDs or names
 * @returns {Object} - { title_en, title_th, title_zh }
 */
async function generateTitles(data) {
    const {
        type_id,
        status_id,
        subdistrict_id,
        size,
        property_id,
        // Fallback text fields (for backward compatibility)
        type: typeText,
        status: statusText,
        province: provinceText,
        district: districtText,
        sub_district: subdistrictText
    } = data;

    let typeNames = { en: typeText || '', th: '', zh: '' };
    let statusNames = { en: statusText || '', th: '', zh: '' };
    let locationNames = {
        province: { en: provinceText || '', th: '', zh: '' },
        district: { en: districtText || '', th: '', zh: '' },
        subdistrict: { en: subdistrictText || '', th: '', zh: '' }
    };

    // Fetch type name from master_types if type_id is provided
    if (type_id) {
        const typeResult = await pool.query(
            'SELECT name FROM master_types WHERE id = $1',
            [type_id]
        );
        if (typeResult.rows.length > 0) {
            typeNames = typeResult.rows[0].name;
        }
    }

    // Fetch status name from master_statuses if status_id is provided
    if (status_id) {
        const statusResult = await pool.query(
            'SELECT name FROM master_statuses WHERE id = $1',
            [status_id]
        );
        if (statusResult.rows.length > 0) {
            statusNames = statusResult.rows[0].name;
        }
    }

    // Fetch location hierarchy if subdistrict_id is provided
    if (subdistrict_id) {
        const locationResult = await pool.query(`
      WITH RECURSIVE location_tree AS (
        SELECT id, parent_id, level, name
        FROM master_locations
        WHERE id = $1
        
        UNION ALL
        
        SELECT ml.id, ml.parent_id, ml.level, ml.name
        FROM master_locations ml
        INNER JOIN location_tree lt ON ml.id = lt.parent_id
      )
      SELECT level, name FROM location_tree
    `, [subdistrict_id]);

        for (const row of locationResult.rows) {
            locationNames[row.level] = row.name;
        }
    }

    // Apply the "Factory or Warehouse" rule for ALL languages
    // This rule applies when:
    // 1. Type is "Factory" (single type from master)
    // 2. Type text contains both "Factory" and "Warehouse" (e.g., "Factory|Warehouse")
    const typeTextLower = (typeText || '').toLowerCase();
    const hasFactoryAndWarehouse = typeTextLower.includes('factory') && typeTextLower.includes('warehouse');
    const isFactoryOnly = (typeNames.en || '').toLowerCase() === 'factory' || typeTextLower === 'factory';
    const needsFactoryWarehouseLabel = isFactoryOnly || hasFactoryAndWarehouse;

    let typeEn = typeNames.en || '';
    let typeTh = typeNames.th || '';
    let typeZh = typeNames.zh || '';

    if (needsFactoryWarehouseLabel) {
        // Factory type shows as "Factory or Warehouse"
        typeEn = 'Factory or Warehouse';
        typeTh = 'โรงงาน หรือ คลังสินค้า';
        typeZh = '工厂或仓库';
    }
    // Warehouse type stays as is (no modification needed)

    const sizeNum = parseFloat(size) || 0;
    const propId = property_id || '';

    // Generate English title
    const title_en = buildEnglishTitle({
        type: typeEn,
        size: sizeNum,
        status: statusNames.en || '',
        subdistrict: locationNames.subdistrict?.en || '',
        district: locationNames.district?.en || '',
        province: locationNames.province?.en || '',
        propertyId: propId
    });

    // Generate Thai title
    const title_th = buildThaiTitle({
        type: typeTh || typeNames.en || '',
        size: sizeNum,
        status: statusNames.th || '',
        subdistrict: locationNames.subdistrict?.th || locationNames.subdistrict?.en || '',
        district: locationNames.district?.th || locationNames.district?.en || '',
        province: locationNames.province?.th || locationNames.province?.en || '',
        propertyId: propId
    });

    // Generate Chinese title
    const title_zh = buildChineseTitle({
        type: typeZh || typeNames.en || '',
        size: sizeNum,
        status: statusNames.zh || '',
        subdistrict: locationNames.subdistrict?.zh || locationNames.subdistrict?.en || '',
        district: locationNames.district?.zh || locationNames.district?.en || '',
        province: locationNames.province?.zh || locationNames.province?.en || '',
        propertyId: propId
    });

    return { title_en, title_th, title_zh };
}

/**
 * Build English title
 * Format: [Type_EN] [Size] sqm for [Status_EN] at [Subdistrict_EN], [District_EN], [Province_EN] (Property ID: [Code])
 */
function buildEnglishTitle({ type, size, status, subdistrict, district, province, propertyId }) {
    const parts = [];

    if (type) parts.push(type);
    if (size > 0) parts.push(`${size} sqm`);
    if (status) parts.push(`for ${status}`);

    const locationParts = [subdistrict, district, province].filter(Boolean);
    if (locationParts.length > 0) {
        parts.push(`at ${locationParts.join(', ')}`);
    }

    if (propertyId) {
        parts.push(`(Property ID: ${propertyId})`);
    }

    return parts.join(' ');
}

/**
 * Build Thai title
 * Format: [Type_TH] [Size] ตร.ม. [Status_TH] ที่ [Subdistrict_TH], [District_TH], [Province_TH] (รหัส: [Code])
 */
function buildThaiTitle({ type, size, status, subdistrict, district, province, propertyId }) {
    const parts = [];

    if (type) parts.push(type);
    if (size > 0) parts.push(`${size} ตร.ม.`);
    if (status) parts.push(status);

    const locationParts = [subdistrict, district, province].filter(Boolean);
    if (locationParts.length > 0) {
        parts.push(`ที่ ${locationParts.join(', ')}`);
    }

    if (propertyId) {
        parts.push(`(รหัส: ${propertyId})`);
    }

    return parts.join(' ');
}

/**
 * Build Chinese title
 * Format: [Type_ZH] [Size] 平方米 [Status_ZH] [Subdistrict_ZH], [District_ZH], [Province_ZH] (ID: [Code])
 */
function buildChineseTitle({ type, size, status, subdistrict, district, province, propertyId }) {
    const parts = [];

    if (type) parts.push(type);
    if (size > 0) parts.push(`${size} 平方米`);
    if (status) parts.push(status);

    const locationParts = [subdistrict, district, province].filter(Boolean);
    if (locationParts.length > 0) {
        parts.push(locationParts.join(', '));
    }

    if (propertyId) {
        parts.push(`(ID: ${propertyId})`);
    }

    return parts.join(' ');
}

/**
 * Lookup master data IDs by text values
 * Useful for migration scripts to convert text fields to IDs
 */
async function lookupMasterIds(data) {
    const { type, status, province, district, sub_district } = data;
    const result = { type_id: null, status_id: null, subdistrict_id: null };

    // Lookup type
    if (type) {
        const typeResult = await pool.query(
            "SELECT id FROM master_types WHERE name->>'en' ILIKE $1 LIMIT 1",
            [type]
        );
        if (typeResult.rows.length > 0) {
            result.type_id = typeResult.rows[0].id;
        }
    }

    // Lookup status
    if (status) {
        const statusResult = await pool.query(
            "SELECT id FROM master_statuses WHERE name->>'en' ILIKE $1 LIMIT 1",
            [status]
        );
        if (statusResult.rows.length > 0) {
            result.status_id = statusResult.rows[0].id;
        }
    }

    // Lookup subdistrict (need to also verify district and province match)
    if (sub_district && district && province) {
        const locationResult = await pool.query(`
      SELECT s.id
      FROM master_locations s
      JOIN master_locations d ON s.parent_id = d.id
      JOIN master_locations p ON d.parent_id = p.id
      WHERE s.level = 'subdistrict'
        AND s.name->>'en' ILIKE $1
        AND d.name->>'en' ILIKE $2
        AND p.name->>'en' ILIKE $3
      LIMIT 1
    `, [sub_district, district, province]);

        if (locationResult.rows.length > 0) {
            result.subdistrict_id = locationResult.rows[0].id;
        }
    }

    return result;
}

module.exports = {
    generateTitles,
    lookupMasterIds,
    buildEnglishTitle,
    buildThaiTitle,
    buildChineseTitle
};
