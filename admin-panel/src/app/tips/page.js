'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { tipsApi } from '@/lib/api';
import styles from './tips.module.css';

export default function TipsPage() {
    const { isAuthenticated, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [tips, setTips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({});
    const [modal, setModal] = useState({ show: false, tip: null, mode: 'create' });
    const [formData, setFormData] = useState({
        slug: '',
        title: '',
        excerpt: '',
        content: '',
        author: '',
        published_at: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
        if (!authLoading && !isAdmin) router.push('/dashboard');
    }, [isAuthenticated, authLoading, isAdmin, router]);

    const loadTips = useCallback(async () => {
        setLoading(true);
        try {
            const res = await tipsApi.getAll({ published: 'all', limit: 50 });
            if (res.data.success) {
                setTips(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Error loading tips:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && isAdmin) loadTips();
    }, [isAuthenticated, isAdmin, loadTips]);

    const openCreateModal = () => {
        setFormData({ slug: '', title: '', excerpt: '', content: '', author: '', published_at: '' });
        setError('');
        setModal({ show: true, tip: null, mode: 'create' });
    };

    const openEditModal = (tip) => {
        setFormData({
            slug: tip.slug || '',
            title: tip.title || '',
            excerpt: tip.excerpt || '',
            content: tip.content || '',
            author: tip.author || '',
            published_at: tip.published_at ? new Date(tip.published_at).toISOString().slice(0, 16) : ''
        });
        setError('');
        setModal({ show: true, tip, mode: 'edit' });
    };

    const closeModal = () => {
        setModal({ show: false, tip: null, mode: 'create' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (modal.mode === 'create') {
                await tipsApi.create(formData);
            } else {
                await tipsApi.update(modal.tip.id, formData);
            }
            closeModal();
            loadTips();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (tip) => {
        if (!confirm(`Delete article "${tip.title}"?`)) return;
        try {
            await tipsApi.delete(tip.id);
            loadTips();
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
                        <h1 className="page-title">Tips / Articles</h1>
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            + Add Article
                        </button>
                    </div>

                    <div className="card">
                        {loading ? (
                            <div className={styles.loading}><div className="spinner"></div></div>
                        ) : tips.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">📝</div>
                                <p>No articles yet</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Title</th>
                                            <th>Slug</th>
                                            <th>Author</th>
                                            <th>Status</th>
                                            <th>Created</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tips.map((tip) => (
                                            <tr key={tip.id}>
                                                <td className={styles.titleCell}>{tip.title}</td>
                                                <td><code className={styles.slug}>{tip.slug}</code></td>
                                                <td>{tip.author || '-'}</td>
                                                <td>
                                                    <span className={`badge ${tip.published_at ? 'badge-success' : 'badge-warning'}`}>
                                                        {tip.published_at ? 'Published' : 'Draft'}
                                                    </span>
                                                </td>
                                                <td>{new Date(tip.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <div className={styles.actions}>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => openEditModal(tip)}>Edit</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tip)}>Delete</button>
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

            {/* Modal */}
            {modal.show && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h3>{modal.mode === 'create' ? 'Create Article' : 'Edit Article'}</h3>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className={styles.error}>{error}</div>}
                                <div className="form-group">
                                    <label className="form-label">Slug *</label>
                                    <input type="text" className="form-input" value={formData.slug}
                                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Title *</label>
                                    <input type="text" className="form-input" value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Excerpt</label>
                                    <textarea className="form-textarea" rows={2} value={formData.excerpt}
                                        onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Content *</label>
                                    <textarea className="form-textarea" rows={6} value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Author</label>
                                    <input type="text" className="form-input" value={formData.author}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Publish Date (leave empty for draft)</label>
                                    <input type="datetime-local" className="form-input" value={formData.published_at}
                                        onChange={(e) => setFormData({ ...formData, published_at: e.target.value })} />
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
