import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ExtensionAudit from './components/ExtensionAudit';
import Updates from './components/Updates';
import ContextZones from './components/ContextZones';
import type { OptionsPage } from '../types';

type MainPage = Extract<OptionsPage, 'audit' | 'updates' | 'zones'>;

interface NavItem {
  id: MainPage;
  iconPath: string;
  labelKey: string;
}

const NAV: NavItem[] = [
  {
    id: 'audit',
    iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    labelKey: 'sidebar.audit',
  },
  {
    id: 'updates',
    iconPath: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    labelKey: 'sidebar.updates',
  },
  {
    id: 'zones',
    iconPath: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064',
    labelKey: 'sidebar.zones',
  },
];

export default function Options() {
  const { t } = useTranslation();
  const [page, setPage] = useState<MainPage>('audit');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-10 py-10">

        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-block border border-gray-200 rounded-full px-3 py-1 text-xs text-gray-500 mb-4">
            {t('app.name')}
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {t('app.headline')}
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {t('app.subheadline')}
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-white border border-gray-200 rounded-2xl p-1 gap-1">
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  page === item.id
                    ? 'bg-white shadow-sm border border-gray-200 text-brand-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.iconPath} />
                </svg>
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Page content */}
        {page === 'audit'   && <ExtensionAudit />}
        {page === 'updates' && <Updates />}
        {page === 'zones'   && <ContextZones />}

        {/* Language switcher bottom */}
        <div className="flex justify-end mt-8">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
