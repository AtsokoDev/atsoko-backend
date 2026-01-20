/**
 * Script to regenerate all property titles
 * Run: node scripts/regenerate-titles.js
 */

require('dotenv').config();

const pool = require('../config/database');
const { generateTitles } = require('../services/titleGenerator');

async function regenerateTitles() {
    console.log('🚀 Starting title regeneration...\n');

    try {
        // Get all properties
        const result = await pool.query(`
            SELECT 
                id, property_id, type, status, size,
                province, district, sub_district,
                type_id, status_id, subdistrict_id,
                title, title_en, title_th, title_zh
            FROM properties
            ORDER BY id
        `);

        const properties = result.rows;
        console.log(`📦 Found ${properties.length} properties to update\n`);

        let updated = 0;
        let errors = 0;

        for (const prop of properties) {
            try {
                // Generate new titles
                const titles = await generateTitles({
                    type_id: prop.type_id,
                    status_id: prop.status_id,
                    subdistrict_id: prop.subdistrict_id,
                    size: prop.size,
                    property_id: prop.property_id,
                    type: prop.type,
                    status: prop.status,
                    province: prop.province,
                    district: prop.district,
                    sub_district: prop.sub_district
                });

                // Update property
                await pool.query(`
                    UPDATE properties
                    SET 
                        title = $1,
                        title_en = $2,
                        title_th = $3,
                        title_zh = $4,
                        updated_at = NOW()
                    WHERE id = $5
                `, [
                    titles.title_en || prop.title,
                    titles.title_en,
                    titles.title_th,
                    titles.title_zh,
                    prop.id
                ]);

                updated++;

                // Progress log every 100 properties
                if (updated % 100 === 0) {
                    console.log(`✅ Updated ${updated}/${properties.length} properties...`);
                }

            } catch (err) {
                errors++;
                console.error(`❌ Error updating property ${prop.property_id}:`, err.message);
            }
        }

        console.log('\n========================================');
        console.log(`✅ Successfully updated: ${updated} properties`);
        console.log(`❌ Errors: ${errors} properties`);
        console.log('========================================\n');

        // Show sample of updated titles
        console.log('📝 Sample updated titles:\n');
        const sample = await pool.query(`
            SELECT property_id, title_en, title_th
            FROM properties
            ORDER BY id
            LIMIT 3
        `);

        sample.rows.forEach(row => {
            console.log(`[${row.property_id}]`);
            console.log(`  EN: ${row.title_en}`);
            console.log(`  TH: ${row.title_th}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Fatal error:', error);
    } finally {
        await pool.end();
        console.log('🏁 Done!');
    }
}

regenerateTitles();
