import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useExtensions } from '../../hooks/useExtensions';
import { useSandboxData } from '../../hooks/useSandboxData';
import { getPermissionDescription } from '../../data/permissionDescriptions';
import { isChromeExtension, storageGet, storageSet } from '../../utils/chromeApi';
import type {
  RiskLevel,
  InstalledExtension,
  SandboxJob,
  SandboxReport,
  BackendFinding,
  BackendRiskLevel,
  BackendPrivacyLabel,
} from '../../types';

const ITEMS_PER_PAGE = 4;

const riskBadge: Record<RiskLevel, { color: string }> = {
  critical: { color: 'bg-risk-criticalBg text-risk-criticalText' },
  high:     { color: 'bg-orange-50 text-orange-700' },
  medium:   { color: 'bg-risk-warningBg text-risk-warningText' },
  low:      { color: 'bg-blue-50 text-blue-700' },
  safe:     { color: 'bg-risk-safeBg text-risk-safeText' },
};

const backendRiskBadge: Record<BackendRiskLevel, { color: string; label: string }> = {
  CRITICAL: { color: 'bg-risk-criticalBg text-risk-criticalText', label: 'Crítico' },
  HIGH:     { color: 'bg-orange-50 text-orange-700',              label: 'Alto' },
  MEDIUM:   { color: 'bg-risk-warningBg text-risk-warningText',   label: 'Moderado' },
  LOW:      { color: 'bg-blue-50 text-blue-700',                  label: 'Bajo' },
  NONE:     { color: 'bg-risk-safeBg text-risk-safeText',         label: 'Ninguno' },
};

const backendRiskDot: Record<BackendRiskLevel, string> = {
  CRITICAL: '#DC2626',
  HIGH:     '#EA580C',
  MEDIUM:   '#CA8A04',
  LOW:      '#2563EB',
  NONE:     '#16A34A',
};

const iconColors = ['#7c3aed', '#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

const recommendationLabels: Record<string, string> = {
  UNINSTALL_IMMEDIATELY: 'Desinstalar inmediatamente',
  REVIEW_BEFORE_USE:     'Revisar antes de usar',
  MONITOR:               'Monitorear',
  NO_SIGNIFICANT_RISKS:  'Sin riesgos significativos',
};

const categoryIcons: Record<string, ReactNode> = {
  KEYLOGGER:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 10h.01"/><path d="M10 10h.01"/><path d="M14 10h.01"/><path d="M18 10h.01"/><path d="M6 14h.01"/><path d="M18 14h.01"/><path d="M10 14h4"/></svg>,
  DATA_THEFT:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
  INJECTION:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.4 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg>,
  EXFILTRATION:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
  PERSISTENCE:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  DOMAIN_TARGETING: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
};

// ── Bento Card ──

function BentoCard({
  icon, value, label, description, className, background,
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

// ── Bento card backgrounds ──

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
function AnalyzedGlow() {
  return (
    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-purple-100/40 transition-transform duration-500 group-hover:scale-125">
      <div className="absolute inset-5 rounded-full bg-purple-200/30 animate-pulse" style={{ animationDelay: '0.9s' }} />
    </div>
  );
}

// ── Finding card ──

function FindingCard({ finding }: { finding: BackendFinding }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const severityColor: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    HIGH:     'bg-orange-100 text-orange-700',
    MEDIUM:   'bg-amber-100 text-amber-700',
    LOW:      'bg-blue-100 text-blue-700',
  };
  const category = String((finding as unknown as Record<string, unknown>).category ?? finding.category ?? '');
  const severity = String((finding as unknown as Record<string, unknown>).severity ?? finding.severity ?? '');
  const description = String((finding as unknown as Record<string, unknown>).description ?? finding.description ?? '');
  const rawEvidence = (finding as unknown as Record<string, unknown>).evidence ?? finding.evidence;
  const evidence = rawEvidence != null
    ? (typeof rawEvidence === 'object' ? JSON.stringify(rawEvidence, null, 2) : String(rawEvidence))
    : undefined;

  return (
    <div className="border border-surface-100 rounded-xl p-3 space-y-1.5 bg-surface-50/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="flex-shrink-0 mt-0.5 text-gray-400">
            {categoryIcons[category] ?? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-700 leading-snug">
              {description}
              {(finding as any).count > 1 && (
                <span className="ml-1.5 text-brand-600 font-bold">
                  (x{(finding as any).count})
                </span>
              )}
            </span>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${severityColor[severity] ?? 'bg-gray-100 text-gray-600'}`}>
          {severity}
        </span>
      </div>
      {evidence && (
        <>
          <button
            onClick={() => setShowEvidence(v => !v)}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            {showEvidence ? 'Ocultar evidencia' : 'Ver evidencia'}
          </button>
          {showEvidence && (
            <pre className="text-[10px] bg-surface-50 border border-surface-100 rounded-lg p-2 overflow-x-auto text-gray-600 whitespace-pre-wrap break-all">
              {evidence}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

// ── Privacy Label Card ──

function PrivacyLabelCard({ label }: { label: BackendPrivacyLabel | string | any }) {
  const [showEvidence, setShowEvidence] = useState(false);
  
  let parsedLabel: BackendPrivacyLabel;
  if (typeof label === 'string') {
    try {
      parsedLabel = JSON.parse(label);
    } catch (e) {
      parsedLabel = { title: 'Unknown Label', category: 'UNKNOWN', description: label, evidence: [], severity: 'LOW' } as BackendPrivacyLabel;
    }
  } else {
    parsedLabel = label as BackendPrivacyLabel;
  }

  const severityStyles: Record<string, string> = {
    critical: 'bg-red-50 text-red-700',
    high:     'bg-orange-50 text-orange-700',
    medium:   'bg-amber-50 text-amber-700',
    low:      'bg-blue-50 text-blue-700',
    CRITICAL: 'bg-red-50 text-red-700',
    HIGH:     'bg-orange-50 text-orange-700',
    MEDIUM:   'bg-amber-50 text-amber-700',
    LOW:      'bg-blue-50 text-blue-700',
  };

  const currentSeverityStyle = severityStyles[parsedLabel.severity] || 'bg-surface-50 text-gray-600';

  const categoryLower = (parsedLabel.category || '').toLowerCase();
  let Icon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );
  if (categoryLower.includes('security') || categoryLower.includes('shield')) {
    Icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
  } else if (categoryLower.includes('monitor') || categoryLower.includes('eye') || categoryLower.includes('tracking')) {
    Icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
  } else if (categoryLower.includes('data') || categoryLower.includes('storage') || categoryLower.includes('collection')) {
    Icon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>;
  }

  return (
    <div className="border border-surface-100 rounded-xl p-4 space-y-2 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 text-gray-500 flex-shrink-0">
            {Icon}
          </div>
          <div>
            <h5 className="font-semibold text-[14px] text-gray-800 leading-tight">
              {parsedLabel.title || 'Alerta de Privacidad'}
            </h5>
            <p className="mt-1 text-[12px] text-gray-600 leading-relaxed">
              {parsedLabel.description}
            </p>
          </div>
        </div>
        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex-shrink-0 uppercase tracking-wide ${currentSeverityStyle}`}>
          {parsedLabel.severity || 'N/A'}
        </span>
      </div>
      
      {Array.isArray(parsedLabel.evidence) && parsedLabel.evidence.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowEvidence(v => !v)}
            className="flex items-center gap-1.5 text-[11px] text-brand-600 hover:text-brand-700 font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transform transition-transform ${showEvidence ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            Ver Evidencias ({parsedLabel.evidence.length} encontradas)
          </button>
          
          {showEvidence && (
            <div className="mt-2 pl-3 border-l-2 border-surface-100">
              <ul className="space-y-1.5 list-none">
                {parsedLabel.evidence.map((item, idx) => (
                  <li key={idx} className="relative pl-3 text-[11px] text-gray-500 font-mono italic break-all">
                    <span className="absolute left-0 top-[6px] w-1 h-1 rounded-full bg-gray-300"></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton while analyzing ──

function SkeletonAnalysis() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span>Analizando comportamiento real de esta extensión...</span>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="h-14 bg-surface-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

// ── Extension Drawer ──

function ExtensionDrawer({
  ext, job, report, open, onClose, onReanalyze,
}: {
  ext: InstalledExtension;
  job: SandboxJob | undefined;
  report: SandboxReport | undefined;
  open: boolean;
  onClose: () => void;
  onReanalyze: () => void;
}) {
  const isAnalyzing = !!job && job.status !== 'completed' && job.status !== 'failed';
  const isCompleted = job?.status === 'completed' && !!report;
  const isFailed = job?.status === 'failed';

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-[550px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.1)] z-50 flex flex-col
          transform transition-transform duration-400 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-surface-100 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            {ext.icons.length > 0 ? (
              <img src={ext.icons[ext.icons.length - 1].url} alt="" className="w-12 h-12 rounded-2xl shadow-sm flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-lg font-bold text-brand-600">{ext.name.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate pr-4">{ext.name}</h2>
              <p className="text-xs text-gray-400 font-medium tracking-wide">VERSIÓN {ext.version}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-surface-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-surface-50 flex-shrink-0 ml-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isAnalyzing && <SkeletonAnalysis />}

          {isCompleted && report && (
            <>
              {/* Risk + recommendation */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full ${backendRiskBadge[report.riskLevel]?.color ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: backendRiskDot[report.riskLevel] }}
                    />
                    {backendRiskBadge[report.riskLevel]?.label ?? report.riskLevel}
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                    Verificado ✓
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {recommendationLabels[report.recommendation] ?? report.recommendation}
                </p>
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                    <span>Confianza del análisis</span>
                    <span className="font-semibold text-gray-600">{Math.round(report.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.round(report.confidence * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Findings */}
              <section>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Comportamiento detectado
                </h4>
                {(report.findings ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No se detectaron comportamientos maliciosos</p>
                ) : (
                  <div className="space-y-2">
                    {(report.findings ?? []).map((f, i) => <FindingCard key={i} finding={f} />)}
                  </div>
                )}
              </section>

              {/* Contacted URLs */}
              <section>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  URLs contactadas
                </h4>
                {(report.contactedUrls ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No se detectó contacto con servidores externos</p>
                ) : (
                  <div className="space-y-1.5">
                    {(report.contactedUrls ?? []).map((url, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-gray-400 flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        </span>
                        <span className="truncate font-mono text-xs">{typeof url === 'string' ? url : JSON.stringify(url)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Abused permissions */}
              <section>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Permisos abusados
                </h4>
                {(report.abusedPermissions ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Ningún permiso abusado detectado</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(report.abusedPermissions ?? []).map((p, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                        {typeof p === 'string' ? p : JSON.stringify(p)}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* Privacy labels */}
              <section>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Etiquetas de privacidad
                </h4>
                {(report.privacyLabels ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Sin etiquetas de privacidad</p>
                ) : (
                  <div className="space-y-2">
                    {(report.privacyLabels ?? []).map((label, i) => (
                      <PrivacyLabelCard key={i} label={label} />
                    ))}
                  </div>
                )}
              </section>

              {/* Dynamic Evidence Screenshots */}
              {report.dynamicEvidence?.screenshotPaths && report.dynamicEvidence.screenshotPaths.length > 0 && (
                <section>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Capturas de Pantalla (Evidencia Dinámica)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {report.dynamicEvidence.screenshotPaths.map((path, i) => {
                      const pathParts = path.split('/');
                      const filename = pathParts[pathParts.length - 1];
                      return (
                        <div key={i} className="border border-surface-100 rounded overflow-hidden">
                          <img
                            src={`http://localhost:3000/screenshot/${report.jobId}/${filename}`}
                            alt={`Evidencia ${i + 1}`}
                            className="w-full h-auto"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}

          {isFailed && !isAnalyzing && (
            <div className="text-center py-8 space-y-2">
              <p className="text-gray-400 text-2xl flex justify-center mb-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </p>
              <p className="text-sm text-gray-500">El análisis ha fallado</p>
              <p className="text-xs text-gray-400">Usa el botón de abajo para reintentar</p>
            </div>
          )}

          {!job && (
            <div className="text-center py-8 space-y-2">
              <p className="text-gray-400 text-2xl flex justify-center mb-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </p>
              <p className="text-sm text-gray-500">Sin datos de análisis todavía</p>
              <p className="text-xs text-gray-400">Usa el botón de abajo para iniciar el análisis</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-surface-100 flex-shrink-0">
          <button
            onClick={onReanalyze}
            disabled={isAnalyzing}
            className={`w-full py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${
              isAnalyzing
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-brand-300 text-brand-600 hover:bg-brand-50'
            }`}
          >
            {isAnalyzing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Analizando...
              </span>
            ) : job ? (
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reanalizar
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Analizar en profundidad
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExtensionAudit() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en';
  const { extensions, loading, toggleExtension } = useExtensions();
  const { jobs, reports } = useSandboxData();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedExt, setSelectedExt] = useState<InstalledExtension | null>(null);

  // Open drawer when returning from a notification click
  useEffect(() => {
    if (loading || extensions.length === 0) return;
    storageGet<string | null>('openDrawerForExtension', null).then(extId => {
      if (!extId) return;
      const ext = extensions.find(e => e.id === extId);
      if (ext) {
        setSelectedExt(ext);
        void storageSet('openDrawerForExtension', null);
      }
    });
  }, [extensions, loading]);

  const handleReanalyze = useCallback((extId: string, extName: string, onResult?: (ok: boolean) => void) => {
    if (isChromeExtension()) {
      chrome.runtime.sendMessage(
        { action: 'reanalyzeExtension', extensionId: extId, extensionName: extName },
        (response: { success: boolean } | undefined) => {
          onResult?.(response?.success ?? false);
        },
      );
    } else {
      onResult?.(false);
    }
  }, []);

  const filtered = useMemo(
    () => extensions.filter(ext => ext.name.toLowerCase().includes(search.toLowerCase())),
    [extensions, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const isAnyAnalyzing = useMemo(
    () => Object.values(jobs).some(j => j.status !== 'completed' && j.status !== 'failed'),
    [jobs],
  );

  const stats = useMemo(() => ({
    total: extensions.length,
    high: extensions.filter(e => {
      const r = reports[e.id];
      return r ? r.riskLevel === 'HIGH' : e.riskLevel === 'high';
    }).length,
    critical: extensions.filter(e => {
      const r = reports[e.id];
      return r ? r.riskLevel === 'CRITICAL' : e.riskLevel === 'critical';
    }).length,
    analyzed: extensions.filter(e => jobs[e.id]?.status === 'completed').length,
  }), [extensions, jobs, reports]);

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

      {/* Bento Stats — 4 cards */}
      <div className="grid grid-cols-4 gap-4">
        <BentoCard
          icon={
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            </div>
          }
          value={stats.critical}
          label={t('audit.statsCards.critical')}
          description={t('audit.statsCards.criticalSub')}
          background={<DangerGlow />}
        />
        <BentoCard
          icon={
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          }
          value={`${stats.analyzed}/${stats.total}`}
          label={lang === 'es' ? 'ANALIZADOS' : 'ANALYZED'}
          description={lang === 'es' ? 'Análisis de comportamiento completado' : 'Behavior analysis completed'}
          background={<AnalyzedGlow />}
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-100">
          <h3 className="text-base font-semibold text-gray-800">{t('audit.inventory')}</h3>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder={t('audit.search')}
              className="pl-9 pr-4 py-2 w-56 bg-surface-50 border border-surface-200 rounded-lg text-sm text-gray-600 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
            />
          </div>
        </div>

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
                <ExtRow
                  key={ext.id}
                  ext={ext}
                  color={iconColors[idx % iconColors.length]}
                  t={t}
                  lang={lang}
                  onToggle={toggleExtension}
                  job={jobs[ext.id]}
                  report={reports[ext.id]}
                  onClick={() => setSelectedExt(ext)}
                  onReanalyze={handleReanalyze}
                  isAnyAnalyzing={isAnyAnalyzing}
                />
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

      {/* Detail drawer */}
      {selectedExt && (
        <ExtensionDrawer
          ext={selectedExt}
          job={jobs[selectedExt.id]}
          report={reports[selectedExt.id]}
          open={true}
          onClose={() => setSelectedExt(null)}
          onReanalyze={() => {
            handleReanalyze(selectedExt.id, selectedExt.name);
          }}
        />
      )}
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────

function ExtRow({
  ext, color, t, lang, onToggle, job, report, onClick, onReanalyze, isAnyAnalyzing,
}: {
  ext: InstalledExtension;
  color: string;
  t: (key: string) => string;
  lang: 'es' | 'en';
  onToggle: (id: string, enabled: boolean) => void;
  job?: SandboxJob;
  report?: SandboxReport;
  onClick: () => void;
  onReanalyze: (extId: string, extName: string, onResult?: (ok: boolean) => void) => void;
  isAnyAnalyzing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const triggerAnalyze = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSubmitting(true);
    setSubmitError(false);
    onReanalyze(ext.id, ext.name, (ok) => {
      setSubmitting(false);
      if (!ok) setSubmitError(true);
    });
  };
  const badge = riskBadge[ext.riskLevel];
  const sensitivePerms = [...ext.suspiciousPermissions, ...ext.incoherentPermissions];
  const displayPerms = sensitivePerms.length > 0 ? sensitivePerms : ext.permissions.slice(0, 2);
  const visiblePerms = expanded ? displayPerms : displayPerms.slice(0, 3);
  const hiddenCount = displayPerms.length - 3;

  const isCompleted = job?.status === 'completed' && !!report;
  const isAnalyzing = !!job && job.status !== 'completed' && job.status !== 'failed' && (job.failureCount ?? 0) < 3;
  const hasFailed = job?.status === 'failed';
  const isUnavailable = !!job && !isCompleted && !hasFailed && (job.failureCount ?? 0) >= 3;

  return (
    <tr
      className="hover:bg-surface-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Extension name + icon */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {ext.icons.length > 0 ? (
            <img src={ext.icons[ext.icons.length - 1].url} alt="" className="w-9 h-9 rounded-xl flex-shrink-0" />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {ext.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-800">{ext.name}</p>
            <p className="text-[11px] text-gray-400">v{ext.version}</p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-4 text-sm text-gray-600">{ext.category}</td>

      {/* Permissions + backend privacy labels */}
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
            <button
              onClick={e => { e.stopPropagation(); setExpanded(true); }}
              className="text-[10px] text-brand-600 hover:text-brand-700 font-medium cursor-pointer text-left"
            >
              +{hiddenCount} {lang === 'es' ? 'más' : 'more'}
            </button>
          )}
          {expanded && hiddenCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(false); }}
              className="text-[10px] text-gray-400 hover:text-gray-500 font-medium cursor-pointer text-left"
            >
              {lang === 'es' ? 'Ver menos' : 'Show less'}
            </button>
          )}
          {/* Backend privacy labels */}
          {isCompleted && report && (report.privacyLabels ?? []).slice(0, 2).map((labelObj, idx) => {
            let labelTitle = 'Etiqueta de privacidad';
            if (typeof labelObj === 'string') {
              try {
                const parsed = JSON.parse(labelObj);
                labelTitle = parsed.title || labelTitle;
              } catch (e) {
                labelTitle = labelObj;
              }
            } else if (labelObj && typeof labelObj === 'object') {
              labelTitle = (labelObj as any).title || labelTitle;
            }
            
            return (
              <span
                key={idx}
                className="text-[10px] leading-tight px-2 py-0.5 rounded inline-block bg-red-100 text-red-700"
                title={labelTitle}
              >
                {labelTitle.length > 28 ? labelTitle.slice(0, 28) + '…' : labelTitle}
              </span>
            );
          })}
        </div>
      </td>

      {/* Risk level */}
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1.5">
          {isCompleted && report ? (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${backendRiskBadge[report.riskLevel]?.color ?? ''}`}>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: backendRiskDot[report.riskLevel] }}
                  />
                  {backendRiskBadge[report.riskLevel]?.label ?? report.riskLevel}
                </span>
                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">
                  Verificado ✓
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                Confianza: {Math.round(report.confidence * 100)}%
              </p>
            </>
          ) : (
            <>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {t(`audit.riskLevels.${ext.riskLevel}`)}
              </span>
              {isAnalyzing && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 border border-brand-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <p className="text-[10px] text-gray-400">
                    {job && job.status !== 'queued'
                      ? 'Analizando comportamiento...'
                      : 'Solo permisos · Analizando...'}
                  </p>
                </div>
              )}
              {!job && (
                <button
                  onClick={submitting ? undefined : triggerAnalyze}
                  disabled={isAnyAnalyzing || submitting}
                  className={`text-[10px] font-medium text-left ${
                    submitting ? 'text-gray-400 cursor-wait' :
                    submitError ? 'text-red-500' :
                    isAnyAnalyzing ? 'text-gray-300 cursor-not-allowed' :
                    'text-brand-600 hover:text-brand-700'
                  }`}
                >
                  {submitting ? 'Conectando...' :
                   submitError ? '✕ Error al conectar · Reintentar' :
                   isAnyAnalyzing ? 'Esperando análisis previo...' :
                   'Analizar en profundidad →'}
                </button>
              )}
              {isUnavailable && (
                <p className="text-[10px] text-gray-400">☁ Análisis no disponible</p>
              )}
              {hasFailed && (
                <button
                  onClick={triggerAnalyze}
                  className="text-[10px] text-red-500 hover:text-red-600 font-medium text-left"
                >
                  Error en análisis · Reintentar
                </button>
              )}
            </>
          )}
        </div>
      </td>

      {/* Toggle */}
      <td className="px-6 py-4 text-right">
        <button
          onClick={e => { e.stopPropagation(); onToggle(ext.id, !ext.enabled); }}
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
