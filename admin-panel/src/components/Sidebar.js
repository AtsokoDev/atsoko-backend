'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import styles from './Sidebar.module.css';

const menuItems = [
    {
        href: '/dashboard',
        key: 'menu.dashboard',
        icon: '📊',
        roles: ['admin', 'agent']
    },
    {
        href: '/properties',
        key: 'menu.properties',
        icon: '🏭',
        roles: ['admin', 'agent']
    },
    {
        href: '/users',
        key: 'menu.users',
        icon: '👥',
        roles: ['admin']
    },
    {
        href: '/tips',
        key: 'menu.tips',
        icon: '📝',
        roles: ['admin']
    },
    {
        href: '/faq',
        key: 'menu.faq',
        icon: '❓',
        roles: ['admin']
    },
    {
        href: '/contacts',
        key: 'menu.contacts',
        icon: '✉️',
        roles: ['admin']
    }
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuth();
    const { t } = useLanguage();

    const filteredItems = menuItems.filter(item =>
        item.roles.includes(user?.role)
    );

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <img src="/logo.png" alt="Atsoko" className={styles.logoImg} />
            </div>

            <nav className={styles.nav}>
                {filteredItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`${styles.navItem} ${pathname === item.href || pathname.startsWith(item.href + '/') ? styles.active : ''}`}
                    >
                        <span className={styles.icon}>{item.icon}</span>
                        <span className={styles.label}>{t(item.key)}</span>
                    </Link>
                ))}
            </nav>

            <div className={styles.footer}>
                <div className={styles.userInfo}>
                    <div className={styles.userRole}>
                        {user?.role === 'admin' ? '🛡️ Admin' : '👤 Agent'}
                    </div>
                    {user?.team && (
                        <div className={styles.userTeam}>Team {user.team}</div>
                    )}
                </div>
            </div>
        </aside>
    );
}
