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


export interface Agent1Output {
  proposito: string;
  categoria: string;
  nivel_riesgo_inicial: 'bajo' | 'medio' | 'alto' | 'critico';
  veredicto_global: 'maliciosa' | 'sospechosa' | 'benigna';
  explicacion: string;
  violacion_minimo_privilegio?: {
    detectada: boolean;
    razones: string[];
  };
  hallazgos_propios?: AgentFinding[];
  respuestas_usuario?: Record<string, { valor: 'si' | 'no_detectado' | 'posible'; razon: string }>;
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

export interface HallazgoCodigo {
  filePath: string;
  line: number;
  fileType: string;
  texto: string;
}

export interface UserRiskSummaryItem {
  id: UserRiskSummaryId;
  titulo: string;
  estado: UserRiskStatus;
  resumen: string;
  evidencias: string[];
  reglas_activadas?: string[];
  preguntas_responde: string[];
  hallazgos_codigo?: HallazgoCodigo[];
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
export interface PermisNoUsado {
  permission: string;
  categoria: 'critical' | 'high' | 'medium' | 'low';
  descripcion: string;
}

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
  resumen_usuario: UserRiskSummaryItem[];
  veredicto_usuario: UserFacingVerdict | null;
  hallazgos_estaticos_positivos: string[];
  permisos_no_usados: PermisNoUsado[];
  estructura: {
    resultado1: VerdictedStaticFinding[];
    resultado2_priority: VerdictedDomainFinding[];
    resultado2_unknown: VerdictedDomainFinding[];
  };
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
