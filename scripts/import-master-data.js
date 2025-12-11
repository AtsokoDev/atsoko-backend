/**
 * Import Master Data from Translate List.csv
 * Populates master_types, master_statuses, and master_locations tables
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const pool = require('../config/database');

// Parse CSV file
function parseTranslateCSV() {
    const csvPath = path.join(__dirname, '../Translate List.csv');
    const content = fs.readFileSync(csvPath, 'utf8');

    // Handle Windows line endings
    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
    });

    return records;
}

// Group records by field type
function groupByFieldType(records) {
    const groups = {
        types: [],
        statuses: [],
        labels: [],
        provinces: [],
        districts: [],
        subdistricts: [],
        features: [],
        electricity: [],
        clearHeight: [],
        pricePostfix: [],
        sizePrefix: []
    };

    records.forEach(row => {
        const field = row.Field || '';
        const data = {
            en: row.EN_text || '',
            th: row.TH_text || '',
            zh: row['ZH-Text'] || ''
        };

        if (field.startsWith('Type')) {
            groups.types.push(data);
        } else if (field.startsWith('Status')) {
            groups.statuses.push(data);
        } else if (field.startsWith('Labels')) {
            groups.labels.push(data);
        } else if (field.startsWith('Province')) {
            groups.provinces.push(data);
        } else if (field.startsWith('District') && !field.includes('Sub')) {
            groups.districts.push(data);
        } else if (field.startsWith('Sub Ditstrict') || field.startsWith('Sub District')) {
            groups.subdistricts.push(data);
        } else if (field.startsWith('fave_features')) {
            groups.features.push(data);
        } else if (field.startsWith('fave_electricity')) {
            groups.electricity.push(data);
        } else if (field.startsWith('fave_clear-height')) {
            groups.clearHeight.push(data);
        } else if (field.startsWith('fave_property_price_postfix')) {
            groups.pricePostfix.push(data);
        } else if (field.startsWith('fave_property_size_prefix')) {
            groups.sizePrefix.push(data);
        }
    });

    return groups;
}

// Import types
async function importTypes(types) {
    console.log(`📦 Importing ${types.length} types...`);

    for (const type of types) {
        await pool.query(`
            INSERT INTO master_types (name, created_at, updated_at)
            VALUES ($1, NOW(), NOW())
        `, [JSON.stringify(type)]);
    }

    console.log('✅ Types imported');
}

// Import statuses
async function importStatuses(statuses) {
    console.log(`📦 Importing ${statuses.length} statuses...`);

    // Add "For Rent & Sale" if not exists
    const hasRentSale = statuses.some(s => s.en.includes('&') || s.en.toLowerCase().includes('rent') && s.en.toLowerCase().includes('sale'));
    if (!hasRentSale) {
        statuses.push({
            en: 'For Rent & Sale',
            th: 'ให้เช่าและขาย',
            zh: '出租和出售'
        });
    }

    for (const status of statuses) {
        await pool.query(`
            INSERT INTO master_statuses (name, created_at, updated_at)
            VALUES ($1, NOW(), NOW())
        `, [JSON.stringify(status)]);
    }

    console.log('✅ Statuses imported');
}

// Build province-district-subdistrict mapping from property data
async function buildLocationHierarchyFromProperties() {
    console.log('🔍 Building location hierarchy from property data...');

    // Read property CSV to get actual province-district-subdistrict relationships
    const csvPath = path.join(__dirname, '../File (19).csv');
    const content = fs.readFileSync(csvPath, 'utf8');

    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true
    });

    // Build unique location mappings
    const locationMap = new Map(); // key: "province|district|subdistrict"

    records.forEach(row => {
        const province = (row.Province || '').trim();
        const district = (row.District || '').trim();
        const subdistrict = (row['Sub Ditstrict'] || '').trim();

        if (province && district && subdistrict) {
            const key = `${province}|${district}|${subdistrict}`;
            if (!locationMap.has(key)) {
                locationMap.set(key, { province, district, subdistrict });
            }
        }
    });

    console.log(`   Found ${locationMap.size} unique location combinations`);
    return locationMap;
}

// Import locations with hierarchy
async function importLocations(groups, locationMap) {
    console.log('📦 Importing locations with hierarchy...');

    // Create translation lookup maps
    const provinceTrans = new Map();
    const districtTrans = new Map();
    const subdistrictTrans = new Map();

    groups.provinces.forEach(p => provinceTrans.set(p.en, p));
    groups.districts.forEach(d => districtTrans.set(d.en, d));
    groups.subdistricts.forEach(s => subdistrictTrans.set(s.en, s));

    // Get unique provinces from location map
    const provinces = [...new Set([...locationMap.values()].map(l => l.province))];
    const provinceIds = new Map();

    // Insert provinces
    console.log(`   Inserting ${provinces.length} provinces...`);
    for (const provinceName of provinces) {
        const trans = provinceTrans.get(provinceName) || { en: provinceName, th: provinceName, zh: provinceName };

        const result = await pool.query(`
            INSERT INTO master_locations (name, level, parent_id, created_at, updated_at)
            VALUES ($1, 'province', NULL, NOW(), NOW())
            RETURNING id
        `, [JSON.stringify(trans)]);

        provinceIds.set(provinceName, result.rows[0].id);
    }

    // Get unique province-district pairs
    const districtMap = new Map();
    locationMap.forEach(loc => {
        const key = `${loc.province}|${loc.district}`;
        if (!districtMap.has(key)) {
            districtMap.set(key, { province: loc.province, district: loc.district });
        }
    });

    const districtIds = new Map();

    // Insert districts
    console.log(`   Inserting ${districtMap.size} districts...`);
    for (const [key, { province, district }] of districtMap) {
        const trans = districtTrans.get(district) || { en: district, th: district, zh: district };
        const parentId = provinceIds.get(province);

        const result = await pool.query(`
            INSERT INTO master_locations (name, level, parent_id, created_at, updated_at)
            VALUES ($1, 'district', $2, NOW(), NOW())
            RETURNING id
        `, [JSON.stringify(trans), parentId]);

        districtIds.set(key, result.rows[0].id);
    }

    // Insert subdistricts
    console.log(`   Inserting ${locationMap.size} subdistricts...`);
    for (const [key, { province, district, subdistrict }] of locationMap) {
        const trans = subdistrictTrans.get(subdistrict) || { en: subdistrict, th: subdistrict, zh: subdistrict };
        const districtKey = `${province}|${district}`;
        const parentId = districtIds.get(districtKey);

        await pool.query(`
            INSERT INTO master_locations (name, level, parent_id, created_at, updated_at)
            VALUES ($1, 'subdistrict', $2, NOW(), NOW())
        `, [JSON.stringify(trans), parentId]);
    }

    console.log('✅ Locations imported');
}

// Main function
async function main() {
    console.log('🚀 Starting master data import...\n');

    try {
        // Parse CSV
        const records = parseTranslateCSV();
        console.log(`📄 Parsed ${records.length} translation records`);

        // Group by field type
        const groups = groupByFieldType(records);
        console.log('📊 Grouped records:');
        console.log(`   Types: ${groups.types.length}`);
        console.log(`   Statuses: ${groups.statuses.length}`);
        console.log(`   Provinces: ${groups.provinces.length}`);
        console.log(`   Districts: ${groups.districts.length}`);
        console.log(`   Subdistricts: ${groups.subdistricts.length}`);
        console.log('');

        // Clear existing master data (optional - comment out to append)
        console.log('🗑️  Clearing existing master data...');
        await pool.query('DELETE FROM master_locations');
        await pool.query('DELETE FROM master_statuses');
        await pool.query('DELETE FROM master_types');
        console.log('');

        // Import types
        await importTypes(groups.types);

        // Import statuses
        await importStatuses(groups.statuses);

        // Build location hierarchy from property data
        const locationMap = await buildLocationHierarchyFromProperties();

        // Import locations
        await importLocations(groups, locationMap);

        // Final counts
        console.log('\n📊 Final counts:');
        const typesCount = await pool.query('SELECT COUNT(*) FROM master_types');
        const statusesCount = await pool.query('SELECT COUNT(*) FROM master_statuses');
        const locationsCount = await pool.query('SELECT COUNT(*) FROM master_locations');
        const provincesCount = await pool.query("SELECT COUNT(*) FROM master_locations WHERE level = 'province'");
        const districtsCount = await pool.query("SELECT COUNT(*) FROM master_locations WHERE level = 'district'");
        const subdistrictsCount = await pool.query("SELECT COUNT(*) FROM master_locations WHERE level = 'subdistrict'");

        console.log(`   master_types: ${typesCount.rows[0].count}`);
        console.log(`   master_statuses: ${statusesCount.rows[0].count}`);
        console.log(`   master_locations: ${locationsCount.rows[0].count}`);
        console.log(`     - provinces: ${provincesCount.rows[0].count}`);
        console.log(`     - districts: ${districtsCount.rows[0].count}`);
        console.log(`     - subdistricts: ${subdistrictsCount.rows[0].count}`);

        console.log('\n✅ Master data import completed successfully!');

    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

main()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
