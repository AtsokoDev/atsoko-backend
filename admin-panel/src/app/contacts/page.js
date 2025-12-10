'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { contactApi } from '@/lib/api';
import styles from './contacts.module.css';

const STATUS_OPTIONS = [
    { value: 'new', label: 'New', badge: 'badge-error' },
    { value: 'read', label: 'Read', badge: 'badge-warning' },
    { value: 'replied', label: 'Replied', badge: 'badge-success' },
    { value: 'archived', label: 'Archived', badge: 'badge-gray' }
];

export default function ContactsPage() {
    const { isAuthenticated, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({});
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedMessage, setSelectedMessage] = useState(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push('/login');
        if (!authLoading && !isAdmin) router.push('/dashboard');
    }, [isAuthenticated, authLoading, isAdmin, router]);

    const loadMessages = useCallback(async () => {
        setLoading(true);
        try {
            const params = { limit: 50 };
            if (statusFilter) params.status = statusFilter;
            const res = await contactApi.getAll(params);
            if (res.data.success) {
                setMessages(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        if (isAuthenticated && isAdmin) loadMessages();
    }, [isAuthenticated, isAdmin, loadMessages]);

    const handleStatusChange = async (id, newStatus) => {
        try {
            await contactApi.updateStatus(id, newStatus);
            loadMessages();
            if (selectedMessage?.id === id) {
                setSelectedMessage({ ...selectedMessage, status: newStatus });
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update status');
        }
    };

    const handleDelete = async (message) => {
        if (!confirm('Delete this message?')) return;
        try {
            await contactApi.delete(message.id);
            loadMessages();
            if (selectedMessage?.id === message.id) setSelectedMessage(null);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete');
        }
    };

    const getStatusBadge = (status) => {
        const opt = STATUS_OPTIONS.find(s => s.value === status);
        return opt ? opt.badge : 'badge-gray';
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
                        <h1 className="page-title">Contact Messages</h1>
                        <select
                            className="form-select"
                            style={{ width: 150 }}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All Status</option>
                            {STATUS_OPTIONS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.layout}>
                        {/* Messages List */}
                        <div className="card">
                            {loading ? (
                                <div className={styles.loading}><div className="spinner"></div></div>
                            ) : messages.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">✉️</div>
                                    <p>No messages</p>
                                </div>
                            ) : (
                                <div className={styles.messageList}>
                                    {messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`${styles.messageItem} ${selectedMessage?.id === msg.id ? styles.selected : ''} ${msg.status === 'new' ? styles.unread : ''}`}
                                            onClick={() => setSelectedMessage(msg)}
                                        >
                                            <div className={styles.messageHeader}>
                                                <strong>{msg.name}</strong>
                                                <span className={`badge ${getStatusBadge(msg.status)}`}>{msg.status}</span>
                                            </div>
                                            <div className={styles.messageEmail}>{msg.email}</div>
                                            <div className={styles.messageSubject}>{msg.subject || '(No subject)'}</div>
                                            <div className={styles.messageDate}>
                                                {new Date(msg.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Message Detail */}
                        <div className="card">
                            {selectedMessage ? (
                                <>
                                    <div className="card-header">
                                        <h3>Message Details</h3>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleDelete(selectedMessage)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <div className="card-body">
                                        <div className={styles.detailRow}>
                                            <label>From:</label>
                                            <span>{selectedMessage.name}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <label>Email:</label>
                                            <a href={`mailto:${selectedMessage.email}`}>{selectedMessage.email}</a>
                                        </div>
                                        {selectedMessage.phone && (
                                            <div className={styles.detailRow}>
                                                <label>Phone:</label>
                                                <a href={`tel:${selectedMessage.phone}`}>{selectedMessage.phone}</a>
                                            </div>
                                        )}
                                        <div className={styles.detailRow}>
                                            <label>Subject:</label>
                                            <span>{selectedMessage.subject || '-'}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <label>Date:</label>
                                            <span>{new Date(selectedMessage.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className={styles.detailRow}>
                                            <label>Status:</label>
                                            <select
                                                className="form-select"
                                                style={{ width: 150 }}
                                                value={selectedMessage.status}
                                                onChange={(e) => handleStatusChange(selectedMessage.id, e.target.value)}
                                            >
                                                {STATUS_OPTIONS.map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles.messageContent}>
                                            <label>Message:</label>
                                            <p>{selectedMessage.message}</p>
                                        </div>

                                        <div className={styles.actions}>
                                            <a
                                                href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject || 'Your inquiry'}`}
                                                className="btn btn-primary"
                                            >
                                                Reply via Email
                                            </a>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">👆</div>
                                    <p>Select a message to view</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
