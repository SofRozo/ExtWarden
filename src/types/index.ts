export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';

export interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  icons: { size: number; url: string }[];
  permissions: string[];
  hostPermissions: string[];
  category: string;
  riskScore: number;
  riskLevel: RiskLevel;
  expectedPermissions: string[];
  suspiciousPermissions: string[];
  incoherentPermissions: string[];
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
  | 'popup'
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
  | 'desconocido';

export type StaticDiscoveryType =
  | 'permiso_chrome_manifest_no_usado'
  | 'uso_api_chrome'
  | 'funcion_javascript_riesgosa'
  | 'flujo_datos_a_red'
  | 'codigo_ofuscado'
  | 'script_remoto_mv3'
  | 'listener_teclado'
  | 'inyeccion_dom'
  | 'lectura_cookies'
  | 'lectura_storage_navegador';

export type DomainDiscoveryType = 'url_en_codigo' | 'host_permission_manifest';

export interface VerdictedStaticFinding {
  fileType: FileType;
  filePath: string;
  discoveryType: StaticDiscoveryType;
  detail: string;
  line: number;
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

export interface Agent1Output {
  proposito: string;
  categoria: string;
  acciones_esperadas: string[];
  acciones_NO_esperadas: string[];
  senales_alarma_manifest: string[];
  nivel_riesgo_inicial: 'bajo' | 'medio' | 'alto' | 'critico';
  razon_nivel_riesgo: string;
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
  hallazgos_estaticos_positivos: string[];
  hallazgos_dinamicos_positivos: string[];
  estructura: {
    resultado1: VerdictedStaticFinding[];
    resultado2_priority: VerdictedDomainFinding[];
    resultado2_unknown: VerdictedDomainFinding[];
    resultado_dinamico: DynamicVerdictedFinding[];
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
