'use client';

import { useState, useEffect, useRef } from 'react';
import { uploadApi } from '@/lib/api';
import styles from './PropertyForm.module.css';

const PROPERTY_FIELDS = [
    { name: 'title', label: 'Title', type: 'text', required: true },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['Warehouse', 'Factory'] },
    { name: 'status', label: 'Status', type: 'select', required: true, options: ['For Rent', 'For Sale', 'For Rent and Sale'] },
    { name: 'province', label: 'Province', type: 'text', required: true },
    { name: 'district', label: 'District', type: 'text' },
    { name: 'sub_district', label: 'Sub District', type: 'text' },
    { name: 'price', label: 'Price', type: 'number', required: true },
    { name: 'price_postfix', label: 'Price Unit', type: 'select', options: ['Month', 'Year', 'sqm', ''] },
    { name: 'price_alternative', label: 'Alternative Price (Sale)', type: 'number' },
    { name: 'size', label: 'Size (sqm)', type: 'number', required: true },
    { name: 'land_size', label: 'Land Size', type: 'number' },
    { name: 'clear_height', label: 'Clear Height', type: 'text' },
    { name: 'floor_load', label: 'Floor Load', type: 'text' },
    { name: 'warehouse_length', label: 'Dimensions', type: 'text' },
    { name: 'electricity_system', label: 'Electricity System', type: 'text' },
    { name: 'features', label: 'Features', type: 'textarea', placeholder: 'One feature per line or comma separated' },
    { name: 'terms_conditions', label: 'Terms & Conditions', type: 'textarea' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
    { name: 'coordinates', label: 'Coordinates', type: 'text', placeholder: '13.744306, 100.707444' },
    { name: 'landlord_name', label: 'Landlord Name', type: 'text', adminOnly: true },
    { name: 'landlord_contact', label: 'Landlord Contact', type: 'text', adminOnly: true },
    { name: 'labels', label: 'Labels', type: 'text', placeholder: 'e.g. Purple zone' },
];

export default function PropertyForm({ property, onSubmit, saving, isAdmin = false, apiUrl = '' }) {
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState({
        title: '',
        type: 'Warehouse',
        status: 'For Rent',
        province: '',
        district: '',
        sub_district: '',
        price: '',
        price_postfix: 'Month',
        price_alternative: '',
        size: '',
        land_size: '',
        clear_height: '',
        floor_load: '',
        warehouse_length: '',
        electricity_system: '',
        features: '',
        terms_conditions: '',
        remarks: '',
        coordinates: '',
        landlord_name: '',
        landlord_contact: '',
        labels: '',
        approve_status: 'pending'
    });

    // Image upload state
    const [existingImages, setExistingImages] = useState([]);
    const [newImages, setNewImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null); // For image preview popup

    useEffect(() => {
        if (property) {
            setFormData({
                title: property.title || '',
                type: property.type || 'Warehouse',
                status: property.status || 'For Rent',
                province: property.province || '',
                district: property.district || '',
                sub_district: property.sub_district || '',
                price: property.price || '',
                price_postfix: property.price_postfix || 'Month',
                price_alternative: property.price_alternative || '',
                size: property.size || '',
                land_size: property.land_size || '',
                clear_height: property.clear_height || '',
                floor_load: property.floor_load || '',
                warehouse_length: property.warehouse_length || '',
                electricity_system: property.electricity_system || '',
                features: (() => {
                    let feat = property.features;

                    // If it's a string, try to parse as JSON first
                    if (typeof feat === 'string') {
                        try {
                            feat = JSON.parse(feat);
                        } catch {
                            // If parsing fails, it's a plain string
                            return feat;
                        }
                    }

                    if (Array.isArray(feat)) {
                        return feat.join(', ');
                    } else if (typeof feat === 'object' && feat !== null) {
                        // Handle object format like {"0": "feature1", "1": "feature2"}
                        return Object.values(feat).join(', ');
                    }
                    return '';
                })(),
                terms_conditions: property.terms_conditions || '',
                remarks: property.remarks || '',
                coordinates: property.coordinates || '',
                landlord_name: property.landlord_name || '',
                landlord_contact: property.landlord_contact || '',
                labels: property.labels || '',
                approve_status: property.approve_status || 'pending'
            });

            // Load existing images
            if (property.images) {
                let images = [];
                if (Array.isArray(property.images)) {
                    images = property.images;
                } else if (typeof property.images === 'string') {
                    try {
                        images = JSON.parse(property.images);
                    } catch (e) {
                        console.warn('Failed to parse images JSON:', e);
                        images = [];
                    }
                }
                setExistingImages(images);
            }
        }
    }, [property]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Image upload handlers
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = (files) => {
        const validFiles = Array.from(files).filter(file =>
            file.type.startsWith('image/')
        );

        // Create preview URLs
        const newPreviews = validFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        setNewImages(prev => [...prev, ...newPreviews]);
    };

    const removeNewImage = (index) => {
        setNewImages(prev => {
            const toRemove = prev[index];
            URL.revokeObjectURL(toRemove.preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    const removeExistingImage = async (imageName) => {
        // Just remove from local state, actual file deletion happens on save
        setExistingImages(prev => prev.filter(img => img !== imageName));
    };

    // Lightbox handlers
    const openLightbox = (imageUrl) => {
        setLightboxImage(imageUrl);
    };

    const closeLightbox = () => {
        setLightboxImage(null);
    };

    const uploadImages = async (propertyId) => {
        if (newImages.length === 0) return existingImages;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('property_id', propertyId);
            newImages.forEach(img => {
                formData.append('images', img.file);
            });

            const response = await uploadApi.uploadImages(formData);
            if (response.data.success) {
                // Clear new images after upload
                newImages.forEach(img => URL.revokeObjectURL(img.preview));
                setNewImages([]);
                return response.data.data.images || [];
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
        }
        return existingImages;
    };

    // Expose upload function to parent
    useEffect(() => {
        if (property && property.id) {
            // For existing properties, we can upload immediately when files are added
        }
    }, [property, newImages]);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Process features
        const processedData = { ...formData };
        if (processedData.features) {
            const featuresArray = processedData.features
                .split(/[,\n]/)
                .map(f => f.trim())
                .filter(f => f);
            processedData.features = featuresArray;
        }

        // Convert numbers
        if (processedData.price) processedData.price = Number(processedData.price);
        if (processedData.size) processedData.size = Number(processedData.size);
        if (processedData.price_alternative) processedData.price_alternative = Number(processedData.price_alternative);
        if (processedData.land_size) processedData.land_size = Number(processedData.land_size);

        // Pass pending images to parent for upload after create
        const pendingImages = newImages.map(img => img.file);
        onSubmit(processedData, pendingImages, existingImages);
    };

    const filteredFields = PROPERTY_FIELDS.filter(field => {
        if (field.adminOnly && !isAdmin) return false;
        return true;
    });

    return (
        <form onSubmit={handleSubmit}>
            <div className="card">
                <div className="card-header">
                    <h3>Property Details</h3>
                </div>
                <div className="card-body">
                    <div className={styles.formGrid}>
                        {filteredFields.map((field) => (
                            <div
                                key={field.name}
                                className={`form-group ${field.type === 'textarea' ? styles.fullWidth : ''}`}
                            >
                                <label className="form-label">
                                    {field.label}
                                    {field.required && <span className={styles.required}>*</span>}
                                </label>

                                {field.type === 'select' ? (
                                    <select
                                        name={field.name}
                                        className="form-select"
                                        value={formData[field.name]}
                                        onChange={handleChange}
                                        required={field.required}
                                    >
                                        {field.options.map(opt => (
                                            <option key={opt} value={opt}>{opt || '(none)'}</option>
                                        ))}
                                    </select>
                                ) : field.type === 'textarea' ? (
                                    <textarea
                                        name={field.name}
                                        className="form-textarea"
                                        value={formData[field.name]}
                                        onChange={handleChange}
                                        placeholder={field.placeholder}
                                        rows={3}
                                    />
                                ) : (
                                    <input
                                        type={field.type}
                                        name={field.name}
                                        className="form-input"
                                        value={formData[field.name]}
                                        onChange={handleChange}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Approve Status (Admin only) */}
                    {isAdmin && property && (
                        <div className="form-group mt-lg">
                            <label className="form-label">Approval Status</label>
                            <select
                                name="approve_status"
                                className="form-select"
                                value={formData.approve_status}
                                onChange={handleChange}
                                style={{ maxWidth: 200 }}
                            >
                                <option value="pending">Pending</option>
                                <option value="published">Published</option>
                            </select>
                        </div>
                    )}

                    {/* Image Upload Section */}
                    <div className={styles.imageSection}>
                        <h4>📷 Property Images</h4>

                        {/* Note for new properties */}
                        {!property && newImages.length === 0 && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 12 }}>
                                💡 Select images now - they will be uploaded automatically after creating the property.
                            </p>
                        )}

                        {/* Upload Zone - available for both new and existing properties */}
                        <div
                            className={`${styles.uploadZone} ${dragActive ? styles.dragging : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={styles.uploadIcon}>📁</div>
                            <div className={styles.uploadText}>
                                Drag & drop images here or click to browse
                            </div>
                            <div className={styles.uploadHint}>
                                Supports: JPG, PNG, WebP (max 5MB each)
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                        </div>

                        {/* Uploading indicator */}
                        {uploading && (
                            <div className={styles.uploading}>
                                <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                Uploading images...
                            </div>
                        )}

                        {/* Image Preview Grid */}
                        {(existingImages.length > 0 || newImages.length > 0) && (
                            <div className={styles.imageGrid}>
                                {/* Existing Images */}
                                {existingImages.map((img, idx) => (
                                    <div key={`existing-${idx}`} className={styles.imageItem}>
                                        <img
                                            src={`${apiUrl}/images/${img}`}
                                            alt={`Property image ${idx + 1}`}
                                            onClick={() => openLightbox(`${apiUrl}/images/${img}`)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <button
                                            type="button"
                                            className={styles.imageDelete}
                                            onClick={(e) => { e.stopPropagation(); removeExistingImage(img); }}
                                            title="Remove image"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}

                                {/* New Images (pending upload) */}
                                {newImages.map((img, idx) => (
                                    <div key={`new-${idx}`} className={styles.imageItem}>
                                        <img
                                            src={img.preview}
                                            alt={`New image ${idx + 1}`}
                                            onClick={() => openLightbox(img.preview)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <button
                                            type="button"
                                            className={styles.imageDelete}
                                            onClick={(e) => { e.stopPropagation(); removeNewImage(idx); }}
                                            title="Remove image"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pending upload count for new properties */}
                        {!property && newImages.length > 0 && (
                            <p style={{ color: 'var(--success)', fontSize: '0.875rem', marginTop: 12 }}>
                                ✓ {newImages.length} image(s) ready to upload after saving
                            </p>
                        )}
                    </div>
                </div>

                <div className="card-footer">
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                Saving...
                            </>
                        ) : property ? 'Update Property' : 'Create Property'}
                    </button>
                </div>
            </div>

            {/* Image Lightbox Popup */}
            <ImageLightbox imageUrl={lightboxImage} onClose={closeLightbox} />
        </form>
    );
}

// Image Lightbox Modal Component
function ImageLightbox({ imageUrl, onClose }) {
    if (!imageUrl) return null;

    return (
        <div className={styles.lightboxOverlay} onClick={onClose}>
            <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
                <button className={styles.lightboxClose} onClick={onClose}>×</button>
                <img src={imageUrl} alt="Preview" />
            </div>
        </div>
    );
}
