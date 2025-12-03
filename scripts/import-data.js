require('dotenv').config();
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const pool = require('../config/database');

const CSV_FILE = 'File (19).csv';
const IMAGE_MAPPING_FILE = 'image-mapping.json';

async function importData() {
  try {
    // Read CSV and remove BOM
    let csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
    if (csvContent.charCodeAt(0) === 0xFEFF) {
      csvContent = csvContent.slice(1);
    }
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true
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

    console.log(`Importing ${recordsToImport.length} properties...`);
    console.log('This may take a few minutes...\n');

    let imported = 0;
    let failed = 0;

    for (const record of recordsToImport) {
      try {
        const propertyId = record['fave_property_id'] || null;
        const images = imageMapping[propertyId] || [];

        await pool.query(`
          INSERT INTO properties (
            property_id, title, date, type, status, labels,
            country, province, district, sub_district,
            location, price, price_postfix, size, size_prefix,
            terms_conditions, warehouse_length, electricity_system,
            clear_height, features, landlord_name, landlord_contact,
            agent_team, coordinates, floor_load, land_size, land_postfix,
            remarks, slug, images
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
          ON CONFLICT (property_id) DO UPDATE SET
            title = EXCLUDED.title,
            images = EXCLUDED.images,
            updated_at = CURRENT_TIMESTAMP
        `, [
          propertyId,
          record['Title'],
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
          JSON.stringify(images)
        ]);

        imported++;
        if (imported % 100 === 0) {
          console.log(`Progress: ${imported}/${recordsToImport.length} (${Math.round(imported / recordsToImport.length * 100)}%)`);
        } else if (imported % 10 === 0) {
          process.stdout.write('.');
        }
      } catch (err) {
        console.error(`Failed to import ${record['fave_property_id']}:`, err.message);
        failed++;
      }
    }

    console.log(`\n✓ Import complete!`);
    console.log(`  Success: ${imported}`);
    console.log(`  Failed: ${failed}`);

    await pool.end();
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
}

importData();
