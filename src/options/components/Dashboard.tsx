import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useExtensions } from '../../hooks/useExtensions';
import { getZones, getActivityLog } from '../../utils/chromeApi';
import { useChromeStorage } from '../../hooks/useChromeStorage';
import type { ActivityEvent, CriticalZone } from '../../types';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en';
  const { extensions, loading: extsLoading } = useExtensions();
  const [zones, setZones] = useState<CriticalZone[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [blockedTotal] = useChromeStorage<number>('blockedTotal', 0);

  useEffect(() => {
    getZones().then(setZones);
    getActivityLog().then(setActivity);
  }, []);

  const privacyScore = useMemo(() => {
    if (extensions.length === 0) return 100;
    const totalRisk = extensions.reduce((sum, e) => sum + e.riskScore, 0);
    const avgRisk = totalRisk / extensions.length;
    return Math.max(0, Math.round(100 - avgRisk * 2));
  }, [extensions]);

  const riskVectors = useMemo(
    () => extensions.reduce((sum, e) => sum + e.elevatedPermissions.length + e.criticalPermissions.length, 0),
    [extensions],
  );

  const isSafe = privacyScore >= 70;

  const actionBadgeConfig: Record<ActivityEvent['action'], { label: string; color: string; icon: string }> = {
    allowed: { label: lang === 'es' ? 'Exitoso' : 'Allowed', color: 'text-emerald-600 bg-emerald-50', icon: '#10B981' },
    warning: { label: lang === 'es' ? 'Advertencia' : 'Warning', color: 'text-amber-600 bg-amber-50', icon: '#F59E0B' },
    blocked: { label: lang === 'es' ? 'Bloqueado' : 'Blocked', color: 'text-red-600 bg-red-50', icon: '#EF4444' },
    installed: { label: lang === 'es' ? 'Instalado' : 'Installed', color: 'text-blue-600 bg-blue-50', icon: '#3B82F6' },
    removed: { label: lang === 'es' ? 'Eliminado' : 'Removed', color: 'text-gray-600 bg-gray-100', icon: '#6B7280' },
    updated: { label: lang === 'es' ? 'Actualizado' : 'Updated', color: 'text-purple-600 bg-purple-50', icon: '#7c3aed' },
  };

  if (extsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('dashboard.breadcrumb')}</p>
      </div>

      {/* Hero Card + Privacy Score */}
      <div className="grid grid-cols-3 gap-6">
        {/* Hero */}
        <div className="col-span-2 bg-white rounded-2xl border border-surface-200 p-8 relative overflow-hidden">
          <div className="absolute right-12 top-1/2 -translate-y-1/2 w-52 h-52 rounded-full bg-brand-100/50" />
          <div className="absolute right-24 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-brand-200/40" />

          <div className="relative z-10">
            <span className={`inline-block text-[10px] font-bold tracking-[0.12em] px-3 py-1 rounded-full mb-4 ${
              isSafe ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {isSafe ? t('dashboard.statusSecure') : t('dashboard.statusCritical')}
            </span>

            <h2 className="text-2xl font-bold text-gray-800 mb-3 max-w-md leading-snug">
              {t('dashboard.heroTitle')}
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md leading-relaxed">
              {t('dashboard.heroDesc', { count: riskVectors })}
            </p>
          </div>
        </div>

        {/* Privacy Score */}
        <div className="bg-white rounded-2xl border border-surface-200 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <p className="text-[10px] font-bold text-gray-400 tracking-[0.12em] mb-2">{t('dashboard.privacyScore')}</p>
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-5xl font-extrabold text-brand-600">{privacyScore}</span>
            <span className="text-lg text-gray-400 font-medium">/100</span>
          </div>
          <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${privacyScore}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            {t('dashboard.scoreExcellent', { percent: 100 - privacyScore })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-5">
        <StatsCard
          icon={
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg>
            </div>
          }
          label={t('dashboard.stats.extensions')}
          value={`${extensions.length}`}
          valueLabel={t('dashboard.stats.extensionsActive')}
          sub={t('dashboard.stats.extensionsValidated')}
          subColor="text-emerald-500"
        />
        <StatsCard
          icon={
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </div>
          }
          label={t('dashboard.stats.threats')}
          value={`${blockedTotal}`}
          valueLabel={t('dashboard.stats.threatsBlocked')}
          sub={t('dashboard.stats.threatsTimeframe')}
          subColor="text-gray-400"
        />
        <StatsCard
          icon={
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          }
          label={t('dashboard.stats.zones')}
          value={`${zones.length}`}
          valueLabel={t('dashboard.stats.zonesRestricted')}
          sub={t('dashboard.stats.zonesLevel')}
          subColor="text-red-500"
        />
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-2xl border border-surface-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-100">
          <h3 className="text-base font-semibold text-gray-800">{t('dashboard.activity.title')}</h3>
        </div>
        <div className="divide-y divide-surface-100">
          {activity.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">{t('dashboard.activity.noActivity')}</p>
          ) : (
            activity.map(evt => {
              const cfg = actionBadgeConfig[evt.action];
              return (
                <div key={evt.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-50 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${cfg.icon}15` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.icon }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{evt.extensionName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {evt.module} &middot; {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ icon, label, value, valueLabel, sub, subColor }: {
  icon: JSX.Element;
  label: string;
  value: string;
  valueLabel: string;
  sub: string;
  subColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 p-5 flex items-center gap-4">
      {icon}
      <div>
        <p className="text-[10px] font-bold text-gray-400 tracking-[0.08em] mb-0.5">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-800">{value}</span>
          <span className="text-sm text-gray-500">{valueLabel}</span>
        </div>
        <p className={`text-[11px] mt-0.5 font-medium ${subColor}`}>
          <span className="mr-1">&bull;</span>{sub}
        </p>
      </div>
    </div>
  );
}
