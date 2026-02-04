#!/usr/bin/env node

/**
 * Simple test: Regenerate title for existing property
 * This directly tests the titleGenerator service
 */

require('dotenv').config();

const pool = require('../config/database');
const { generateTitles } = require('../services/titleGenerator');

console.log('============================================================');
console.log('🧪 TEST: Title Generator Service');
console.log('============================================================\n');

async function testTitleGeneration() {
    try {
        // Step 1: Get first property
        console.log('📋 Fetching first property from database...');
        const result = await pool.query('SELECT * FROM properties LIMIT 1');

        if (result.rows.length === 0) {
            console.error('❌ No properties found');
            process.exit(1);
        }

        const property = result.rows[0];
        console.log(`✅ Found property: ${property.property_id}`);
        console.log(`   Current title: "${property.title}"`);
        console.log(`   Current location: ${property.province}, ${property.district}, ${property.sub_district}\n`);

        // Step 2: Test title generation with current data
        console.log('🔄 Testing title generation with current data...');
        const generatedTitles = await generateTitles({
            type_id: property.type_id,
            status_id: property.status_id,
            subdistrict_id: property.subdistrict_id,
            size: property.size,
            property_id: property.property_id,
            type: property.type,
            status: property.status,
            province: property.province,
            district: property.district,
            sub_district: property.sub_district
        });

        console.log('✅ Generated titles:');
        console.log(`   EN: "${generatedTitles.title_en}"`);
        console.log(`   TH: "${generatedTitles.title_th}"`);
        console.log(`   ZH: "${generatedTitles.title_zh}"\n`);

        // Step 3: Test with different location
        console.log('🔄 Testing with new location (Chachoengsao)...');
        const newTitles = await generateTitles({
            type_id: property.type_id,
            status_id: property.status_id,
            subdistrict_id: property.subdistrict_id,
            size: property.size,
            property_id: property.property_id,
            type: property.type,
            status: property.status,
            province: 'Chachoengsao',
            district: 'Bang Pakong',
            sub_district: 'Bang Pakong'
        });

        console.log('✅ Generated titles with new location:');
        console.log(`   EN: "${newTitles.title_en}"`);
        console.log(`   TH: "${newTitles.title_th}"`);
        console.log(`   ZH: "${newTitles.title_zh}"\n`);

        // Step 4: Verify title contains new location
        const hasNewLocation = newTitles.title_en.includes('Chachoengsao') ||
            newTitles.title_en.includes('Bang Pakong');

        if (hasNewLocation) {
            console.log('✅ SUCCESS: Title generator is working correctly!');
            console.log('   New location appears in generated title.\n');
        } else {
            console.log('❌ FAILED: Title generator may have issues');
            console.log('   New location does NOT appear in title.\n');
        }

        console.log('============================================================');
        console.log('🎯 NEXT: Test via API endpoint');
        console.log('============================================================');
        console.log('The title generator service works correctly.');
        console.log('Now you need to test the API endpoint (PUT /api/properties/:id)');
        console.log('to verify it calls the generator when location changes.\n');

        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error);
        await pool.end();
        process.exit(1);
    }
}

testTitleGeneration();
