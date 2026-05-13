/**
 * Datos de ejemplo para desarrollo (cuando las APIs de Chrome no están disponibles).
 * Los puntajes reflejan el modelo actual: peso del permiso + factor de host.
 */

import { computeRisk } from '../engine/riskEngine';
import type { InstalledExtension, CriticalZone, ActivityEvent } from '../types';

function makeExt(
  id: string,
  name: string,
  version: string,
  permissions: string[],
  hostPermissions: string[],
  category: string,
): InstalledExtension {
  const r = computeRisk(permissions, hostPermissions, category);
  return {
    id, name, version, enabled: true,
    icons: [],
    permissions, hostPermissions, category,
    riskScore: r.score,
    riskLevel: r.level,
    lowPermissions: r.lowPermissions,
    elevatedPermissions: r.mediumAndHighPermissions,
    criticalPermissions: r.criticalPermissions,
  };
}

// Ejemplo 1: Ad-blocker legítimo
const adblocker = makeExt(
  'ext-001', 'uBlock Origin', '1.57.0',
  ['storage', 'activeTab', 'declarativeNetRequest'],
  ['activeTab'],
  'Privacy & Security',
);

// Ejemplo 2: Herramienta sospechosa
const suspiciousTool = makeExt(
  'ext-002', 'SuperTab Pro', '3.1.0',
  ['storage', 'cookies', 'scripting', 'history', 'alarms'],
  ['<all_urls>'],
  'Tools',
);

// Ejemplo 3: Patrón DataByCloud
const databycloud = makeExt(
  'ext-003', 'HR Helper Suite', '2.0.1',
  ['cookies', 'management', 'scripting', 'storage', 'declarativeNetRequest'],
  ['https://workday.com/*', 'https://successfactors.com/*'],
  'Tools',
);

// Extensiones adicionales representativas
const devTools = makeExt(
  'ext-004', 'React DevTools', '5.2.0',
  ['storage', 'tabs', 'activeTab', 'scripting', 'contextMenus'],
  [],
  'Developer Tools',
);

const grammar = makeExt(
  'ext-005', 'Grammarly', '14.1.0',
  ['storage', 'activeTab', 'scripting', 'tabs'],
  ['<all_urls>'],
  'Education',
);

const darkMode = makeExt(
  'ext-006', 'Dark Reader', '4.9.85',
  ['storage', 'activeTab', 'tabs', 'declarativeNetRequest'],
  ['<all_urls>'],
  'Functionality & UI',
);

const passwordMgr = makeExt(
  'ext-007', 'Bitwarden', '2024.1.0',
  ['storage', 'activeTab', 'scripting', 'contextMenus', 'tabs'],
  ['<all_urls>'],
  'Privacy & Security',
);

const couponFinder = makeExt(
  'ext-008', 'Honey', '16.0.0',
  ['storage', 'activeTab', 'scripting', 'cookies', 'tabs'],
  ['<all_urls>'],
  'Shopping',
);

export const DUMMY_EXTENSIONS: InstalledExtension[] = [
  suspiciousTool,
  databycloud,
  grammar,
  passwordMgr,
  couponFinder,
  darkMode,
  devTools,
  adblocker,
];

export const DUMMY_ZONES: CriticalZone[] = [
  {
    id: 'zone-001',
    category: 'Banca',
    patterns: ['*.bancolombia.com', '*.davivienda.com', '*.bbva.com.co'],
    blockedExtensions: [],
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'zone-002',
    category: 'Gobierno',
    patterns: ['*.gov.co', '*.dian.gov.co'],
    blockedExtensions: [],
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

export const DUMMY_ACTIVITY: ActivityEvent[] = [
  {
    id: 'evt-001',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    extensionId: 'ext-002',
    extensionName: 'SuperTab Pro',
    module: 'Zona: Banca',
    action: 'blocked',
    detail: 'Extensión deshabilitada en zona Banca',
  },
  {
    id: 'evt-002',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    extensionId: 'ext-005',
    extensionName: 'Grammarly',
    module: 'Detección de Cambios',
    action: 'updated',
    detail: 'Cambio de versión: 14.0.0 → 14.1.0',
  },
  {
    id: 'evt-003',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    extensionId: 'ext-001',
    extensionName: 'uBlock Origin',
    module: 'Sistema',
    action: 'installed',
    detail: 'Nueva extensión: uBlock Origin v1.57.0',
  },
];
