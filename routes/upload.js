const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const { upload, handleUploadError } = require('../middleware/upload');

// Watermark configuration
const WATERMARK_PATH = path.join(__dirname, '../public/watermark/watermark.png');
const WATERMARK_PERCENT = 60;       // Watermark width as % of image width (1-100)
const WATERMARK_MARGIN_RIGHT = 20;  // Distance from right edge (pixels)
const WATERMARK_MARGIN_BOTTOM = 120; // Distance from bottom edge (pixels) - ยิ่งเยอะยิ่งเลื่อนขึ้น

// Helper function to apply watermark to image
const applyWatermark = async (imageBuffer) => {
    try {
        // First resize the main image
        const resizedImage = await sharp(imageBuffer)
            .resize(2000, null, { withoutEnlargement: true })
            .toBuffer();

        // Get resized image metadata for positioning
        const metadata = await sharp(resizedImage).metadata();

        // Calculate watermark width based on percentage of image width
        const watermarkWidth = Math.floor(metadata.width * (WATERMARK_PERCENT / 100));

        // Prepare watermark - resize based on image width
        const watermark = await sharp(WATERMARK_PATH)
            .resize(watermarkWidth, null)
            .toBuffer();

        // Get watermark dimensions
        const watermarkMeta = await sharp(watermark).metadata();

        // Calculate position (bottom-right with margin)
        const left = metadata.width - watermarkMeta.width - WATERMARK_MARGIN_RIGHT;
        const top = metadata.height - watermarkMeta.height - WATERMARK_MARGIN_BOTTOM;

        // Apply watermark and convert to WebP
        return await sharp(resizedImage)
            .composite([{
                input: watermark,
                left: Math.max(0, left),
                top: Math.max(0, top)
            }])
            .webp({ quality: 80 })
            .toBuffer();
    } catch (error) {
        console.error('Watermark error:', error);
        // Fallback: return image without watermark if watermark fails
        return await sharp(imageBuffer)
            .resize(2000, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();
    }
};

// Helper function to get status code from property status
const getStatusCode = (status) => {
    if (!status) return 'R'; // Default to 'R' if no status

    const statusLower = status.toLowerCase();
    if (statusLower.includes('rent') && statusLower.includes('sale')) {
        return 'SR';
    } else if (statusLower.includes('sale')) {
        return 'S';
    } else {
        return 'R';
    }
};

// Helper function to ensure upload directory exists
const ensureUploadDir = async () => {
    const uploadDir = path.join(__dirname, '../public/images');
    try {
        await fs.access(uploadDir);
    } catch {
        await fs.mkdir(uploadDir, { recursive: true });
    }
    return uploadDir;
};

// POST /api/upload/image - Upload single image
// TODO: Add authentication middleware to protect this route
router.post('/image', upload.single('image'), handleUploadError, async (req, res) => {
    try {
        const { property_id } = req.body;

        if (!property_id) {
            return res.status(400).json({
                success: false,
                error: 'property_id is required'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }

        // Get property from database to check existence, get status and current images
        const result = await pool.query(
            'SELECT id, property_id, status, images FROM properties WHERE id = $1',
            [parseInt(property_id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = result.rows[0];
        const actualPropertyId = property.property_id; // e.g. AT2059R
        const statusCode = getStatusCode(property.status);
        const currentImages = property.images || [];

        // Ensure upload directory exists
        const uploadDir = await ensureUploadDir();

        // Find next available image number by checking existing files
        // Use the actual property_id (AT2059R) for filename prefix
        const prefix = `${actualPropertyId}_`;
        const existingFiles = await fs.readdir(uploadDir);
        const relatedFiles = existingFiles.filter(f => f.startsWith(prefix));

        // Extract numbers from existing filenames
        const existingNumbers = relatedFiles.map(f => {
            const match = f.match(/_(\d+)\.webp$/);
            return match ? parseInt(match[1]) : 0;
        });

        // Find next number (highest + 1)
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

        // Generate filename: AT{property_id}{statusCode}_{number}.webp
        const filename = `${prefix}${nextNumber}.webp`;
        const filePath = path.join(uploadDir, filename);

        // Apply watermark and save image as WebP
        const processedImage = await applyWatermark(req.file.buffer);
        await fs.writeFile(filePath, processedImage);

        // Update database: add new filename to images array if not already present
        if (!currentImages.includes(filename)) {
            const updatedImages = [...currentImages, filename];
            await pool.query(
                'UPDATE properties SET images = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [JSON.stringify(updatedImages), property_id]
            );
        }

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
                filename: filename,
                path: `/images/${filename}`,
                property_id: property_id,
                status_code: statusCode,
                image_number: nextNumber
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload image'
        });
    }
});

// POST /api/upload/images - Upload multiple images
// TODO: Add authentication middleware to protect this route
router.post('/images', upload.array('images', 20), handleUploadError, async (req, res) => {
    try {
        const { property_id } = req.body;

        if (!property_id) {
            return res.status(400).json({
                success: false,
                error: 'property_id is required'
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No image files provided'
            });
        }

        // Get property from database to check existence, get status and current images
        const result = await pool.query(
            'SELECT id, property_id, status, images FROM properties WHERE id = $1',
            [parseInt(property_id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = result.rows[0];
        const actualPropertyId = property.property_id; // e.g. AT2059R
        const statusCode = getStatusCode(property.status);
        const currentImages = property.images || [];

        // Ensure upload directory exists
        const uploadDir = await ensureUploadDir();

        // Find next available image number
        // Use the actual property_id (AT2059R) for filename prefix
        const prefix = `${actualPropertyId}_`;
        const existingFiles = await fs.readdir(uploadDir);
        const relatedFiles = existingFiles.filter(f => f.startsWith(prefix));

        const existingNumbers = relatedFiles.map(f => {
            const match = f.match(/_(\d+)\.webp$/);
            return match ? parseInt(match[1]) : 0;
        });

        let nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

        // Process all images sequentially to avoid number conflicts
        const uploadedFiles = [];
        const newFilenames = [];

        for (const file of req.files) {
            const filename = `${prefix}${nextNumber}.webp`;
            const filePath = path.join(uploadDir, filename);

            // Apply watermark and save image as WebP
            const processedImage = await applyWatermark(file.buffer);
            await fs.writeFile(filePath, processedImage);

            uploadedFiles.push({
                filename: filename,
                path: `/images/${filename}`,
                number: nextNumber
            });

            newFilenames.push(filename);
            nextNumber++;
        }

        // Update database: merge new filenames with existing ones
        const allImages = [...currentImages];
        newFilenames.forEach(filename => {
            if (!allImages.includes(filename)) {
                allImages.push(filename);
            }
        });

        await pool.query(
            'UPDATE properties SET images = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(allImages), property_id]
        );

        res.json({
            success: true,
            message: `${uploadedFiles.length} images uploaded successfully`,
            data: {
                property_id: property_id,
                status_code: statusCode,
                images: uploadedFiles,
                total_images: allImages.length
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload images'
        });
    }
});

// DELETE /api/upload/image/:filename - Delete image
// TODO: Add authentication middleware to protect this route
router.delete('/image/:filename', async (req, res) => {
    try {
        const { filename } = req.params;

        // Validate filename format (AT{number}{R|S|SR}_{number}.webp)
        const filenamePattern = /^AT\d+(R|S|SR)_\d+\.webp$/;
        if (!filenamePattern.test(filename)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid filename format'
            });
        }

        const uploadDir = await ensureUploadDir();
        const filePath = path.join(uploadDir, filename);

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                error: 'Image not found'
            });
        }

        // Delete the file
        await fs.unlink(filePath);

        res.json({
            success: true,
            message: 'Image deleted successfully',
            data: {
                filename: filename
            }
        });

    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete image'
        });
    }
});

module.exports = router;
