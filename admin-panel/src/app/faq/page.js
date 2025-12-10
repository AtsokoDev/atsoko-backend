'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { faqApi } from '@/lib/api';
import styles from './faq.module.css';

export default function FAQPage() {
    const { isAuthenticated, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [faqs, setFaqs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ show: false, faq: null, mode: 'create' });
    const [formData, setFormData] = useState({
        question: '',
        answer: '',
        category: '',
        display_order: 0,
        is_active: true
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
        if (!authLoading && !isAdmin) router.push('/dashboard');
    }, [isAuthenticated, authLoading, isAdmin, router]);

    const loadFaqs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await faqApi.getAll({ is_active: 'all', limit: 100 });
            if (res.data.success) setFaqs(res.data.data);
        } catch (error) {
            console.error('Error loading FAQs:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && isAdmin) loadFaqs();
    }, [isAuthenticated, isAdmin, loadFaqs]);

    const openCreateModal = () => {
        setFormData({ question: '', answer: '', category: '', display_order: 0, is_active: true });
        setError('');
        setModal({ show: true, faq: null, mode: 'create' });
    };

    const openEditModal = (faq) => {
        setFormData({
            question: faq.question || '',
            answer: faq.answer || '',
            category: faq.category || '',
            display_order: faq.display_order || 0,
            is_active: faq.is_active
        });
        setError('');
        setModal({ show: true, faq, mode: 'edit' });
    };

    const closeModal = () => setModal({ show: false, faq: null, mode: 'create' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (modal.mode === 'create') {
                await faqApi.create(formData);
            } else {
                await faqApi.update(modal.faq.id, formData);
            }
            closeModal();
            loadFaqs();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (faq) => {
        if (!confirm(`Delete this FAQ?`)) return;
        try {
            await faqApi.delete(faq.id);
            loadFaqs();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete');
        }
    };

    if (authLoading || !isAuthenticated || !isAdmin) {
        return <div className="loading-overlay"><div className="spinner"></div></div>;
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <Header />

            <main className="main-content">
                <div className="page-content">
                    <div className="page-header">
                        <h1 className="page-title">FAQ Management</h1>
                        <button className="btn btn-primary" onClick={openCreateModal}>+ Add FAQ</button>
                    </div>

                    <div className="card">
                        {loading ? (
                            <div className={styles.loading}><div className="spinner"></div></div>
                        ) : faqs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">❓</div>
                                <p>No FAQs yet</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Order</th>
                                            <th>Question</th>
                                            <th>Category</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {faqs.map((faq) => (
                                            <tr key={faq.id}>
                                                <td>{faq.display_order}</td>
                                                <td className={styles.questionCell}>{faq.question}</td>
                                                <td>{faq.category || '-'}</td>
                                                <td>
                                                    <span className={`badge ${faq.is_active ? 'badge-success' : 'badge-gray'}`}>
                                                        {faq.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className={styles.actions}>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(faq)}>Edit</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(faq)}>Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {modal.show && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modal.mode === 'create' ? 'Create FAQ' : 'Edit FAQ'}</h3>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className={styles.error}>{error}</div>}
                                <div className="form-group">
                                    <label className="form-label">Question *</label>
                                    <input type="text" className="form-input" value={formData.question}
                                        onChange={(e) => setFormData({ ...formData, question: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Answer *</label>
                                    <textarea className="form-textarea" rows={4} value={formData.answer}
                                        onChange={(e) => setFormData({ ...formData, answer: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <input type="text" className="form-input" value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Display Order</label>
                                    <input type="number" className="form-input" value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-select" value={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}>
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : (modal.mode === 'create' ? 'Create' : 'Update')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
