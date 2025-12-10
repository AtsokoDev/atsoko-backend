'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en';
import th from '../locales/th';
import zh from '../locales/zh';

const LanguageContext = createContext(null);

const translations = { en, th, zh };

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('en');

    useEffect(() => {
        const savedLang = localStorage.getItem('language');
        if (savedLang && ['en', 'th', 'zh'].includes(savedLang)) {
            setLanguage(savedLang);
        }
    }, []);

    const changeLanguage = (lang) => {
        if (['en', 'th', 'zh'].includes(lang)) {
            setLanguage(lang);
            localStorage.setItem('language', lang);
        }
    };

    const t = (key) => {
        const keys = key.split('.');
        let value = translations[language];

        for (const k of keys) {
            value = value?.[k];
            if (!value) break;
        }

        return value || key; // Fallback to key if not found
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
