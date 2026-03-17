require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');

const IMAGES_DIR = path.join(__dirname, '../public/images');

async function cleanOrphanedImages(dryRun = true) {
    try {
        console.log(`\n🔍 [Start] Image Clean-up Script`);
        console.log(`Mode: ${dryRun ? 'DRY-RUN (Only check, NO deletion)' : 'EXECUTE (Will DELETE files)'}`);
        console.log(`Directory: ${IMAGES_DIR}`);

        // 1. Get all images from database
        console.log('\n📥 Fetching database records...');
        const result = await pool.query('SELECT property_id, images FROM properties');

        // Extract all filenames from JSON array into a Set for fast lookup
        const dbImagesSet = new Set();
        result.rows.forEach(row => {
            if (row.images && Array.isArray(row.images)) {
                row.images.forEach(img => dbImagesSet.add(img));
            } else if (typeof row.images === 'string') {
                try {
                    const parsed = JSON.parse(row.images);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(img => dbImagesSet.add(img));
                    }
                } catch (e) {
                    // Ignore parsing error
                }
            }
        });

        console.log(`✔️  Found ${dbImagesSet.size} total image references in Database.`);

        // 2. Read physical files in directory
        console.log('\n📂 Scanning physical directory...');
        const allFiles = await fs.readdir(IMAGES_DIR);

        // Filter out directories (like 'tips', 'watermark') and only get actual image files
        // By checking if it's a file and ends with .webp, .jpg, .png etc.
        const physicalImages = [];
        for (const file of allFiles) {
            const filePath = path.join(IMAGES_DIR, file);
            const stat = await fs.stat(filePath);

            // Only consider top-level files (not subfolders)
            if (stat.isFile()) {
                // Focus on property images which typically start with 'AT' and end with .webp, etc.
                // Or simply all files except standard ignored ones (.gitkeep, etc)
                if (!file.startsWith('.')) {
                    physicalImages.push(file);
                }
            }
        }

        console.log(`✔️  Found ${physicalImages.length} image files in public/images/.`);

        // 3. Compare and find orphans (files exist in folder, but NOT in DB)
        const orphanedFiles = physicalImages.filter(file => !dbImagesSet.has(file));

        console.log(`\n⚠️  Found ${orphanedFiles.length} Orphaned Files (No longer in Database).`);

        // 4. Action (Dry-run or actually delete)
        if (orphanedFiles.length > 0) {
            console.log('\n🗑️  Orphaned Files List:');
            orphanedFiles.forEach((f, idx) => console.log(`   ${idx + 1}. ${f}`));

            if (!dryRun) {
                console.log('\n🚨 DELETING FILES...');
                let deletedCount = 0;
                let errorCount = 0;

                for (const file of orphanedFiles) {
                    try {
                        await fs.unlink(path.join(IMAGES_DIR, file));
                        deletedCount++;
                        // console.log(`Deleted: ${file}`);
                    } catch (err) {
                        console.error(`❌ Failed to delete ${file}:`, err.message);
                        errorCount++;
                    }
                }
                console.log(`\n✅ Clean-up Complete: Deleted ${deletedCount} files.`);
                if (errorCount > 0) console.log(`❌ Errors encountered: ${errorCount}`);
            } else {
                console.log('\n💡 To actually delete these files, run the script with --execute argument.');
                console.log('   Example: node scripts/clean-orphaned-images.js --execute\n');
            }
        } else {
            console.log('\n👍 No orphaned files found! Your storage is perfectly clean.\n');
        }

    } catch (err) {
        console.error('\n❌ Script Failed:', err);
    } finally {
        await pool.end(); // close DB connection
        process.exit();
    }
}

// Check arguments
const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute');

cleanOrphanedImages(!shouldExecute);
