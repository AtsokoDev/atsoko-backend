const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
const { upload, handleUploadError } = require('../middleware/upload');

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
            'SELECT id, status, images FROM properties WHERE id = $1',
            [parseInt(property_id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = result.rows[0];
        const statusCode = getStatusCode(property.status);
        const currentImages = property.images || [];

        // Ensure upload directory exists
        const uploadDir = await ensureUploadDir();

        // Find next available image number by checking existing files
        const prefix = `AT${property_id}${statusCode}_`;
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

        // Convert and save image as WebP
        await sharp(req.file.buffer)
            .resize(2000, null, {
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(filePath);

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
            'SELECT id, status, images FROM properties WHERE id = $1',
            [parseInt(property_id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Property not found'
            });
        }

        const property = result.rows[0];
        const statusCode = getStatusCode(property.status);
        const currentImages = property.images || [];

        // Ensure upload directory exists
        const uploadDir = await ensureUploadDir();

        // Find next available image number
        const prefix = `AT${property_id}${statusCode}_`;
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

            await sharp(file.buffer)
                .resize(2000, null, {
                    withoutEnlargement: true
                })
                .webp({ quality: 80 })
                .toFile(filePath);

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
