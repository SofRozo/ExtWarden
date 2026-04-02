import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">{t('sidebar.about')}</h1>

      <div className="bg-white border border-surface-200 rounded-2xl p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-600/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">{t('app.name')}</h2>
            <p className="text-sm text-gray-400">v1.0.0</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          {t('about.description')}
        </p>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-3">{t('about.featuresTitle')}</p>
          <div className="space-y-2">
            {(['riskAudit', 'contextZones', 'realtime', 'i18n', 'privacyFirst'] as const).map(key => (
              <div key={key} className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-5 h-5 bg-brand-100 rounded-md flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                {t(`about.features.${key}`)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-surface-200 rounded-2xl p-6">
        <p className="text-xs font-semibold text-gray-500 mb-3">{t('about.howItWorks')}</p>
        <div className="space-y-3">
          {(['step1', 'step2', 'step3'] as const).map((key, i) => (
            <div key={key} className="flex gap-3">
              <div className="w-6 h-6 bg-brand-50 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-brand-600">
                {i + 1}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{t(`about.steps.${key}`)}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-300 text-center">v1.0.0</p>
    </div>
  );
}
