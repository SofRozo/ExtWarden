import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useExtensions } from '../hooks/useExtensions';
import { useCurrentTab } from '../hooks/useCurrentTab';
import { useSandboxData } from '../hooks/useSandboxData';
import { openOptionsPage, storageGet } from '../utils/chromeApi';
import type { CriticalZone, RiskLevel, BackendRiskLevel } from '../types';

const DOT_COLORS: Record<RiskLevel, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-400',
  low:      'bg-emerald-400',
  safe:     'bg-emerald-400',
};

const BACKEND_DOT_COLORS: Record<BackendRiskLevel, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-500',
  MEDIUM:   'bg-amber-400',
  LOW:      'bg-blue-500',
  NONE:     'bg-emerald-400',
};

function formatDomain(hostname: string, lang: 'es' | 'en'): string {
  if (!hostname) return lang === 'es' ? 'Sin sitio activo' : 'No active site';
  if (hostname.startsWith('chrome-extension://') || hostname.startsWith('moz-extension://'))
    return lang === 'es' ? 'Extensión de Chrome' : 'Chrome Extension';
  if (hostname.startsWith('chrome://') || hostname.startsWith('about:'))
    return lang === 'es' ? 'Página del navegador' : 'Browser page';
  if (hostname === 'newtab' || hostname === 'new tab')
    return lang === 'es' ? 'Nueva pestaña' : 'New Tab';
  if (hostname === 'extensions')
    return lang === 'es' ? 'Página de extensiones' : 'Extensions page';
  if (/^[a-z]{32}$/.test(hostname))
    return lang === 'es' ? 'Extensión de Chrome' : 'Chrome Extension';
  return hostname;
}

function matchesZone(hostname: string, zone: CriticalZone): boolean {
  return zone.patterns.some(p => {
    const clean = p
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase();
    const host = hostname.toLowerCase();
    if (clean.startsWith('*.')) {
      const domain = clean.slice(2);
      return host === domain || host.endsWith('.' + domain);
    }
    if (!clean.includes('.')) return host.includes(clean);
    return host === clean || host.endsWith('.' + clean);
  });
}

export default function Popup() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en';
  const { extensions, loading: extsLoading } = useExtensions();
  const { url, loading: urlLoading } = useCurrentTab();
  const { jobs, reports } = useSandboxData();
  const [zones, setZones] = useState<CriticalZone[]>([]);

  useEffect(() => {
    storageGet<CriticalZone[]>('criticalZones', []).then(setZones);
  }, []);

  const activeZone = useMemo(
    () => url ? zones.find(z => matchesZone(url, z)) ?? null : null,
    [zones, url],
  );

  const riskyCount = useMemo(
    () => extensions.filter(e => e.riskLevel === 'critical' || e.riskLevel === 'high').length,
    [extensions],
  );
  void riskyCount;

  const isSafe = !activeZone;
  const isLoading = extsLoading || urlLoading;
  const domainLabel = formatDomain(url, lang);

  if (isLoading) {
    return (
      <div className="popup-container bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container bg-white flex flex-col rounded-2xl overflow-hidden">
      {/* Chip branding */}
      <div className="flex justify-center pt-4 pb-3">
        <div className="inline-flex items-center px-3 py-1 rounded-full border border-surface-200 text-xs font-medium text-gray-500">
          ExtWarden
        </div>
      </div>

      {/* Domain bento card */}
      <div className="px-5 pb-3">
        <div className="group relative overflow-hidden rounded-2xl bg-white h-[100px]
          [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-brand-100/40 pointer-events-none">
            <div className="absolute inset-4 rounded-full bg-brand-200/30 animate-pulse" />
          </div>
          <div className="relative z-10 flex flex-col justify-center h-full p-4">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-400 uppercase mb-1">
              {t('popup.detectedDomain')}
            </p>
            <p className="text-base font-bold text-gray-800 truncate">{domainLabel}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isSafe ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="text-[11px] font-medium text-gray-500">
                {t(isSafe ? 'popup.contextSafe' : 'popup.contextCritical')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Extension list */}
      <div className="px-5 pb-4 flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
          {lang === 'es' ? 'Extensiones activas' : 'Active extensions'} ({extensions.length})
        </p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {extensions.map(ext => {
            const job = jobs[ext.id];
            const report = reports[ext.id];
            const isCompleted = job?.status === 'completed' && !!report;
            const isAnalyzing = !!job && job.status !== 'completed' && job.status !== 'failed';

            return (
              <div key={ext.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {ext.icons.length > 0 ? (
                    <img
                      src={ext.icons[ext.icons.length - 1].url}
                      alt=""
                      className="w-5 h-5 rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-brand-600">
                        {ext.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-[12px] text-gray-700 truncate">{ext.name}</span>
                </div>

                {/* Risk indicator */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {isCompleted && report ? (
                    <>
                      <span className={`w-2 h-2 rounded-full ${BACKEND_DOT_COLORS[report.riskLevel]}`} />
                      <span className="text-[9px] text-green-600 font-bold">✓</span>
                    </>
                  ) : isAnalyzing ? (
                    <span className={`w-2 h-2 rounded-full animate-pulse ${DOT_COLORS[ext.riskLevel]}`} />
                  ) : (
                    <span className={`w-2 h-2 rounded-full ${DOT_COLORS[ext.riskLevel]}`} />
                  )}
                </div>
              </div>
            );
          })}
          {extensions.length === 0 && (
            <p className="text-xs text-gray-300 py-2">
              {lang === 'es' ? 'Sin extensiones instaladas' : 'No extensions installed'}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-surface-200">
        <button
          onClick={openOptionsPage}
          className="w-full text-center text-[12px] font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          {t('popup.openDashboard')} ↗
        </button>
      </div>
    </div>
  );
}
