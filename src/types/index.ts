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

// ── Ext-Sandbox backend types ─────────────────────────────────────────────────

export type BackendRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type BackendJobStatus =
  | 'queued'
  | 'downloading'
  | 'static_analysis'
  | 'dynamic_analysis'
  | 'threat_intel'
  | 'completed'
  | 'failed';
export type BackendRecommendation =
  | 'UNINSTALL_IMMEDIATELY'
  | 'UNINSTALL_RECOMMENDED'
  | 'REVIEW_BEFORE_USE'
  | 'MONITOR'
  | 'NO_SIGNIFICANT_RISKS';
export type FindingCategory =
  | 'KEYLOGGER'
  | 'DATA_THEFT'
  | 'INJECTION'
  | 'EXFILTRATION'
  | 'PERSISTENCE'
  | 'DOMAIN_TARGETING';

export interface BackendFinding {
  category: FindingCategory;
  severity: BackendRiskLevel;
  description: string;
  evidence?: string;
}

export interface BackendPrivacyLabel {
  title: string;
  category: string;
  description: string;
  evidence: string[];
  severity: string;
}

export interface SandboxReport {
  jobId: string;
  riskLevel: BackendRiskLevel;
  confidence: number;
  score1: number;
  score2: number;
  score3: number;
  recommendation: BackendRecommendation;
  findings: BackendFinding[];
  contactedUrls: string[];
  abusedPermissions: string[];
  privacyLabels: BackendPrivacyLabel[];
  staticFindings: any[];
  dynamicEvidence: {
    networkRequests?: any[];
    domMutations?: any[];
    keyboardEvents?: any[];
    apiCalls?: any[];
    screenshotPaths?: string[];
  } | null;
  threatIntelResults: any[];
  contactedUrlsReputation: any[];
}

export interface SandboxJob {
  jobId: string;
  extensionName: string;
  status: BackendJobStatus;
  submittedAt: string;
  completedAt?: string;
  failureCount: number;
}
