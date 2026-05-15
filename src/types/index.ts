export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';

export interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icons: { size: number; url: string }[];
  permissions: string[];
  hostPermissions: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  lowPermissions: string[];
  elevatedPermissions: string[];
  criticalPermissions: string[];
}

export interface CriticalZone {
  id: string;
  category: string;
  patterns: string[];
  blockedExtensions: string[];
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  extensionId: string;
  extensionName: string;
  module: string;
  action: 'blocked' | 'warning' | 'allowed' | 'installed' | 'removed' | 'updated';
  detail: string;
}

export type OptionsPage = 'audit' | 'updates' | 'zones' | 'about';

// ── Ext-Sandbox backend types (new contract) ─────────────────────────────────

export type BackendJobStatus =
  | 'queued'
  | 'downloading'
  | 'preprocessing'
  | 'ai_analysis'
  | 'static_analysis'
  | 'dynamic_analysis'
  | 'threat_intel'
  | 'generating_report'
  | 'completed'
  | 'failed';

/** Derived in the frontend from the new report shape — used to colour badges. */
export type BackendRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export type FileType =
  | 'content_script'
  | 'background'
  | 'service_worker'
  | 'popup'
  | 'options_ui'
  | 'devtools'
  | 'sandbox'
  | 'override_page'
  | 'side_panel'
  | 'library'
  | 'unknown'
  | 'manifest';

export type DomainCategory =
  | 'propio_extension'
  | 'infraestructura_tecnica'
  | 'sensible_redes_sociales'
  | 'sensible_financiero'
  | 'sensible_identidad'
  | 'sensible_correo_productividad'
  | 'sensible_gubernamental'
  | 'sensible_llm'
  | 'sensible_data_broker'
  | 'desconocido';

export type StaticDiscoveryType =
  | 'permiso_chrome_manifest_no_usado'
  | 'permiso_chrome_manifest_riesgoso'
  | 'uso_api_chrome'
  | 'funcion_javascript_riesgosa'
  | 'flujo_datos_a_red'
  | 'codigo_ofuscado'
  | 'archivo_minificado'
  | 'archivo_huerfano'
  | 'archivo_anidado'
  | 'dependencia_no_resuelta'
  | 'script_remoto_mv3'
  | 'listener_teclado'
  | 'inyeccion_dom'
  | 'lectura_cookies'
  | 'lectura_storage_navegador'
  | 'correlacion_riesgo'
  | 'interceptacion_api'
  | 'suplantacion_api_navegador';

export type DomainDiscoveryType = 'url_en_codigo' | 'host_permission_manifest';

export interface VerdictedStaticFinding {
  fileType: FileType;
  filePath: string;
  discoveryType: StaticDiscoveryType;
  detail: string;
  line: number;
  codeSnippet?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  why?: string;
  confidence?: number;
  scoreImpact?: number;
  veredicto: 'positivo' | 'falso_positivo';
  razon: string;
}

export interface VerdictedDomainFinding {
  fileType: FileType;
  filePath: string;
  discoveryType: DomainDiscoveryType;
  domain: string;
  category: DomainCategory;
  priority?: number;
  line: number;
  veredicto: 'positivo' | 'falso_positivo';
  razon: string;
  threatIntelSummary?: string;
}

export interface DynamicVerdictedFinding {
  fileType: FileType;
  filePath: string;
  discoveryType: DomainDiscoveryType;
  domain: string;
  category: DomainCategory;
  priority?: number;
  line: number;
  veredicto: 'maliciosa' | 'sospechosa' | 'benigna' | 'inaccesible';
  accion_hecha: string;
  razon: string;
}

/** Per-step agent decision exposed by the backend for live inspection. */
export interface AgentStep {
  step: number;
  observation: string;
  action: string;
  target?: string;
  reasoning: string;
  result: string;
  timestamp: number;
}

export interface DomainNavigationLog {
  domain: string;
  url: string;
  navigatorUsed: 'stagehand' | 'intelligent_navigator';
  honeypotSessionUsed: boolean;
  agentSteps: AgentStep[];
  actionsPerformed: string[];
  error?: string;
}

export interface Agent1Output {
  proposito: string;
  categoria: string;
  acciones_esperadas: string[];
  acciones_NO_esperadas: string[];
  senales_alarma_manifest: string[];
  nivel_riesgo_inicial: 'bajo' | 'medio' | 'alto' | 'critico';
  razon_nivel_riesgo: string;
  /** Holistic verdict produced by Agent 1 after seeing all evidence. */
  veredicto_global?: 'maliciosa' | 'sospechosa' | 'benigna';
  /** 2-4 sentence executive summary written for the end user. */
  explicacion?: string;
  /** Whether the extension violates the Principle of Least Privilege (PoLP). */
  violacion_minimo_privilegio?: {
    detectada: boolean;
    razones: string[];
  };
  /** Findings the agent discovered by reading the source code directly.
   *  Complementary to the deterministic per-finding narratives. */
  hallazgos_propios?: AgentFinding[];
}

export interface AgentFinding {
  archivo: string;
  linea?: number;
  tipo: string;
  descripcion: string;
  severidad: 'bajo' | 'medio' | 'alto' | 'critico';
  snippet?: string;
}

// ── User-facing risk summary (10 categories) ─────────────────────────────────
// These come from the backend's UserRiskSummaryService and are what the user
// actually reads. They translate the raw findings into 10 categories matched
// to the user's questions ("can it read my pages?", "can it capture keys?", ...).

export type UserRiskSummaryId =
  | 'acceso_general_navegador'
  | 'modificacion_paginas'
  | 'lectura_informacion'
  | 'captura_credenciales'
  | 'keylogging'
  | 'seguimiento_privacidad'
  | 'manipulacion_trafico'
  | 'acceso_historial'
  | 'descargas_archivos'
  | 'ofuscacion_transparencia'
  | 'abuso_management'
  | 'mineria_recursos'
  | 'fingerprinting_severo';

export type UserRiskStatus =
  | 'no_detectado'
  | 'capacidad'
  | 'sospechoso'
  | 'critico';

export interface UserRiskSummaryItem {
  id: UserRiskSummaryId;
  titulo: string;
  estado: UserRiskStatus;
  resumen: string;
  evidencias: string[];
  /** IDs de reglas internas que explican por qué se marcó la categoría. */
  reglas_activadas?: string[];
  preguntas_responde: string[];
}

export interface UserFacingVerdict {
  nivel: 'bajo' | 'medio' | 'alto' | 'critico';
  veredicto: 'benigna' | 'sospechosa' | 'maliciosa';
  resumen: string;
  razones: string[];
}

/**
 * The new report shape returned by the backend. Plus a derived `riskLevel`
 * field computed by the frontend (service-worker.ts:normalizeReport) so
 * existing UI elements (bento stats, table badges) keep working.
 */
export interface SandboxReport {
  jobId: string;
  extensionId?: string;
  extensionName?: string;
  extensionVersion?: string;
  extensionAuthor?: string;
  crxHash?: string;
  analysisTimestamp?: string;
  analysisDuration?: number;
  agente1: Agent1Output | null;
  dominios_contactados_prioritarios: string[];
  /** Resumen orientado a usuario final: una tarjeta por cada una de las 10 categorías. */
  resumen_usuario: UserRiskSummaryItem[];
  /** Veredicto final legible derivado del resumen de usuario. */
  veredicto_usuario: UserFacingVerdict | null;
  hallazgos_estaticos_positivos: string[];
  hallazgos_dinamicos_positivos: string[];
  estructura: {
    resultado1: VerdictedStaticFinding[];
    resultado2_priority: VerdictedDomainFinding[];
    resultado2_unknown: VerdictedDomainFinding[];
    resultado_dinamico: DynamicVerdictedFinding[];
  };
  /** Step-by-step agent decisions per priority domain — used to inspect what the LLM did. */
  navegacionDominios: DomainNavigationLog[];
  puntuacion_riesgo?: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasons: string[];
  };
  /** Derived in normalizeReport so badges/stats stay coloured. */
  riskLevel: BackendRiskLevel;
}

export interface SandboxJob {
  jobId: string;
  extensionName: string;
  status: BackendJobStatus;
  submittedAt: string;
  completedAt?: string;
  failureCount: number;
}
