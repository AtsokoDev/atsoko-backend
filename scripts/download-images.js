const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { parse } = require('csv-parse/sync');
const sharp = require('sharp');

const CSV_FILE = 'File (19).csv';
const IMAGES_DIR = 'public/images';
const MAX_CONCURRENT = 5;

// Create images directory
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

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

console.log(`Found ${records.length} properties`);

// Download and convert image
async function downloadAndConvert(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          await sharp(buffer)
            .webp({ quality: 80 })
            .toFile(outputPath);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

// Process images for a property
async function processProperty(record, index) {
  const imageUrls = record['Image URL'] ? record['Image URL'].split('|') : [];
  const propertyId = record['fave_property_id'] || `prop_${index}`;
  const downloadedImages = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i].trim();
    if (!url) continue;

    const filename = `${propertyId}_${i + 1}.webp`;
    const outputPath = path.join(IMAGES_DIR, filename);

    // Skip if already exists
    if (fs.existsSync(outputPath)) {
      console.log(`✓ Skip (exists): ${filename}`);
      downloadedImages.push(filename);
      continue;
    }

    try {
      await downloadAndConvert(url, outputPath);
      console.log(`✓ Downloaded: ${filename}`);
      downloadedImages.push(filename);
    } catch (err) {
      console.error(`✗ Failed ${filename}:`, err.message);
    }
  }

  return { propertyId, images: downloadedImages };
}

// Process all properties with concurrency control
async function processAll() {
  const results = [];
  
  for (let i = 0; i < records.length; i += MAX_CONCURRENT) {
    const batch = records.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(
      batch.map((record, idx) => processProperty(record, i + idx))
    );
    results.push(...batchResults);
    console.log(`Progress: ${Math.min(i + MAX_CONCURRENT, records.length)}/${records.length}`);
  }

  // Save mapping
  fs.writeFileSync('image-mapping.json', JSON.stringify(results, null, 2));
  console.log('\n✓ Complete! Image mapping saved to image-mapping.json');
}

processAll().catch(console.error);
