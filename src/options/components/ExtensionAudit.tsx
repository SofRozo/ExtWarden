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
  BackendRiskLevel,
  DomainNavigationLog,
  AgentStep,
  AgentFinding,
  HallazgoCodigo,
  UserRiskSummaryItem,
  UserRiskStatus,
  UserFacingVerdict,
} from '../../types';

const ITEMS_PER_PAGE = 4;
const BACKEND_URL = 'http://localhost:3000';

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

// ── Agent finding card ──
// Renders one item that the LLM agent discovered by reading the source code.
// These complement the deterministic narratives (which still come from the
// rule engine) and let the user see what the agent itself flagged.
const severityBadge: Record<AgentFinding['severidad'], string> = {
  critico: 'bg-red-100 text-red-700',
  alto: 'bg-orange-100 text-orange-700',
  medio: 'bg-amber-100 text-amber-700',
  bajo: 'bg-blue-100 text-blue-700',
};

function AgentFindingCard({ finding }: { finding: AgentFinding }) {
  return (
    <div className="border border-surface-100 rounded-xl p-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${severityBadge[finding.severidad] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {finding.severidad}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
          {finding.tipo}
        </span>
        <span className="text-[11px] text-gray-500 font-mono break-all">
          {finding.archivo}
          {finding.linea ? `:${finding.linea}` : ''}
        </span>
      </div>
      <p className="text-sm text-gray-700 leading-snug">{finding.descripcion}</p>
      {finding.snippet && (
        <pre className="text-[11px] text-gray-600 bg-surface-50 rounded px-2 py-1 overflow-x-auto font-mono">
          {finding.snippet}
        </pre>
      )}
    </div>
  );
}

// ── Narrative finding card ──
// Renders one of the new narrative strings emitted by the backend report
// (hallazgos_estaticos_positivos / hallazgos_dinamicos_positivos).
function NarrativeFinding({ text, kind }: { text: string; kind: 'static' | 'dynamic' }) {
  return (
    <div className="border border-surface-100 rounded-xl p-3 flex gap-2.5 items-start">
      <span
        className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          kind === 'dynamic' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
        }`}
      >
        {kind === 'dynamic' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        )}
      </span>
      <p className="text-sm text-gray-700 leading-snug">{text}</p>
    </div>
  );
}

// ── Agent timeline (per priority domain) ──

const NAVIGATOR_LABEL: Record<DomainNavigationLog['navigatorUsed'], string> = {
  stagehand: 'Stagehand',
  intelligent_navigator: 'IntelligentNavigator',
};

const NAVIGATOR_COLOR: Record<DomainNavigationLog['navigatorUsed'], string> = {
  stagehand: 'bg-purple-100 text-purple-700',
  intelligent_navigator: 'bg-emerald-100 text-emerald-700',
};

const RESULT_COLOR: Record<string, string> = {
  success: 'text-emerald-700',
  failed: 'text-red-700',
  'no-op': 'text-gray-400',
};

function AgentStepRow({ step }: { step: AgentStep }) {
  return (
    <div className="border-l-2 border-surface-200 pl-3 pb-2 relative">
      <span className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-brand-400"></span>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase text-gray-500">
          paso {step.step}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-100 text-gray-600">
          {step.action}
        </span>
        <span
          className={`text-[10px] font-semibold ${RESULT_COLOR[step.result] ?? 'text-gray-500'}`}
        >
          {step.result}
        </span>
      </div>
      {step.target && (
        <p className="text-[11px] text-gray-500 font-mono mt-0.5 break-all">
          target: {step.target}
        </p>
      )}
      <p className="text-[12px] text-gray-700 mt-1">{step.observation}</p>
      <p className="text-[11px] text-gray-400 mt-0.5 italic">razón: {step.reasoning}</p>
    </div>
  );
}

function DomainNavigationCard({ nav }: { nav: DomainNavigationLog }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-surface-100 rounded-xl p-3 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-700 truncate">
            {nav.domain}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${NAVIGATOR_COLOR[nav.navigatorUsed]}`}
          >
            {NAVIGATOR_LABEL[nav.navigatorUsed]}
          </span>
          {nav.honeypotSessionUsed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              honeypot ON
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400">
          {nav.agentSteps.length} paso(s) · {nav.actionsPerformed.length} acción(es)
        </span>
      </div>
      {nav.error && (
        <p className="text-[11px] text-red-600 mt-1 italic">error: {nav.error}</p>
      )}
      {nav.agentSteps.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-brand-600 hover:text-brand-700 font-medium mt-2"
          >
            {expanded ? 'Ocultar pasos' : 'Ver pasos del agente →'}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2">
              {nav.agentSteps.map((s, i) => (
                <AgentStepRow key={i} step={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Agent 1 summary block ──

function Agent1Summary({ agente1 }: { agente1: NonNullable<SandboxReport['agente1']> }) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-bold tracking-wider uppercase text-gray-500 mb-1">
          4 · Opinión del Agente IA
        </p>
        <p className="text-[11px] text-gray-500 leading-snug">
          El agente leyó el código, cruzó los hallazgos con el propósito declarado
          y emitió su propia evaluación.
        </p>
      </div>

      <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
        {agente1.explicacion ? (
          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
            {agente1.explicacion}
          </p>
        ) : (
          <p className="text-sm text-gray-500 italic">El agente no generó una evaluación.</p>
        )}
      </div>
    </section>
  );
}

// ── Manifest-only risk block (frontend computation) ──
// Este bloque NO depende del backend. Se calcula desde los permisos declarados
// en el manifest de la extensión instalada (ext.elevatedPermissions /
// ext.criticalPermissions / ext.riskLevel). Se mantiene visible junto al
// análisis profundo para que el usuario pueda comparar "lo que pide" vs
// "lo que el código realmente hace".

function ManifestRiskBlock({ ext }: { ext: InstalledExtension }) {
  const { i18n } = useTranslation();
  const lang = (i18n.language?.startsWith('en') ? 'en' : 'es') as 'es' | 'en';
  const badge = riskBadge[ext.riskLevel];
  const elevated = ext.elevatedPermissions ?? [];
  const critical = ext.criticalPermissions ?? [];
  const low = ext.lowPermissions ?? [];
  const totalSensitive = elevated.length + critical.length;

  return (
    <section className="rounded-xl border border-surface-200 bg-surface-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-bold tracking-wider uppercase text-gray-500 mb-1">
            1 · Riesgo rápido (permisos declarados)
          </p>
          <p className="text-[11px] text-gray-500 leading-snug">
            Cálculo del frontend leyendo el manifest de la extensión. Mide lo
            que <strong>pide</strong> hacer, no lo que efectivamente hace.
          </p>
        </div>
        <span
          className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full ${badge.color}`}
        >
          {({ critical: 'Crítico', high: 'Alto', medium: 'Moderado', low: 'Bajo', safe: 'Sin riesgo' } as const)[ext.riskLevel] ?? ext.riskLevel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white border border-surface-100 px-2 py-1.5">
          <p className="text-base font-bold text-red-600">{critical.length}</p>
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wide">
            Críticos
          </p>
        </div>
        <div className="rounded-lg bg-white border border-surface-100 px-2 py-1.5">
          <p className="text-base font-bold text-amber-600">{elevated.length}</p>
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wide">
            Elevados
          </p>
        </div>
        <div className="rounded-lg bg-white border border-surface-100 px-2 py-1.5">
          <p className="text-base font-bold text-gray-500">{low.length}</p>
          <p className="text-[9px] uppercase font-semibold text-gray-400 tracking-wide">
            Bajos
          </p>
        </div>
      </div>
      {totalSensitive > 0 && (
        <div>
          <p className="text-[10px] font-semibold tracking-wider uppercase text-gray-400 mb-1">
            Permisos sensibles declarados
          </p>
          <div className="flex flex-wrap gap-1">
            {[...critical, ...elevated].slice(0, 12).map((perm) => {
              const isCritical = critical.includes(perm);
              return (
                <span
                  key={perm}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isCritical
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                  title={getPermissionDescription(perm, lang)}
                >
                  {perm}
                </span>
              );
            })}
            {totalSensitive > 12 && (
              <span className="text-[10px] text-gray-400 font-medium px-1.5 py-0.5">
                +{totalSensitive - 12} más
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ── User-facing verdict banner (backend deep analysis) ──
// Este bloque viene del UserRiskSummaryService del backend. Da el veredicto
// final basado en lo que el código realmente hace (análisis estático + AST +
// taint flow + dynamic Stagehand).

const USER_VERDICT_STYLES: Record<
  UserFacingVerdict['nivel'],
  { card: string; badge: string; dot: string; label: string }
> = {
  critico: {
    card: 'border-red-300 bg-red-50/60',
    badge: 'bg-red-100 text-red-700',
    dot: '#DC2626',
    label: 'Crítico',
  },
  alto: {
    card: 'border-orange-300 bg-orange-50/60',
    badge: 'bg-orange-100 text-orange-700',
    dot: '#EA580C',
    label: 'Alto',
  },
  medio: {
    card: 'border-amber-300 bg-amber-50/60',
    badge: 'bg-amber-100 text-amber-700',
    dot: '#CA8A04',
    label: 'Medio',
  },
  bajo: {
    card: 'border-emerald-300 bg-emerald-50/60',
    badge: 'bg-emerald-100 text-emerald-700',
    dot: '#16A34A',
    label: 'Bajo',
  },
};

const USER_VEREDICTO_LABEL: Record<
  UserFacingVerdict['veredicto'],
  string
> = {
  maliciosa: 'Maliciosa',
  sospechosa: 'Sospechosa',
  benigna: 'Benigna',
};

function UserVerdictBanner({ verdict }: { verdict: UserFacingVerdict }) {
  const style = USER_VERDICT_STYLES[verdict.nivel];
  return (
    <section className={`rounded-xl border-2 p-4 space-y-3 ${style.card}`}>
      <div>
        <p className="text-[10px] font-bold tracking-wider uppercase text-gray-500 mb-1">
          2 · Veredicto del análisis profundo
        </p>
        <p className="text-[11px] text-gray-500 leading-snug">
          El agente IA leyó el código fuente y emitió su veredicto.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full ${style.badge}`}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: style.dot }}
          />
          {USER_VEREDICTO_LABEL[verdict.veredicto]} · {style.label}
        </span>
      </div>
    </section>
  );
}

// ── Respuestas estructuradas del agente (10 preguntas) ──

const RESPUESTA_LABEL: Record<string, string> = {
  puede_leer_formularios:       '¿Puede leer formularios y contraseñas?',
  puede_ver_paginas_visitadas:  '¿Puede ver las páginas que visitas?',
  puede_capturar_contrasenas:   '¿Puede capturar contraseñas?',
  puede_modificar_paginas:      '¿Puede modificar páginas web?',
  puede_espiar_sin_saberlo:     '¿Puede espiarte sin que lo sepas?',
  puede_ver_historial:          '¿Puede ver tu historial de navegación?',
  puede_registrar_teclas:       '¿Puede registrar lo que escribes?',
  puede_interceptar_trafico:    '¿Puede interceptar tu tráfico de red?',
  codigo_oculto_o_sospechoso:   '¿Tiene código oculto o sospechoso?',
  puede_afectar_otras_extensiones: '¿Puede afectar otras extensiones?',
};

const RESPUESTA_STYLES: Record<'si' | 'no_detectado' | 'posible', { badge: string; dot: string; label: string }> = {
  si:           { badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500',     label: 'Sí' },
  posible:      { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400',   label: 'Posible' },
  no_detectado: { badge: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-300',    label: 'No detectado' },
};

function RespuestasUsuarioBlock({
  respuestas,
  fromAgent,
}: {
  respuestas: Record<string, 'si' | 'no_detectado' | 'posible'>;
  fromAgent: boolean;
}) {
  const ORDER = [
    'puede_capturar_contrasenas',
    'puede_registrar_teclas',
    'puede_espiar_sin_saberlo',
    'puede_leer_formularios',
    'puede_modificar_paginas',
    'puede_interceptar_trafico',
    'puede_ver_paginas_visitadas',
    'puede_ver_historial',
    'codigo_oculto_o_sospechoso',
    'puede_afectar_otras_extensiones',
  ];
  const entries = ORDER.filter((k) => k in respuestas).map((k) => [k, respuestas[k]] as [string, 'si' | 'no_detectado' | 'posible']);

  return (
    <section className="space-y-2">
      <div>
        <p className="text-[10px] font-bold tracking-wider uppercase text-gray-500 mb-1">
          3 · Preguntas frecuentes
        </p>
        <p className="text-[11px] text-gray-500 leading-snug">
          {fromAgent
            ? 'Respuestas del agente IA basadas en el código analizado.'
            : 'Respuestas derivadas del análisis estático (el agente no estuvo disponible).'}
        </p>
      </div>
      <div className="rounded-xl border border-surface-200 bg-white divide-y divide-surface-100 overflow-hidden">
        {entries.map(([key, value]) => {
          const style = RESPUESTA_STYLES[value] ?? RESPUESTA_STYLES.no_detectado;
          return (
            <div key={key} className="flex items-center justify-between gap-3 px-3 py-2">
              <p className="text-[12px] text-gray-700 leading-snug">{RESPUESTA_LABEL[key] ?? key}</p>
              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Code evidence block inside category card ──

const FILE_TYPE_COLORS: Record<string, string> = {
  'background':       'bg-purple-100 text-purple-700',
  'service worker':   'bg-purple-100 text-purple-700',
  'content script':   'bg-blue-100 text-blue-700',
  'popup':            'bg-teal-100 text-teal-700',
  'librería':         'bg-gray-100 text-gray-500',
};

function CodeEvidenceBlock({ findings }: { findings: HallazgoCodigo[] }) {
  if (findings.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-[11px] font-medium text-brand-600 hover:text-brand-700 select-none">
        Evidencia en el código ({findings.length})
      </summary>
      <div className="mt-2 space-y-1.5">
        {findings.map((f, i) => (
          <div key={i} className="rounded-lg border border-surface-100 bg-white px-2.5 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${FILE_TYPE_COLORS[f.fileType] ?? 'bg-surface-100 text-gray-500'}`}
              >
                {f.fileType}
              </span>
              <span className="text-[10px] font-mono text-gray-400 break-all">
                {f.filePath}:{f.line}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 leading-snug">{f.texto}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

// ── 10 categories grid ──

import { Globe, Edit3, Eye, Key, Keyboard, Radio, Route, Clock, Download, ShieldAlert, Settings, Cpu, Fingerprint } from 'lucide-react';

const CATEGORY_ICON: Record<UserRiskSummaryItem['id'], JSX.Element> = {
  acceso_general_navegador: <Globe size={20} className="text-blue-500" />,
  modificacion_paginas: <Edit3 size={20} className="text-indigo-500" />,
  lectura_informacion: <Eye size={20} className="text-teal-500" />,
  captura_credenciales: <Key size={20} className="text-amber-500" />,
  keylogging: <Keyboard size={20} className="text-orange-500" />,
  seguimiento_privacidad: <Radio size={20} className="text-purple-500" />,
  manipulacion_trafico: <Route size={20} className="text-red-500" />,
  acceso_historial: <Clock size={20} className="text-gray-500" />,
  descargas_archivos: <Download size={20} className="text-cyan-500" />,
  ofuscacion_transparencia: <ShieldAlert size={20} className="text-slate-500" />,
  abuso_management: <Settings size={20} className="text-rose-500" />,
  mineria_recursos: <Cpu size={20} className="text-yellow-600" />,
  fingerprinting_severo: <Fingerprint size={20} className="text-violet-500" />,
};

const STATUS_STYLES: Record<
  UserRiskStatus,
  { card: string; badge: string; label: string }
> = {
  critico: {
    card: 'border-red-200 bg-red-50/40',
    badge: 'bg-red-100 text-red-700',
    label: 'Crítico',
  },
  sospechoso: {
    card: 'border-amber-200 bg-amber-50/40',
    badge: 'bg-amber-100 text-amber-700',
    label: 'Sospechoso',
  },
  capacidad: {
    card: 'border-blue-200 bg-blue-50/40',
    badge: 'bg-blue-100 text-blue-700',
    label: 'Capacidad',
  },
  no_detectado: {
    card: 'border-surface-200 bg-white',
    badge: 'bg-surface-100 text-gray-500',
    label: 'No detectado',
  },
};

const STATUS_PRIORITY: Record<UserRiskStatus, number> = {
  critico: 4,
  sospechoso: 3,
  capacidad: 2,
  no_detectado: 1,
};

const CATEGORY_PRIORITY: Record<string, number> = {
  captura_credenciales: 100,
  keylogging: 95,
  lectura_informacion: 90,
  manipulacion_trafico: 85,
  modificacion_paginas: 80,
  seguimiento_privacidad: 75,
  acceso_general_navegador: 65,
  acceso_historial: 55,
  descargas_archivos: 45,
  ofuscacion_transparencia: 35,
};

function UserRiskCategoryCard({ item }: { item: UserRiskSummaryItem }) {
  const style = STATUS_STYLES[item.estado];
  const [expanded, setExpanded] = useState(item.estado === 'critico');
  const icon = CATEGORY_ICON[item.id] ?? '•';
  const hasMore = item.evidencias.length > 3 || (item.hallazgos_codigo?.length ?? 0) > 0;

  return (
    <div className={`rounded-xl border ${style.card} p-3 space-y-2`}>
      {/* Título + resumen */}
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-base leading-none mt-0.5 flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug">
            {item.titulo}
          </p>
          <p className="text-[12px] text-gray-600 leading-snug mt-0.5">
            {item.resumen}
          </p>
        </div>
      </div>

      {/* Preguntas que responde — siempre visibles */}
      {item.preguntas_responde.length > 0 && (
        <ul className="space-y-0.5 pl-1">
          {item.preguntas_responde.map((q, i) => (
            <li key={i} className="text-[11px] text-gray-400 italic leading-snug">
              {q}
            </li>
          ))}
        </ul>
      )}

      {/* Evidencias en lenguaje natural */}
      {item.evidencias.length > 0 && (
        <ul className="space-y-1 pl-1">
          {item.evidencias.slice(0, expanded ? undefined : 3).map((e, i) => (
            <li key={i} className="text-[11px] text-gray-700 leading-snug">
              · {e}
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-brand-600 hover:text-brand-700 font-medium"
        >
          {expanded ? 'Ocultar detalle' : 'Ver más →'}
        </button>
      )}

      {/* Evidencia en código — colapsada */}
      {expanded && item.hallazgos_codigo && item.hallazgos_codigo.length > 0 && (
        <CodeEvidenceBlock findings={item.hallazgos_codigo} />
      )}
    </div>
  );
}

function UserRiskCategoriesGrid({
  items,
}: {
  items: UserRiskSummaryItem[];
}) {
  // Ordenar por severidad para que el usuario vea lo importante primero.
  const sorted = [...items].sort(
    (a, b) =>
      STATUS_PRIORITY[b.estado] - STATUS_PRIORITY[a.estado] ||
      (CATEGORY_PRIORITY[b.id] ?? 0) - (CATEGORY_PRIORITY[a.id] ?? 0),
  );
  const active = sorted.filter((item) => item.estado !== 'no_detectado');
  const inactive = sorted.filter((item) => item.estado === 'no_detectado');
  return (
    <section>
      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
        Señales principales por categoría
      </h4>
      <div className="space-y-2">
        {active.map((item) => (
          <UserRiskCategoryCard key={item.id} item={item} />
        ))}
      </div>
      {inactive.length > 0 && (
        <details className="mt-3 rounded-xl border border-surface-100 bg-white p-3">
          <summary className="cursor-pointer text-[12px] font-semibold text-gray-500">
            Categorías sin señales fuertes ({inactive.length})
          </summary>
          <div className="mt-3 space-y-2">
            {inactive.map((item) => (
              <UserRiskCategoryCard key={item.id} item={item} />
            ))}
          </div>
        </details>
      )}
    </section>
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
  const versionChanged =
    !!report?.extensionVersion &&
    report.extensionVersion !== ext.version;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-[460px] bg-white shadow-2xl z-50 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-surface-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {ext.icons.length > 0 ? (
              <img src={ext.icons[ext.icons.length - 1].url} alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-brand-600">{ext.name.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{ext.name}</p>
              <p className="text-xs text-gray-400">v{ext.version}</p>
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

          {isCompleted && report && versionChanged && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <svg className="flex-shrink-0 mt-0.5 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-amber-800 leading-snug">
                  Esta extensión se actualizó de v{report.extensionVersion} a v{ext.version}
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5 leading-snug">
                  El análisis anterior puede no reflejar el comportamiento actual. Reanaliza para obtener un veredicto actualizado.
                </p>
                <button
                  onClick={onReanalyze}
                  className="mt-2 text-[11px] font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                >
                  Reanalizar ahora →
                </button>
              </div>
            </div>
          )}

          {isCompleted && report && (
            <>
              {/* Risk badge — derived backend score */}
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

              {/* Manifest-only quick risk (frontend computation) */}
              <ManifestRiskBlock ext={ext} />

              {/* Bloque 1 — Veredicto del agente (fuente principal) */}
              {report.veredicto_usuario && (
                <UserVerdictBanner verdict={report.veredicto_usuario} />
              )}

              {/* Bloque 2 — Respuestas estructuradas (agente o fallback determinístico) */}
              {(() => {
                const respuestas = report.respuestas_usuario ?? report.agente1?.respuestas_usuario;
                const fromAgent = !!report.agente1?.respuestas_usuario;
                return respuestas && Object.keys(respuestas).length > 0 ? (
                  <RespuestasUsuarioBlock respuestas={respuestas} fromAgent={fromAgent} />
                ) : null;
              })()}

              {/* Agent 1 narrative */}
              {report.agente1 && <Agent1Summary agente1={report.agente1} />}

              {/* Bloque 3 — Desglose técnico por categoría (colapsado) */}
              {report.resumen_usuario && report.resumen_usuario.length > 0 && (
                <details className="rounded-xl border border-surface-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-[12px] font-semibold text-gray-500 hover:text-gray-700 select-none">
                    Ver detalles técnicos por categoría ({report.resumen_usuario.filter(i => i.estado !== 'no_detectado').length} señales)
                  </summary>
                  <div className="px-4 pb-4 pt-1">
                    <UserRiskCategoriesGrid items={report.resumen_usuario} />
                  </div>
                </details>
              )}

              {/* Priority contacted domains */}
              <section>
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Dominios contactados (prioritarios)
                </h4>
                {report.dominios_contactados_prioritarios.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    No se detectó contacto con dominios sensibles
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {report.dominios_contactados_prioritarios.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-gray-400 flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                        </span>
                        <span className="truncate font-mono text-xs">{url}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Detalles técnicos — dinámicos y del agente, colapsados */}
              {(report.hallazgos_dinamicos_positivos.length > 0 ||
                (report.agente1?.hallazgos_propios?.length ?? 0) > 0) && (
                <details className="rounded-xl border border-surface-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 text-[12px] font-semibold text-gray-500 hover:text-gray-700 select-none">
                    Ver hallazgos técnicos adicionales
                  </summary>
                  <div className="px-4 pb-4 pt-1 space-y-4">
                    {report.hallazgos_dinamicos_positivos.length > 0 && (
                      <section>
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                          Resultados de análisis dinámico
                        </h4>
                        <div className="space-y-2">
                          {report.hallazgos_dinamicos_positivos.map((text, i) => (
                            <NarrativeFinding key={i} text={text} kind="dynamic" />
                          ))}
                        </div>
                      </section>
                    )}

                    {report.agente1?.hallazgos_propios &&
                      report.agente1.hallazgos_propios.length > 0 && (
                        <section>
                          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Hallazgos adicionales del agente
                          </h4>
                          <div className="space-y-2">
                            {report.agente1.hallazgos_propios.map((f, i) => (
                              <AgentFindingCard key={i} finding={f} />
                            ))}
                          </div>
                        </section>
                      )}
                  </div>
                </details>
              )}

              {/* Agent timeline — what the navigator did per priority domain */}
              {report.navegacionDominios && report.navegacionDominios.length > 0 && (
                <section>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                    Pasos del agente por dominio
                  </h4>
                  <div className="space-y-3">
                    {report.navegacionDominios.map((nav, i) => (
                      <DomainNavigationCard key={i} nav={nav} />
                    ))}
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

// ── Glossary Modal ─────────────────────────────────────────────────────────────

function GlossaryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[60] backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden max-h-[85vh]">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-brand-500" />
            <h3 className="font-bold text-gray-800">{t('glossary.title', 'Diccionario de Extensiones')}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            ✕
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Globe size={16} className="text-blue-500" />
              {t('glossary.content_script.title', 'Content Script')}
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('glossary.content_script.desc', 'Archivos que viven adentro de las páginas web que visitas (como tu banco o Facebook). Pueden ver o modificar todo lo que ves en la pantalla.')}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Radio size={16} className="text-purple-500" />
              {t('glossary.background.title', 'Background / Service Worker')}
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('glossary.background.desc', 'El "cerebro invisible" de la extensión. Se ejecuta de forma oculta todo el tiempo, coordinando permisos y comunicándose con servidores en Internet sin que lo notes.')}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Edit3 size={16} className="text-indigo-500" />
              {t('glossary.popup.title', 'Popup')}
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('glossary.popup.desc', 'La ventanita visual que se abre únicamente cuando haces clic en el ícono de la extensión arriba a la derecha.')}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
              <Key size={16} className="text-amber-500" />
              {t('glossary.manifest.title', 'Manifest')}
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('glossary.manifest.desc', 'La tarjeta de presentación o "contrato" de la extensión, donde le pide permisos a Chrome para funcionar.')}
            </p>
          </div>
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showGlossary, setShowGlossary] = useState(false);

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

  const handleUploadPackage = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BACKEND_URL}/analyze/upload`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as {
        jobId: string;
        extensionId: string;
        extensionName?: string;
        status: SandboxJob['status'];
      };
      const jobs = await storageGet<Record<string, SandboxJob>>('sandboxJobs', {});
      jobs[data.extensionId] = {
        jobId: data.jobId,
        extensionName: data.extensionName ?? file.name,
        status: data.status ?? 'queued',
        submittedAt: new Date().toISOString(),
        failureCount: 0,
      };
      await storageSet('sandboxJobs', jobs);
      if (isChromeExtension()) {
        chrome.runtime.sendMessage({ action: 'resumeSandboxPolling' });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('audit.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('audit.subtitle')}</p>
          {uploadError && (
            <p className="text-xs text-red-500 mt-1 max-w-xl truncate">{uploadError}</p>
          )}
        </div>
        <label
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 text-sm font-medium transition-colors ${
            uploading
              ? 'text-gray-400 bg-surface-50 cursor-wait'
              : 'text-gray-600 hover:bg-surface-50 cursor-pointer'
          }`}
        >
          <input
            type="file"
            accept=".zip,.crx"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void handleUploadPackage(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          {uploading ? (
            <span className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          )}
          {uploading ? 'Subiendo...' : 'Probar ZIP/CRX'}
        </label>
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
              <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.permissions')}</th>
              <th className="text-left px-4 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.risk')}</th>
              <th className="text-right px-6 py-3.5 text-[11px] font-semibold text-gray-400 tracking-[0.06em]">{t('audit.columns.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-400">
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

      {/* Glossary Button */}
      <button
        onClick={() => setShowGlossary(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 z-40 group"
        title={t('glossary.button_tooltip', '¿Qué significan estos términos?')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
      </button>

      <GlossaryModal open={showGlossary} onClose={() => setShowGlossary(false)} />
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
  const sensitivePerms = [...ext.elevatedPermissions, ...ext.criticalPermissions];
  const displayPerms = sensitivePerms.length > 0 ? sensitivePerms : ext.permissions.slice(0, 2);
  const visiblePerms = expanded ? displayPerms : displayPerms.slice(0, 3);
  const hiddenCount = displayPerms.length - 3;

  const isCompleted = job?.status === 'completed' && !!report;
  const isAnalyzing = !!job && job.status !== 'completed' && job.status !== 'failed' && (job.failureCount ?? 0) < 3;
  const hasFailed = job?.status === 'failed';
  const isUnavailable = !!job && !isCompleted && !hasFailed && (job.failureCount ?? 0) >= 3;

  // Total positive findings shown in the row when analysis is complete.
  const totalFindings = isCompleted && report
    ? report.hallazgos_estaticos_positivos.length + report.hallazgos_dinamicos_positivos.length
    : 0;

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

      {/* Permissions */}
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1">
          {visiblePerms.map(p => (
            <span
              key={p}
              className={`text-[10px] leading-tight px-2 py-0.5 rounded inline-block ${
                ext.criticalPermissions.includes(p)
                  ? 'bg-red-100 text-red-700'
                  : ext.elevatedPermissions.includes(p)
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
              {totalFindings > 0 && (
                <p className="text-[10px] text-gray-400">
                  {totalFindings} hallazgo(s) confirmados
                </p>
              )}
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
