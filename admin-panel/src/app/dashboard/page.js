'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { statsApi, propertiesApi } from '@/lib/api';
import styles from './dashboard.module.css';

export default function DashboardPage() {
    const { isAuthenticated, loading: authLoading, user } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState(null);
    const [recentProperties, setRecentProperties] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (isAuthenticated) {
            loadData();
        }
    }, [isAuthenticated]);

    const loadData = async () => {
        try {
            const [statsRes, propertiesRes] = await Promise.all([
                statsApi.get(),
                propertiesApi.getAll({ page: 1, limit: 5 })
            ]);

            if (statsRes.data.success) {
                setStats(statsRes.data.data);
            }

            if (propertiesRes.data.success) {
                setRecentProperties(propertiesRes.data.data);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || !isAuthenticated) {
        return (
            <div className="loading-overlay">
                <div className="spinner"></div>
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
                        <h1 className="page-title">Dashboard</h1>
                        <p className={styles.welcome}>
                            Welcome back, <strong>{user?.name || user?.email}</strong>!
                        </p>
                    </div>

                    {loading ? (
                        <div className={styles.loading}>
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-4 mb-lg">
                                <div className="stat-card">
                                    <div className="stat-card-icon gold">🏭</div>
                                    <div className="stat-card-value">
                                        {stats?.overview?.total_properties || 0}
                                    </div>
                                    <div className="stat-card-label">Total Properties</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-icon green">📊</div>
                                    <div className="stat-card-value">
                                        {stats?.overview?.total_types || 0}
                                    </div>
                                    <div className="stat-card-label">Property Types</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-icon blue">📍</div>
                                    <div className="stat-card-value">
                                        {stats?.overview?.total_provinces || 0}
                                    </div>
                                    <div className="stat-card-label">Provinces</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-card-icon gold">💰</div>
                                    <div className="stat-card-value">
                                        ฿{Number(stats?.overview?.avg_price || 0).toLocaleString()}
                                    </div>
                                    <div className="stat-card-label">Avg. Price</div>
                                </div>
                            </div>

                            {/* Stats by Type */}
                            <div className="grid grid-2 mb-lg">
                                <div className="card">
                                    <div className="card-header">
                                        <h3>Properties by Type</h3>
                                    </div>
                                    <div className="card-body">
                                        {stats?.by_type?.map((item, index) => (
                                            <div key={index} className={styles.statRow}>
                                                <span className={styles.statLabel}>{item.type}</span>
                                                <span className={styles.statValue}>{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="card">
                                    <div className="card-header">
                                        <h3>Top Provinces</h3>
                                    </div>
                                    <div className="card-body">
                                        {stats?.by_province?.slice(0, 5).map((item, index) => (
                                            <div key={index} className={styles.statRow}>
                                                <span className={styles.statLabel}>{item.province}</span>
                                                <span className={styles.statValue}>{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Properties */}
                            <div className="card">
                                <div className="card-header">
                                    <h3>Recent Properties</h3>
                                    <a href="/properties" className="btn btn-sm btn-secondary">
                                        View All →
                                    </a>
                                </div>
                                <div className="table-container">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Title</th>
                                                <th>Type</th>
                                                <th>Status</th>
                                                <th>Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentProperties.map((property) => (
                                                <tr key={property.id}>
                                                    <td>
                                                        <span className="badge badge-gold">
                                                            {property.property_id}
                                                        </span>
                                                    </td>
                                                    <td className={styles.titleCell}>
                                                        {property.title?.substring(0, 50)}
                                                        {property.title?.length > 50 ? '...' : ''}
                                                    </td>
                                                    <td>{property.type}</td>
                                                    <td>
                                                        <span className={`badge ${property.status?.includes('Rent') ? 'badge-info' : 'badge-success'}`}>
                                                            {property.status}
                                                        </span>
                                                    </td>
                                                    <td>฿{Number(property.price || 0).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
