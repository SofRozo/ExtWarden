import { useState, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useExtensions } from '../../hooks/useExtensions';
import { getPermissionDescription } from '../../data/permissionDescriptions';
import type { RiskLevel, InstalledExtension } from '../../types';

const ITEMS_PER_PAGE = 4;

const riskBadge: Record<RiskLevel, { color: string }> = {
  critical: { color: 'bg-risk-criticalBg text-risk-criticalText' },
  high: { color: 'bg-orange-50 text-orange-700' },
  medium: { color: 'bg-risk-warningBg text-risk-warningText' },
  low: { color: 'bg-blue-50 text-blue-700' },
  safe: { color: 'bg-risk-safeBg text-risk-safeText' },
};

const iconColors = ['#7c3aed', '#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

// ── Bento Card ──

function BentoCard({
  icon,
  value,
  label,
  description,
  className,
  background,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  description: string;
  className?: string;
  background: ReactNode;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-white
        [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]
        transition-shadow duration-300 hover:shadow-lg h-[160px] ${className ?? ''}`}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">{background}</div>
      <div className="relative z-10 flex flex-col gap-1 p-6 h-full justify-center transition-all duration-300 group-hover:-translate-y-3">
        <div className="mb-1 origin-left transform-gpu transition-all duration-300 ease-in-out group-hover:scale-90">
          {icon}
        </div>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
        <h3 className="text-xs font-bold text-gray-400 tracking-[0.08em] uppercase">{label}</h3>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 translate-y-2 px-6 pb-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="text-[11px] text-gray-500">{description}</p>
      </div>
      <div className="pointer-events-none absolute inset-0 transition-all duration-300 group-hover:bg-black/[.02]" />
    </div>
  );
}

// ── Animated backgrounds for bento cards ──

function ShieldPulse() {
  return (
    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-brand-100/40 transition-transform duration-500 group-hover:scale-125">
      <div className="absolute inset-4 rounded-full bg-brand-200/30 animate-pulse" />
    </div>
  );
}

function AlertWave() {
  return (
    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-amber-100/50 transition-transform duration-500 group-hover:scale-125">
      <div className="absolute inset-5 rounded-full bg-amber-200/40 animate-pulse" style={{ animationDelay: '0.3s' }} />
    </div>
  );
}

function DangerGlow() {
  return (
    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-red-100/40 transition-transform duration-500 group-hover:scale-125">
      <div className="absolute inset-5 rounded-full bg-red-200/30 animate-pulse" style={{ animationDelay: '0.6s' }} />
    </div>
  );
}

export default function ExtensionAudit() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en';
  const { extensions, loading, toggleExtension } = useExtensions();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(
    () => extensions.filter(ext => ext.name.toLowerCase().includes(search.toLowerCase())),
    [extensions, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const stats = useMemo(() => ({
    total: extensions.length,
    high: extensions.filter(e => e.riskLevel === 'high').length,
    critical: extensions.filter(e => e.riskLevel === 'critical').length,
  }), [extensions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('audit.title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('audit.subtitle')}</p>
      </div>

      {/* Bento Stats */}
      <div className="grid grid-cols-3 gap-4">
        <BentoCard
          icon={
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
          }
          value={stats.total}
          label={t('audit.statsCards.total')}
          description={t('audit.statsCards.totalSub')}
          background={<ShieldPulse />}
        />
        <BentoCard
          icon={
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          }
          value={stats.high}
          label={t('audit.statsCards.high')}
          description={t('audit.statsCards.highSub')}
          background={<AlertWave />}
        />
        <BentoCard
          icon={
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </div>
          }
          value={stats.critical}
          label={t('audit.statsCards.critical')}
          description={t('audit.statsCards.criticalSub')}
          background={<DangerGlow />}
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]">
        {/* Table Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-100">
          <h3 className="text-base font-semibold text-gray-800">{t('audit.inventory')}</h3>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder={t('audit.search')}
              className="pl-9 pr-4 py-2 w-56 bg-surface-50 border border-surface-200 rounded-lg text-sm text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100">
              <th className="text-left px-6 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.extension')}</th>
              <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.category')}</th>
              <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.permissions')}</th>
              <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.risk')}</th>
              <th className="text-right px-6 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-400">
                  {lang === 'es' ? 'No se encontraron extensiones' : 'No extensions found'}
                </td>
              </tr>
            ) : (
              paged.map((ext, idx) => (
                <ExtRow key={ext.id} ext={ext} color={iconColors[idx % iconColors.length]} t={t} lang={lang} onToggle={toggleExtension} />
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-100">
          <p className="text-xs text-gray-400">
            {t('audit.showing', { from: paged.length, total: filtered.length })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg border border-surface-200 flex items-center justify-center text-gray-400 hover:bg-surface-50 disabled:opacity-30 transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  p === currentPage
                    ? 'bg-brand-600 text-white'
                    : 'border border-surface-200 text-gray-500 hover:bg-surface-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg border border-surface-200 flex items-center justify-center text-gray-400 hover:bg-surface-50 disabled:opacity-30 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function ExtRow({ ext, color, t, lang, onToggle }: {
  ext: InstalledExtension;
  color: string;
  t: (key: string) => string;
  lang: 'es' | 'en';
  onToggle: (id: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge = riskBadge[ext.riskLevel];
  const sensitivePerms = [...ext.suspiciousPermissions, ...ext.incoherentPermissions];
  const displayPerms = sensitivePerms.length > 0 ? sensitivePerms : ext.permissions.slice(0, 2);
  const visiblePerms = expanded ? displayPerms : displayPerms.slice(0, 3);
  const hiddenCount = displayPerms.length - 3;

  return (
    <tr className="hover:bg-surface-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {ext.icons.length > 0 ? (
            <img src={ext.icons[ext.icons.length - 1].url} alt="" className="w-9 h-9 rounded-xl flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: color }}>
              {ext.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-800">{ext.name}</p>
            <p className="text-[11px] text-gray-400">v{ext.version}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-gray-600">{ext.category}</td>
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1">
          {visiblePerms.map(p => (
            <span
              key={p}
              className={`text-[10px] leading-tight px-2 py-0.5 rounded inline-block ${
                ext.incoherentPermissions.includes(p)
                  ? 'bg-red-100 text-red-700'
                  : ext.suspiciousPermissions.includes(p)
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-surface-100 text-gray-500'
              }`}
              title={p}
            >
              {getPermissionDescription(p, lang)}
            </span>
          ))}
          {hiddenCount > 0 && !expanded && (
            <button onClick={() => setExpanded(true)} className="text-[10px] text-brand-600 hover:text-brand-700 font-medium cursor-pointer text-left">
              +{hiddenCount} {lang === 'es' ? 'más' : 'more'}
            </button>
          )}
          {expanded && hiddenCount > 0 && (
            <button onClick={() => setExpanded(false)} className="text-[10px] text-gray-400 hover:text-gray-500 font-medium cursor-pointer text-left">
              {lang === 'es' ? 'Ver menos' : 'Show less'}
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {t(`audit.riskLevels.${ext.riskLevel}`)}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => onToggle(ext.id, !ext.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
            ext.enabled ? 'bg-brand-600' : 'bg-gray-200'
          }`}
          title={ext.enabled
            ? (lang === 'es' ? 'Desactivar extensión' : 'Disable extension')
            : (lang === 'es' ? 'Activar extensión' : 'Enable extension')
          }
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              ext.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </td>
    </tr>
  );
}
