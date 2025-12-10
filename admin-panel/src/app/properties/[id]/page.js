'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import PropertyForm from '@/components/PropertyForm';
import { propertiesApi, uploadApi } from '@/lib/api';
import styles from './edit.module.css';

export default function EditPropertyPage({ params }) {
    const resolvedParams = use(params);
    const { isAuthenticated, loading: authLoading, user } = useAuth();
    const router = useRouter();
    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadingImages, setUploadingImages] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (isAuthenticated && resolvedParams.id) {
            loadProperty();
        }
    }, [isAuthenticated, resolvedParams.id]);

    const loadProperty = async () => {
        try {
            const res = await propertiesApi.getById(resolvedParams.id);
            if (res.data.success) {
                setProperty(res.data.data);
            }
        } catch (err) {
            setError('Failed to load property');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (data, pendingImages = [], existingImages = []) => {
        setSaving(true);
        setError('');

        try {
            // Step 1: Update property data (include current images array)
            const updateData = {
                ...data,
                images: existingImages  // Include the updated images array (after removals)
            };
            const res = await propertiesApi.update(resolvedParams.id, updateData);

            if (res.data.success) {
                // Step 2: Upload new images if any
                if (pendingImages && pendingImages.length > 0) {
                    setUploadingImages(true);

                    const formData = new FormData();
                    formData.append('property_id', property.id);
                    pendingImages.forEach(file => {
                        formData.append('images', file);
                    });

                    try {
                        await uploadApi.uploadImages(formData);
                    } catch (uploadErr) {
                        console.error('Image upload failed:', uploadErr);
                        setError('Property updated but some images failed to upload.');
                    } finally {
                        setUploadingImages(false);
                    }
                }

                router.push('/properties');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update property');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (files) => {
        if (!files.length) return;

        setUploadingImages(true);
        try {
            const formData = new FormData();
            formData.append('property_id', property.id);

            if (files.length === 1) {
                formData.append('image', files[0]);
                await uploadApi.uploadImage(formData);
            } else {
                files.forEach(file => formData.append('images', file));
                await uploadApi.uploadImages(formData);
            }

            // Reload property to get updated images
            await loadProperty();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to upload images');
        } finally {
            setUploadingImages(false);
        }
    };

    if (authLoading || !isAuthenticated) {
        return <div className="loading-overlay"><div className="spinner"></div></div>;
    }

    if (loading) {
        return (
            <div className="app-layout">
                <Sidebar />
                <Header />
                <main className="main-content">
                    <div className="page-content">
                        <div className={styles.loading}><div className="spinner"></div></div>
                    </div>
                </main>
            </div>
        );
    }

    if (!property) {
        return (
            <div className="app-layout">
                <Sidebar />
                <Header />
                <main className="main-content">
                    <div className="page-content">
                        <div className="card">
                            <div className="card-body text-center">
                                <p>Property not found</p>
                                <button
                                    className="btn btn-primary mt-md"
                                    onClick={() => router.push('/properties')}
                                >
                                    Back to Properties
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <Header />

            <main className="main-content">
                <div className="page-content">
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Edit Property</h1>
                            <p className="text-muted text-sm">ID: {property.property_id}</p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => router.back()}
                        >
                            ← Back
                        </button>
                    </div>

                    {error && (
                        <div className="card mb-lg" style={{ background: 'var(--error-light)', border: 'none' }}>
                            <div className="card-body" style={{ color: '#991B1B' }}>
                                {error}
                            </div>
                        </div>
                    )}

                    <PropertyForm
                        property={property}
                        onSubmit={handleSubmit}
                        saving={saving}
                        isAdmin={user?.role === 'admin'}
                        apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}
                    />
                </div>
            </main>
        </div>
    );
}
