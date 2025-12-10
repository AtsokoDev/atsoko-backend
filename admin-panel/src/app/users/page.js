'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { authApi } from '@/lib/api';
import styles from './users.module.css';

export default function UsersPage() {
    const { isAuthenticated, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ show: false, user: null, mode: 'create' });
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        role: 'agent',
        team: 'A',
        is_active: true
    });
    const [saving, setSaving] = useState(false);
    const [resetModal, setResetModal] = useState({ show: false, user: null });
    const [newPassword, setNewPassword] = useState('');
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
        if (!authLoading && !isAdmin) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            loadUsers();
        }
    }, [isAuthenticated, isAdmin]);

    const loadUsers = async () => {
        try {
            const res = await authApi.getUsers();
            if (res.data.success) {
                setUsers(res.data.data);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setFormData({
            email: '',
            password: '',
            name: '',
            role: 'agent',
            team: 'A',
            is_active: true
        });
        setError('');
        setModal({ show: true, user: null, mode: 'create' });
    };

    const openEditModal = (user) => {
        setFormData({
            email: user.email,
            password: '', // Don't show password
            name: user.name || '',
            role: user.role,
            team: user.team || 'A',
            is_active: user.is_active
        });
        setError('');
        setModal({ show: true, user, mode: 'edit' });
    };

    const closeModal = () => {
        setModal({ show: false, user: null, mode: 'create' });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            if (modal.mode === 'create') {
                await authApi.createUser(formData);
            } else {
                // Don't send password if empty
                const updateData = { ...formData };
                if (!updateData.password) delete updateData.password;
                await authApi.updateUser(modal.user.id, updateData);
            }

            closeModal();
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        } finally {
            setSaving(false);
        }
    };

    const openResetModal = (user) => {
        setNewPassword('');
        setError('');
        setResetModal({ show: true, user });
    };

    const closeResetModal = () => {
        setResetModal({ show: false, user: null });
        setNewPassword('');
        setError('');
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetting(true);
        setError('');

        try {
            await authApi.resetPassword(resetModal.user.id, newPassword);
            closeResetModal();
            alert('Password reset successfully!');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password');
        } finally {
            setResetting(false);
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
                        <h1 className="page-title">User Management</h1>
                        <button className="btn btn-primary" onClick={openCreateModal}>
                            + Add User
                        </button>
                    </div>

                    <div className="card">
                        {loading ? (
                            <div className={styles.loading}><div className="spinner"></div></div>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Email</th>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Team</th>
                                            <th>Status</th>
                                            <th>Created</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => (
                                            <tr key={user.id}>
                                                <td>{user.id}</td>
                                                <td>{user.email}</td>
                                                <td>{user.name || '-'}</td>
                                                <td>
                                                    <span className={`badge ${user.role === 'admin' ? 'badge-gold' : 'badge-info'}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td>{user.team || '-'}</td>
                                                <td>
                                                    <span className={`badge ${user.is_active ? 'badge-success' : 'badge-error'}`}>
                                                        {user.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => openEditModal(user)}
                                                        style={{ marginRight: 8 }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-warning"
                                                        onClick={() => openResetModal(user)}
                                                    >
                                                        Reset PW
                                                    </button>
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

            {/* User Modal */}
            {modal.show && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modal.mode === 'create' ? 'Create New User' : 'Edit User'}</h3>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && (
                                    <div className={styles.error}>{error}</div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Email *</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                        disabled={modal.mode === 'edit'}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Password {modal.mode === 'create' ? '*' : '(leave empty to keep current)'}
                                    </label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={modal.mode === 'create'}
                                        minLength={6}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Role *</label>
                                    <select
                                        className="form-select"
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="agent">Agent</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>

                                {formData.role === 'agent' && (
                                    <div className="form-group">
                                        <label className="form-label">Team *</label>
                                        <select
                                            className="form-select"
                                            value={formData.team}
                                            onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                                        >
                                            <option value="A">Team A</option>
                                            <option value="B">Team B</option>
                                            <option value="C">Team C</option>
                                        </select>
                                    </div>
                                )}

                                {modal.mode === 'edit' && (
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select
                                            className="form-select"
                                            value={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                        >
                                            <option value="true">Active</option>
                                            <option value="false">Inactive</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : (modal.mode === 'create' ? 'Create' : 'Update')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetModal.show && (
                <div className="modal-overlay" onClick={closeResetModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Reset Password for {resetModal.user?.email}</h3>
                        </div>
                        <form onSubmit={handleResetPassword}>
                            <div className="modal-body">
                                {error && (
                                    <div className={styles.error}>{error}</div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">New Password *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        placeholder="Enter new password (min 6 characters)"
                                    />
                                </div>

                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 8 }}>
                                    ⚠️ After resetting, the user will be logged out and need to login with the new password.
                                </p>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeResetModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-warning" disabled={resetting}>
                                    {resetting ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
