import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { storageGet, storageSet } from '../utils/chromeApi';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;

  useEffect(() => {
    storageGet<string>('language', 'es').then(lang => {
      if (lang !== i18n.language) i18n.changeLanguage(lang);
    });
  }, [i18n]);

  const toggle = () => {
    const next = current === 'es' ? 'en' : 'es';
    i18n.changeLanguage(next);
    storageSet('language', next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                 bg-surface-100 text-gray-500 hover:bg-surface-200 hover:text-gray-700 transition-colors"
      title={current === 'es' ? 'Switch to English' : 'Cambiar a Español'}
    >
      <span className={current === 'es' ? 'font-bold text-brand-600' : 'opacity-40'}>ES</span>
      <span className="opacity-20 text-gray-400">|</span>
      <span className={current === 'en' ? 'font-bold text-brand-600' : 'opacity-40'}>EN</span>
    </button>
  );
}
