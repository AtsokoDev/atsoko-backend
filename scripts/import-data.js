require('dotenv').config();
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const pool = require('../config/database');
const { generateTitles } = require('../services/titleGenerator');

const CSV_FILE = 'File (19).csv';
const IMAGE_MAPPING_FILE = 'image-mapping.json';

// Cache for master data lookups
let typeCache = null;
let statusCache = null;
let locationCache = null;

// Load master data caches
async function loadMasterCaches() {
  console.log('📦 Loading master data caches...');

  // Load types
  const types = await pool.query('SELECT id, name FROM master_types');
  typeCache = new Map();
  types.rows.forEach(row => {
    const nameLower = (row.name.en || '').toLowerCase();
    typeCache.set(nameLower, row.id);
    // Also map "factory" -> id
    if (nameLower.includes('warehouse')) typeCache.set('warehouse', row.id);
    if (nameLower.includes('factory')) typeCache.set('factory', row.id);
  });
  console.log(`   Types cached: ${typeCache.size}`);

  // Load statuses
  const statuses = await pool.query('SELECT id, name FROM master_statuses');
  statusCache = new Map();
  statuses.rows.forEach(row => {
    const nameLower = (row.name.en || '').toLowerCase();
    statusCache.set(nameLower, row.id);
    // Also map common variations
    if (nameLower === 'for rent') statusCache.set('for rent', row.id);
    if (nameLower === 'for sale') statusCache.set('for sale', row.id);
    if (nameLower.includes('rent') && nameLower.includes('sale')) statusCache.set('for rent & sale', row.id);
  });
  console.log(`   Statuses cached: ${statusCache.size}`);

  // Load subdistricts with full hierarchy
  const locations = await pool.query(`
    SELECT 
      s.id as subdistrict_id,
      s.name->>'en' as subdistrict,
      d.name->>'en' as district,
      p.name->>'en' as province
    FROM master_locations s
    JOIN master_locations d ON s.parent_id = d.id AND d.level = 'district'
    JOIN master_locations p ON d.parent_id = p.id AND p.level = 'province'
    WHERE s.level = 'subdistrict'
  `);
  locationCache = new Map();
  locations.rows.forEach(row => {
    const key = `${row.province}|${row.district}|${row.subdistrict}`.toLowerCase();
    locationCache.set(key, row.subdistrict_id);
  });
  console.log(`   Locations cached: ${locationCache.size}`);
}

// Lookup type_id from text
function lookupTypeId(typeText) {
  if (!typeText) return null;

  // Handle multiple types like "Factory|Warehouse"
  const types = typeText.split('|').map(t => t.trim().toLowerCase());

  // Try "Factory" first if present (higher priority for factory/warehouse combos)
  if (types.includes('factory')) {
    return typeCache.get('factory') || null;
  }
  if (types.includes('warehouse')) {
    return typeCache.get('warehouse') || null;
  }

  // Fallback to exact match
  for (const t of types) {
    const id = typeCache.get(t);
    if (id) return id;
  }

  return null;
}

// Lookup status_id from text
function lookupStatusId(statusText) {
  if (!statusText) return null;

  const statuses = statusText.split('|').map(s => s.trim().toLowerCase());

  // If both rent and sale, return "For Rent & Sale"
  if (statuses.includes('for rent') && statuses.includes('for sale')) {
    return statusCache.get('for rent & sale') || null;
  }

  // Otherwise return first match
  for (const s of statuses) {
    const id = statusCache.get(s);
    if (id) return id;
  }

  return null;
}

// Lookup subdistrict_id from province/district/subdistrict
function lookupSubdistrictId(province, district, subdistrict) {
  if (!province || !district || !subdistrict) return null;

  const key = `${province}|${district}|${subdistrict}`.toLowerCase();
  return locationCache.get(key) || null;
}

async function importData() {
  try {
    // Load master data caches
    await loadMasterCaches();

    // Read CSV and remove BOM
    let csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    });

    // Read image mapping
    let imageMapping = {};
    if (fs.existsSync(IMAGE_MAPPING_FILE)) {
      const mappingData = JSON.parse(fs.readFileSync(IMAGE_MAPPING_FILE, 'utf-8'));
      imageMapping = mappingData.reduce((acc, item) => {
        acc[item.propertyId] = item.images;
        return acc;
      }, {});
    }

    // Import all records (set LIMIT to a number for testing)
    const LIMIT = null;
    const recordsToImport = LIMIT ? records.slice(0, LIMIT) : records;

    console.log(`\n🚀 Importing ${recordsToImport.length} properties...`);
    console.log('This may take a few minutes...\n');

    let imported = 0;
    let failed = 0;
    let titlesGenerated = 0;

    for (const record of recordsToImport) {
      try {
        const propertyId = record['fave_property_id'] || null;
        const images = imageMapping[propertyId] || [];

        // Lookup master IDs
        const typeId = lookupTypeId(record['Type']);
        const statusId = lookupStatusId(record['Status']);
        const subdistrictId = lookupSubdistrictId(
          record['Province'],
          record['District'],
          record['Sub Ditstrict']
        );

        // Generate multilingual titles
        let titleEn = null, titleTh = null, titleZh = null;
        try {
          const titles = await generateTitles({
            type_id: typeId,
            status_id: statusId,
            subdistrict_id: subdistrictId,
            size: parseFloat(record['fave_property_size']) || null,
            property_id: propertyId,
            // Fallback to text fields
            type: record['Type'],
            status: record['Status'],
            province: record['Province'],
            district: record['District'],
            sub_district: record['Sub Ditstrict']
          });
          titleEn = titles.title_en;
          titleTh = titles.title_th;
          titleZh = titles.title_zh;
          titlesGenerated++;
        } catch (titleErr) {
          // Use original title if generation fails
          titleEn = record['Title'];
        }

        await pool.query(`
          INSERT INTO properties (
            property_id, title, date, type, status, labels,
            country, province, district, sub_district,
            location, price, price_postfix, size, size_prefix,
            terms_conditions, warehouse_length, electricity_system,
            clear_height, features, landlord_name, landlord_contact,
            agent_team, coordinates, floor_load, land_size, land_postfix,
            remarks, slug, images, price_alternative, approve_status, post_modified_date,
            type_id, status_id, subdistrict_id, title_en, title_th, title_zh
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39)
          ON CONFLICT (property_id) DO UPDATE SET
            title = EXCLUDED.title,
            images = EXCLUDED.images,
            price_alternative = EXCLUDED.price_alternative,
            approve_status = EXCLUDED.approve_status,
            post_modified_date = EXCLUDED.post_modified_date,
            type_id = EXCLUDED.type_id,
            status_id = EXCLUDED.status_id,
            subdistrict_id = EXCLUDED.subdistrict_id,
            title_en = EXCLUDED.title_en,
            title_th = EXCLUDED.title_th,
            title_zh = EXCLUDED.title_zh,
            updated_at = CURRENT_TIMESTAMP
        `, [
          propertyId,
          titleEn || record['Title'],
          record['Date'] || null,
          record['Type'],
          record['Status'],
          record['Labels'],
          record['Country'],
          record['Province'],
          record['District'],
          record['Sub Ditstrict'],
          record['fave_property_location'],
          parseFloat(record['fave_property_sec_price']) || null,
          record['fave_property_price_postfix'],
          parseFloat(record['fave_property_size']) || null,
          record['fave_property_size_prefix'],
          record['fave_terms-and-conditions'],
          record['fave_warehouse-length'],
          record['fave_electricity-system'],
          record['fave_clear-height3'],
          record['fave_features3'],
          record['fave_landlord-name'],
          record['fave_landlord-contact'],
          record['fave_agent-team'],
          record['fave_exact_map_coordinates'],
          record['fave_floor3'],
          parseFloat(record['fave_property_land']) || null,
          record['fave_property_land_postfix'],
          record['fave_remarks3'],
          record['Slug'],
          JSON.stringify(images),
          parseFloat(record['fave_property_price']) || null,
          record['Approve Status'],
          record['Post Modified Date'] || null,
          typeId,
          statusId,
          subdistrictId,
          titleEn,
          titleTh,
          titleZh
        ]);

        imported++;
        if (imported % 100 === 0) {
          console.log(`Progress: ${imported}/${recordsToImport.length} (${Math.round(imported / recordsToImport.length * 100)}%)`);
        } else if (imported % 10 === 0) {
          process.stdout.write('.');
        }
      } catch (err) {
        console.error(`\nFailed to import ${record['fave_property_id']}:`, err.message);
        failed++;
      }
    }

    console.log(`\n\n✅ Import complete!`);
    console.log(`   Success: ${imported}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Titles generated: ${titlesGenerated}`);

    await pool.end();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
}

importData();
