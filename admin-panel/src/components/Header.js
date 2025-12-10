'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './Header.module.css';

export default function Header() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <h1 className={styles.title}>Admin Panel</h1>
            </div>

            <div className={styles.right}>
                <div className={styles.userInfo}>
                    <span className={styles.userName}>{user?.name || user?.email}</span>
                    <span className={styles.userRole}>{user?.role}</span>
                </div>
                <button
                    className={styles.logoutBtn}
                    onClick={handleLogout}
                >
                    Logout
                </button>
            </div>
        </header>
    );
}
