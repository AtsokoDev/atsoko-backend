'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { uploadApi } from '@/lib/api';
import styles from './PropertyForm.module.css';

// API base URL from environment or default
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const PROPERTY_FIELDS = [
    { name: 'type', label: 'Type', type: 'api-select', required: true, endpoint: '/api/options/types' },
    { name: 'status', label: 'Status', type: 'api-select', required: true, endpoint: '/api/options/statuses' },
    { name: 'province', label: 'Province', type: 'province-select', required: true },
    { name: 'district', label: 'District', type: 'district-select' },
    { name: 'sub_district', label: 'Sub District', type: 'subdistrict-select' },
    { name: 'price', label: 'Price', type: 'number', required: true },
    { name: 'price_alternative', label: 'Alternative Price (Sale)', type: 'number' },
    { name: 'size', label: 'Size (sqm)', type: 'number', required: true },
    { name: 'land_size', label: 'Land Size', type: 'number' },
    { name: 'clear_height', label: 'Clear Height', type: 'api-select', endpoint: '/api/options/clear-height', valueField: 'value' },
    { name: 'floor_load', label: 'Floor Load (ton/sqm)', type: 'text' },
    { name: 'warehouse_length', label: 'Dimensions', type: 'text' },
    { name: 'electricity_system', label: 'Electricity System', type: 'api-select', endpoint: '/api/options/electricity' },
    { name: 'features', label: 'Features', type: 'api-multiselect', endpoint: '/api/options/features' },
    { name: 'terms_conditions', label: 'Terms & Conditions', type: 'textarea' },
    { name: 'remarks', label: 'Remarks', type: 'textarea' },
    { name: 'coordinates', label: 'Coordinates', type: 'text', placeholder: '13.744306, 100.707444' },
    { name: 'landlord_name', label: 'Landlord Name', type: 'text' },
    { name: 'landlord_contact', label: 'Landlord Contact', type: 'text' },
    { name: 'agent_team', label: 'Agent Team', type: 'api-select', adminOnly: true, endpoint: '/api/options/teams', valueField: 'name_en' },
    { name: 'labels', label: 'Labels', type: 'text', placeholder: 'e.g. Purple zone' },
];

export default function PropertyForm({ property, onSubmit, saving, isAdmin = false, apiUrl = '' }) {
    const { t, language } = useLanguage();
    const fileInputRef = useRef(null);
    const [formData, setFormData] = useState({
        title: '',
        type: '',
        status: '',
        province: '',
        district: '',
        sub_district: '',
        type_id: null,
        status_id: null,
        subdistrict_id: null,
        price: '',
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
        agent_team: '',
        labels: '',
        approve_status: 'pending'
    });

    // Options state for API-loaded dropdowns
    const [options, setOptions] = useState({
        types: [],
        statuses: [],
        provinces: [],
        districts: [],
        subdistricts: [],
        electricity: [],
        clearHeight: [],
        features: [],
        teams: [],
        floorLoad: [],
        terms: []
    });

    // Loading states
    const [loading, setLoading] = useState({
        types: false,
        statuses: false,
        provinces: false,
        districts: false,
        subdistricts: false
    });

    // Generated titles preview
    const [generatedTitles, setGeneratedTitles] = useState({
        title_en: '',
        title_th: '',
        title_zh: ''
    });

    // Image upload state
    const [existingImages, setExistingImages] = useState([]);
    const [newImages, setNewImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);

    // Fetch options on mount
    useEffect(() => {
        fetchOptions('/api/options/types', 'types');
        fetchOptions('/api/options/statuses', 'statuses');
        fetchOptions('/api/options/provinces', 'provinces');
        fetchOptions('/api/options/electricity', 'electricity');
        fetchOptions('/api/options/clear-height', 'clearHeight');
        fetchOptions('/api/options/features', 'features');
        fetchOptions('/api/options/teams', 'teams');
    }, []);

    // Fetch helper
    const fetchOptions = async (endpoint, key) => {
        setLoading(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch(`${API_URL}${endpoint}`);
            const json = await res.json();
            if (json.success) {
                setOptions(prev => ({ ...prev, [key]: json.data }));
            }
        } catch (error) {
            console.error(`Error fetching ${key}:`, error);
        } finally {
            setLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    // Load districts when province changes
    useEffect(() => {
        if (formData.province) {
            // Find province_id from selected province name
            const selectedProvince = options.provinces.find(p => p.name_en === formData.province);
            if (selectedProvince) {
                fetchOptions(`/api/options/districts/${selectedProvince.id}`, 'districts');
            }
        }
    }, [formData.province, options.provinces]);

    // Load subdistricts when district changes
    useEffect(() => {
        if (formData.district) {
            const selectedDistrict = options.districts.find(d => d.name_en === formData.district);
            if (selectedDistrict) {
                fetchOptions(`/api/options/subdistricts/${selectedDistrict.id}`, 'subdistricts');
            }
        }
    }, [formData.district, options.districts]);

    // Update subdistrict_id when sub_district changes
    useEffect(() => {
        if (formData.sub_district) {
            const selectedSubdistrict = options.subdistricts.find(s => s.name_en === formData.sub_district);
            if (selectedSubdistrict) {
                setFormData(prev => ({ ...prev, subdistrict_id: selectedSubdistrict.id }));
            }
        }
    }, [formData.sub_district, options.subdistricts]);

    // Update type_id when type changes
    useEffect(() => {
        if (formData.type) {
            const selectedType = options.types.find(t => t.name_en === formData.type);
            if (selectedType) {
                setFormData(prev => ({ ...prev, type_id: selectedType.id }));
            }
        }
    }, [formData.type, options.types]);

    // Update status_id when status changes
    useEffect(() => {
        if (formData.status) {
            const selectedStatus = options.statuses.find(s => s.name_en === formData.status);
            if (selectedStatus) {
                setFormData(prev => ({ ...prev, status_id: selectedStatus.id }));
            }
        }
    }, [formData.status, options.statuses]);

    // Generate title preview when relevant fields change
    useEffect(() => {
        generateTitlePreview();
    }, [formData.type, formData.status, formData.size, formData.province, formData.district, formData.sub_district, options]);

    const generateTitlePreview = () => {
        const { type, status, size, province, district, sub_district } = formData;

        // Find Thai/Chinese translations
        const typeData = options.types.find(t => t.name_en === type);
        const statusData = options.statuses.find(s => s.name_en === status);
        const provinceData = options.provinces.find(p => p.name_en === province);
        const districtData = options.districts.find(d => d.name_en === district);
        const subdistrictData = options.subdistricts.find(s => s.name_en === sub_district);

        // Apply Factory or Warehouse rule - ONLY for Factory type
        let typeEn = type || '';
        let typeTh = typeData?.name_th || '';
        let typeZh = typeData?.name_zh || '';

        if (type === 'Factory') {
            // Factory shows as "Factory or Warehouse"
            typeEn = 'Factory or Warehouse';
            typeTh = 'โรงงาน หรือ คลังสินค้า';
            typeZh = '工厂或仓库';
        } else if (type === 'Warehouse') {
            // Warehouse shows as just "Warehouse"
            typeEn = 'Warehouse';
            typeTh = 'คลังสินค้า';
            typeZh = '仓库';
        }

        const sizeNum = parseFloat(size) || 0;
        const statusEn = status || '';
        const statusTh = statusData?.name_th || '';
        const statusZh = statusData?.name_zh || '';

        const locationEn = [subdistrictData?.name_en, districtData?.name_en, provinceData?.name_en].filter(Boolean).join(', ');
        const locationTh = [subdistrictData?.name_th, districtData?.name_th, provinceData?.name_th].filter(Boolean).join(', ');
        const locationZh = [subdistrictData?.name_zh, districtData?.name_zh, provinceData?.name_zh].filter(Boolean).join(', ');

        const title_en = [
            typeEn,
            sizeNum > 0 ? `${sizeNum} sqm` : '',
            statusEn ? `for ${statusEn}` : '',
            locationEn ? `at ${locationEn}` : ''
        ].filter(Boolean).join(' ');

        const title_th = [
            typeTh,
            sizeNum > 0 ? `${sizeNum} ตร.ม.` : '',
            statusTh,
            locationTh ? `ที่ ${locationTh}` : ''
        ].filter(Boolean).join(' ');

        const title_zh = [
            typeZh,
            sizeNum > 0 ? `${sizeNum} 平方米` : '',
            statusZh,
            locationZh
        ].filter(Boolean).join(' ');

        setGeneratedTitles({ title_en, title_th, title_zh });
    };

    useEffect(() => {
        if (property) {
            setFormData({
                title: property.title || '',
                type: property.type || '',
                status: property.status || '',
                province: property.province || '',
                district: property.district || '',
                sub_district: property.sub_district || '',
                type_id: property.type_id || null,
                status_id: property.status_id || null,
                subdistrict_id: property.subdistrict_id || null,
                price: property.price || '',
                price_alternative: property.price_alternative || '',
                size: property.size || '',
                land_size: property.land_size || '',
                clear_height: property.clear_height || '',
                floor_load: property.floor_load || '',
                warehouse_length: property.warehouse_length || '',
                electricity_system: property.electricity_system || '',
                features: (() => {
                    let feat = property.features;
                    if (!feat) return '';

                    // Handle string input
                    if (typeof feat === 'string') {
                        const trimmed = feat.trim();
                        // Filter junk like {"1"}, {"\"1\""}, {"99"}
                        if (trimmed.match(/^\{"\\?"(\d+|)\\"\}/) || trimmed === '{"1"}' || trimmed === '{"99"}' || trimmed === '{"0"}') return '';

                        // Parse JSON if valid
                        if (trimmed.startsWith('[')) {
                            try {
                                const arr = JSON.parse(trimmed);
                                if (Array.isArray(arr)) return arr.filter(f => f && f !== '99' && f !== '1').join('|');
                            } catch (e) { }
                        }

                        // Already pipe or comma separated?
                        // Normalize to pipe
                        return trimmed.replace(/,/g, '|').replace(/\|+/g, '|');
                    }

                    if (Array.isArray(feat)) return feat.filter(f => f && f !== '99' && f !== '1').join('|');

                    return '';
                })(),
                terms_conditions: property.terms_conditions || '',
                remarks: property.remarks || '',
                coordinates: property.coordinates || '',
                landlord_name: property.landlord_name || '',
                landlord_contact: property.landlord_contact || '',
                agent_team: property.agent_team || '',
                labels: property.labels || '',
                approve_status: property.approve_status || 'pending'
            });

            // Set generated titles from property
            setGeneratedTitles({
                title_en: property.title_en || '',
                title_th: property.title_th || '',
                title_zh: property.title_zh || ''
            });

            if (property.images) {
                let images = [];
                if (Array.isArray(property.images)) {
                    images = property.images;
                } else if (typeof property.images === 'string') {
                    try { images = JSON.parse(property.images); } catch { images = []; }
                }
                setExistingImages(images);
            }
        }
    }, [property]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'province') {
            // Reset dependent fields when province changes
            setFormData(prev => ({
                ...prev,
                [name]: value,
                district: '',
                sub_district: '',
                subdistrict_id: null
            }));
            setOptions(prev => ({ ...prev, subdistricts: [] }));
            // Note: districts will be fetched by useEffect
        } else if (name === 'district') {
            // Reset dependent fields when district changes
            setFormData(prev => ({
                ...prev,
                [name]: value,
                sub_district: '',
                subdistrict_id: null
            }));
            // Note: subdistricts will be fetched by useEffect
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
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
        const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        const newPreviews = validFiles.map(file => ({ file, preview: URL.createObjectURL(file) }));
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
        setExistingImages(prev => prev.filter(img => img !== imageName));
    };

    const openLightbox = (imageUrl) => setLightboxImage(imageUrl);
    const closeLightbox = () => setLightboxImage(null);

    const uploadImages = async (propertyId) => {
        if (newImages.length === 0) return existingImages;
        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('property_id', propertyId);
            newImages.forEach(img => formDataUpload.append('images', img.file));
            const response = await uploadApi.uploadImages(formDataUpload);
            if (response.data.success) {
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

    const handleSubmit = (e) => {
        e.preventDefault();
        const processedData = { ...formData };

        // Process features
        if (processedData.features) {
            processedData.features = processedData.features.split(/[|,\n]/).map(f => f.trim()).filter(f => f);
        }

        // Convert numbers
        if (processedData.price) processedData.price = Number(processedData.price);
        if (processedData.size) processedData.size = Number(processedData.size);
        if (processedData.price_alternative) processedData.price_alternative = Number(processedData.price_alternative);
        if (processedData.land_size) processedData.land_size = Number(processedData.land_size);

        const pendingImages = newImages.map(img => img.file);
        onSubmit(processedData, pendingImages, existingImages);
    };

    const filteredFields = PROPERTY_FIELDS.filter(field => {
        if (field.adminOnly && !isAdmin) return false;
        return true;
    });

    const handleFeatureToggle = (featureName) => {
        let currentFeatures = [];
        if (formData.features) {
            if (formData.features.trim().startsWith('[')) {
                try { currentFeatures = JSON.parse(formData.features); } catch (e) { currentFeatures = [formData.features]; }
            } else {
                currentFeatures = formData.features.split(/[|,]/).map(f => f.trim()).filter(Boolean);
            }
        }

        if (currentFeatures.includes(featureName)) {
            currentFeatures = currentFeatures.filter(f => f !== featureName);
        } else {
            currentFeatures.push(featureName);
        }

        setFormData(prev => ({ ...prev, features: currentFeatures.join('|') }));
    };

    const renderField = (field) => {
        const getLabel = (opt) => opt[`name_${language}`] || opt.name_en;

        switch (field.type) {
            case 'api-select':
                const optKey = field.endpoint.includes('types') ? 'types' :
                    field.endpoint.includes('statuses') ? 'statuses' :
                        field.endpoint.includes('electricity') ? 'electricity' :
                            field.endpoint.includes('clear-height') ? 'clearHeight' :
                                field.endpoint.includes('floor-load') ? 'floorLoad' :
                                    field.endpoint.includes('terms') ? 'terms' :
                                        field.endpoint.includes('teams') ? 'teams' : 'features';
                const opts = options[optKey] || [];
                return (
                    <select
                        name={field.name}
                        className="form-select"
                        value={formData[field.name]}
                        onChange={handleChange}
                        required={field.required}
                    >
                        <option value="">-- {t('common.select') || 'Select'} --</option>
                        {opts.map(opt => (
                            <option key={opt.id} value={field.valueField ? opt[field.valueField] : opt.name_en}>
                                {getLabel(opt)}
                            </option>
                        ))}
                    </select>
                );

            case 'api-multiselect':
                const featOpts = options.features || [];
                let selectedFeats = [];
                if (formData.features) {
                    if (formData.features.trim().startsWith('[')) {
                        try { selectedFeats = JSON.parse(formData.features); } catch (e) { selectedFeats = [formData.features]; }
                    } else {
                        selectedFeats = formData.features.split(/[|,]/).map(f => f.trim());
                    }
                }

                return (
                    <div className={styles.checkboxGrid}>
                        {featOpts.map(opt => (
                            <label key={opt.id} className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={selectedFeats.includes(opt.name_en)}
                                    onChange={() => handleFeatureToggle(opt.name_en)}
                                />
                                <span>{getLabel(opt)}</span>
                            </label>
                        ))}
                    </div>
                );

            case 'province-select':
                return (
                    <select
                        name={field.name}
                        className="form-select"
                        value={formData.province}
                        onChange={handleChange}
                        required={field.required}
                    >
                        <option value="">-- {t('common.select') || 'Select'} Province --</option>
                        {options.provinces.map(p => (
                            <option key={p.id} value={p.name_en}>
                                {getLabel(p)}
                            </option>
                        ))}
                    </select>
                );

            case 'district-select':
                return (
                    <select
                        name={field.name}
                        className="form-select"
                        value={formData.district}
                        onChange={handleChange}
                        disabled={!formData.province || options.districts.length === 0}
                    >
                        <option value="">-- {t('common.select') || 'Select'} District --</option>
                        {options.districts.map(d => (
                            <option key={d.id} value={d.name_en}>
                                {getLabel(d)}
                            </option>
                        ))}
                    </select>
                );

            case 'subdistrict-select':
                return (
                    <select
                        name={field.name}
                        className="form-select"
                        value={formData.sub_district}
                        onChange={handleChange}
                        disabled={!formData.district || options.subdistricts.length === 0}
                    >
                        <option value="">-- {t('common.select') || 'Select'} Sub District --</option>
                        {options.subdistricts.map(s => (
                            <option key={s.id} value={s.name_en}>
                                {getLabel(s)}
                            </option>
                        ))}
                    </select>
                );

            case 'select':
                return (
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
                );

            case 'textarea':
                return (
                    <textarea
                        name={field.name}
                        className="form-textarea"
                        value={formData[field.name]}
                        onChange={handleChange}
                        placeholder={field.placeholder}
                        rows={3}
                    />
                );

            default:
                return (
                    <input
                        type={field.type}
                        name={field.name}
                        className="form-input"
                        value={formData[field.name]}
                        onChange={handleChange}
                        placeholder={field.placeholder}
                        required={field.required}
                    />
                );
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="card">
                <div className="card-header">
                    <h3>{t('property.title')}</h3>
                </div>
                <div className="card-body">
                    {/* Generated Titles Preview */}
                    <div className={styles.titlePreview}>
                        <h4>🔤 {t('property.auto_generated_title')}</h4>
                        <div className={styles.titleGrid}>
                            <div>
                                <label>English:</label>
                                <p>{generatedTitles.title_en || '(Fill in Type, Status, Size, Location)'}</p>
                            </div>
                            {language === 'th' && (
                                <div>
                                    <label>ไทย:</label>
                                    <p>{generatedTitles.title_th || '(กรุณากรอกข้อมูล)'}</p>
                                </div>
                            )}
                            {language === 'zh' && (
                                <div>
                                    <label>中文:</label>
                                    <p>{generatedTitles.title_zh || '(请填写信息)'}</p>
                                </div>
                            )}
                        </div>
                        <small style={{ color: 'var(--text-secondary)' }}>
                            * Titles will be auto-generated when you save. Property ID will be added.
                        </small>
                    </div>

                    <div className={styles.formGrid}>
                        {filteredFields.map((field) => (
                            <div
                                key={field.name}
                                className={`form-group ${field.type === 'textarea' || field.type === 'api-multiselect' ? styles.fullWidth : ''}`}
                            >
                                <label className="form-label">
                                    {t(`property.${field.name}`) === `property.${field.name}` ? field.label : t(`property.${field.name}`)} {field.required && <span className={styles.required}>*</span>}
                                </label>
                                {renderField(field)}
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
                        {!property && newImages.length === 0 && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 12 }}>
                                💡 Select images now - they will be uploaded automatically after creating the property.
                            </p>
                        )}
                        <div
                            className={`${styles.uploadZone} ${dragActive ? styles.dragging : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={styles.uploadIcon}>📁</div>
                            <div className={styles.uploadText}>Drag & drop images here or click to browse</div>
                            <div className={styles.uploadHint}>Supports: JPG, PNG, WebP (max 5MB each)</div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                        </div>

                        {uploading && (
                            <div className={styles.uploading}>
                                <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                Uploading images...
                            </div>
                        )}

                        {(existingImages.length > 0 || newImages.length > 0) && (
                            <div className={styles.imageGrid}>
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
                                        >×</button>
                                    </div>
                                ))}
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
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!property && newImages.length > 0 && (
                            <p style={{ color: 'var(--success)', fontSize: '0.875rem', marginTop: 12 }}>
                                ✓ {newImages.length} image(s) ready to upload after saving
                            </p>
                        )}
                    </div>
                </div>

                <div className="card-footer">
                    <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
                        {saving ? (
                            <>
                                <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                Saving...
                            </>
                        ) : property ? 'Update Property' : 'Create Property'}
                    </button>
                </div>
            </div>

            <ImageLightbox imageUrl={lightboxImage} onClose={closeLightbox} />
        </form>
    );
}

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
