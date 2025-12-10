'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import PropertyForm from '@/components/PropertyForm';
import { propertiesApi, uploadApi } from '@/lib/api';

export default function NewPropertyPage() {
    const { isAuthenticated, loading: authLoading, user } = useAuth();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    const handleSubmit = async (data, pendingImages = [], existingImages = []) => {
        setSaving(true);
        setError('');
        setUploadProgress('');

        try {
            // Step 1: Create property
            setUploadProgress('Creating property...');
            const res = await propertiesApi.create(data);

            if (res.data.success) {
                const newProperty = res.data.data;

                // Step 2: Upload images if any
                if (pendingImages && pendingImages.length > 0) {
                    setUploadProgress(`Uploading ${pendingImages.length} image(s)...`);

                    const formData = new FormData();
                    formData.append('property_id', newProperty.id);
                    pendingImages.forEach(file => {
                        formData.append('images', file);
                    });

                    try {
                        await uploadApi.uploadImages(formData);
                        setUploadProgress('Images uploaded successfully!');
                    } catch (uploadErr) {
                        console.error('Image upload failed:', uploadErr);
                        // Property created but images failed - still redirect but show warning
                        setError('Property created but image upload failed. You can add images by editing the property.');
                    }
                }

                // Give user a moment to see success message then redirect
                setTimeout(() => {
                    router.push('/properties');
                }, pendingImages.length > 0 ? 500 : 0);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create property');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || !isAuthenticated) {
        return <div className="loading-overlay"><div className="spinner"></div></div>;
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <Header />

            <main className="main-content">
                <div className="page-content">
                    <div className="page-header">
                        <h1 className="page-title">Add New Property</h1>
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

                    {uploadProgress && !error && (
                        <div className="card mb-lg" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--primary)' }}>
                            <div className="card-body" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                {uploadProgress}
                            </div>
                        </div>
                    )}


                    <PropertyForm
                        onSubmit={handleSubmit}
                        saving={saving}
                        isAdmin={user?.role === 'admin'}
                    />
                </div>
            </main>
        </div>
    );
}
