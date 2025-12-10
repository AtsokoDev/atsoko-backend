'use client';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import styles from './Header.module.css';

export default function Header() {
    const { user, logout } = useAuth();
    const { language, changeLanguage, t } = useLanguage();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <h1 className={styles.title}>{t('common.header_title')}</h1>
            </div>

            <div className={styles.right}>
                <div className={styles.languageSwitcher}>
                    <button
                        onClick={() => changeLanguage('en')}
                        className={`${styles.langBtn} ${language === 'en' ? styles.activeLang : ''}`}
                    >
                        EN
                    </button>
                    <button
                        onClick={() => changeLanguage('th')}
                        className={`${styles.langBtn} ${language === 'th' ? styles.activeLang : ''}`}
                    >
                        TH
                    </button>
                    <button
                        onClick={() => changeLanguage('zh')}
                        className={`${styles.langBtn} ${language === 'zh' ? styles.activeLang : ''}`}
                    >
                        ZH
                    </button>
                </div>
                <div className={styles.userInfo}>
                    <span className={styles.userName}>{user?.name || user?.email}</span>
                    <span className={styles.userRole}>{user?.role}</span>
                </div>
                <button
                    className={styles.logoutBtn}
                    onClick={handleLogout}
                >
                    {t('common.logout')}
                </button>
            </div>
        </header>
    );
}
