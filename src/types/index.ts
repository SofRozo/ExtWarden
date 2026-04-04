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
