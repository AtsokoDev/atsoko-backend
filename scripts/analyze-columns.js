require('dotenv').config({ path: '../.env' });
const pool = require('../config/database');

async function analyze() {
    try {
        console.log('--- Analyzing Columns ---');

        const postfix = await pool.query('SELECT DISTINCT price_postfix FROM properties ORDER BY price_postfix');
        console.log('\nDistinct Price Postfix (fave_property_price_postfix):');
        console.log(postfix.rows.map(r => r.price_postfix));

        const terms = await pool.query('SELECT DISTINCT terms_conditions FROM properties ORDER BY terms_conditions');
        console.log('\nDistinct Terms Conditions (fave_terms-and-conditions):');
        console.log(terms.rows.map(r => r.terms_conditions));

        const floor = await pool.query('SELECT DISTINCT floor_load FROM properties ORDER BY floor_load');
        console.log('\nDistinct Floor Load (fave_floor3):');
        console.log(floor.rows.map(r => r.floor_load));

        const features = await pool.query('SELECT DISTINCT features FROM properties');
        console.log('\nDistinct Features (fave_features3):');
        // Features might be comma separated or JSON? In import script it is direct from CSV string.
        // Let's analyze raw values first.
        const allFeatures = new Set();
        features.rows.forEach(r => {
            if (r.features) {
                // If it looks like JSON array
                if (r.features.startsWith('[')) {
                    try {
                        const arr = JSON.parse(r.features);
                        arr.forEach(f => allFeatures.add(f));
                    } catch (e) {
                        allFeatures.add(r.features);
                    }
                } else {
                    // Maybe comma separated?
                    const parts = r.features.split(',');
                    parts.forEach(p => allFeatures.add(p.trim()));
                }
            }
        });
        console.log(Array.from(allFeatures).sort());

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

analyze();
