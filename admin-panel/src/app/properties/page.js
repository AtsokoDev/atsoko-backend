'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { propertiesApi } from '@/lib/api';
import styles from './properties.module.css';

export default function PropertiesPage() {
    const { isAuthenticated, loading: authLoading, user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();

    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({});
    const [filters, setFilters] = useState({
        keyword: '',
        status: '',
        type: '',
        province: '',
        page: 1,
        limit: 20
    });
    const [deleteModal, setDeleteModal] = useState({ show: false, property: null });

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    const loadProperties = useCallback(async () => {
        setLoading(true);
        try {
            const params = { ...filters };
            // Remove empty params
            Object.keys(params).forEach(key => {
                if (!params[key]) delete params[key];
            });

            const res = await propertiesApi.getAll(params);
            if (res.data.success) {
                setProperties(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Error loading properties:', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        if (isAuthenticated) {
            loadProperties();
        }
    }, [isAuthenticated, loadProperties]);

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };

    const handlePageChange = (newPage) => {
        setFilters(prev => ({ ...prev, page: newPage }));
    };

    const handleDelete = async (property) => {
        try {
            await propertiesApi.delete(property.id);
            setDeleteModal({ show: false, property: null });
            loadProperties();
        } catch (error) {
            console.error('Error deleting property:', error);
            if (error.response?.status === 403) {
                alert('You do not have permission to delete.\n\nPlease contact Admin.');
            } else {
                alert(error.response?.data?.error || 'Failed to delete property');
            }
            setDeleteModal({ show: false, property: null });
        }
    };

    const handleApprove = async (property) => {
        try {
            await propertiesApi.update(property.id, { approve_status: 'published' });
            loadProperties();
        } catch (error) {
            console.error('Error approving property:', error);
            alert(error.response?.data?.error || 'Failed to approve property');
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
                        <h1 className="page-title">{t('property_list.title')}</h1>
                        <Link href="/properties/new" className="btn btn-primary">
                            + {t('property_list.add_new')}
                        </Link>
                    </div>

                    {/* Filters */}
                    <div className="search-filters">
                        <input
                            type="text"
                            className="form-input search-input"
                            placeholder={t('common.search')}
                            value={filters.keyword}
                            onChange={(e) => handleFilterChange('keyword', e.target.value)}
                        />
                        <select
                            className="form-select filter-select"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">{t('property_list.all_statuses')}</option>
                            <option value="rent">For Rent</option>
                            <option value="sale">For Sale</option>
                        </select>
                        <select
                            className="form-select filter-select"
                            value={filters.type}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                        >
                            <option value="">{t('property_list.all_types')}</option>
                            <option value="warehouse">Warehouse</option>
                            <option value="factory">Factory</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="card">
                        {loading ? (
                            <div className={styles.loading}><div className="spinner"></div></div>
                        ) : properties.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">🏭</div>
                                <p>{t('common.no_data')}</p>
                            </div>
                        ) : (
                            <>
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>{t('common.id')}</th>
                                                <th>{t('property.title')}</th>
                                                <th>{t('property.type')}</th>
                                                <th>{t('property.status')}</th>
                                                <th>{t('property.price')}</th>
                                                <th>{t('property.province')}</th>
                                                <th>{t('property.approve_status')}</th>
                                                <th>{t('common.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {properties.map((property) => (
                                                <tr key={property.id}>
                                                    <td>
                                                        <span className="badge badge-gold">{property.property_id}</span>
                                                    </td>
                                                    <td className={styles.titleCell}>
                                                        <Link href={`/properties/${property.id}`} className={styles.titleLink}>
                                                            {property.title?.substring(0, 40)}{property.title?.length > 40 ? '...' : ''}
                                                        </Link>
                                                    </td>
                                                    <td>{property.type}</td>
                                                    <td>
                                                        <span className={`badge ${property.status?.includes('Rent') ? 'badge-info' : 'badge-success'}`}>
                                                            {property.status}
                                                        </span>
                                                    </td>
                                                    <td>฿{Number(property.price || 0).toLocaleString()}</td>
                                                    <td>{property.province}</td>
                                                    <td>
                                                        {property.approve_status === 'published' ? (
                                                            <span className="badge badge-success">Published</span>
                                                        ) : (
                                                            <>
                                                                <span className="badge badge-warning">Pending</span>
                                                                {user?.role === 'admin' && (
                                                                    <button
                                                                        className="btn btn-sm btn-success ml-1"
                                                                        onClick={() => handleApprove(property)}
                                                                        style={{ marginLeft: 8 }}
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className={styles.actions}>
                                                            <Link
                                                                href={`/properties/${property.id}`}
                                                                className="btn btn-sm btn-secondary"
                                                            >
                                                                {t('common.edit')}
                                                            </Link>
                                                            {user?.role === 'admin' && (
                                                                <button
                                                                    className="btn btn-sm btn-danger"
                                                                    onClick={() => setDeleteModal({ show: true, property })}
                                                                >
                                                                    {t('common.delete')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {pagination.pages > 1 && (
                                    <div className="card-footer">
                                        <div className="pagination">
                                            <button
                                                className="pagination-btn"
                                                disabled={pagination.page <= 1}
                                                onClick={() => handlePageChange(pagination.page - 1)}
                                            >
                                                ← {t('property_list.prev')}
                                            </button>
                                            <span className="text-sm text-muted">
                                                {t('property_list.page')} {pagination.page} {t('property_list.of')} {pagination.pages} ({pagination.total} {t('property_list.total')})
                                            </span>
                                            <button
                                                className="pagination-btn"
                                                disabled={pagination.page >= pagination.pages}
                                                onClick={() => handlePageChange(pagination.page + 1)}
                                            >
                                                {t('property_list.next')} →
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>

            {/* Delete Modal */}
            {deleteModal.show && (
                <div className="modal-overlay" onClick={() => setDeleteModal({ show: false, property: null })}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{t('property_list.confirm_delete_title')}</h3>
                        </div>
                        <div className="modal-body">
                            <p>{t('property_list.confirm_delete_msg')}</p>
                            <p className="text-muted text-sm mt-md">
                                <strong>{deleteModal.property?.property_id}</strong> - {deleteModal.property?.title?.substring(0, 50)}
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setDeleteModal({ show: false, property: null })}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleDelete(deleteModal.property)}
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
