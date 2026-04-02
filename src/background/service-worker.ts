/**
 * Background Service Worker — Manifest V3
 *
 * 1. Tab navigation → check if URL matches a critical zone
 * 2. Evaluate extensions using the thesis risk engine
 * 3. Send alerts to content scripts for risky extensions in zones
 * 4. Handle messages from popup/options/content scripts
 * 5. Track blocked counters & activity log
 */

import { computeRisk } from '../engine/riskEngine';

interface CriticalZone {
  id: string;
  category: string;
  patterns: string[];
  blockedExtensions: string[];
  createdAt: string;
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  extensionId: string;
  extensionName: string;
  module: string;
  action: 'blocked' | 'warning' | 'allowed' | 'installed' | 'removed';
  detail: string;
}

// ── Utility ──

function matchesZonePattern(hostname: string, pattern: string): boolean {
  // Normalize: remove protocol, trailing slashes
  const clean = pattern.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
  const host = hostname.toLowerCase();

  // Wildcard pattern like *.bancolombia.com
  if (clean.startsWith('*.')) {
    const domain = clean.slice(2);
    return host === domain || host.endsWith('.' + domain);
  }

  // Partial match: "bancolombia" matches "www.bancolombia.com"
  if (!clean.includes('.')) {
    return host.includes(clean);
  }

  // Exact domain match (bancolombia.com matches www.bancolombia.com too)
  return host === clean || host.endsWith('.' + clean);
}

function getHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

// ── Storage helpers ──

async function getFromStorage<T>(key: string, defaultValue: T): Promise<T> {
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => {
      resolve(result[key] !== undefined ? result[key] : defaultValue);
    });
  });
}

async function setInStorage(key: string, value: unknown): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

async function addActivity(event: Omit<ActivityEvent, 'id' | 'timestamp'>): Promise<void> {
  const log = await getFromStorage<ActivityEvent[]>('activityLog', []);
  log.unshift({
    ...event,
    id: `evt-${Date.now()}`,
    timestamp: new Date().toISOString(),
  });
  await setInStorage('activityLog', log.slice(0, 100));
}

async function incrementBlocked(): Promise<void> {
  const today = new Date().toDateString();
  const storedDate = await getFromStorage<string>('blockedDate', '');
  let count = await getFromStorage<number>('blockedToday', 0);
  let total = await getFromStorage<number>('blockedTotal', 0);

  if (storedDate !== today) {
    count = 0;
    await setInStorage('blockedDate', today);
  }

  await setInStorage('blockedToday', count + 1);
  await setInStorage('blockedTotal', total + 1);
}

// ── Zone Evaluation ──

/**
 * Extensions auto-disabled by zone protection.
 * Key: "tabId" → value: array of extension IDs that were disabled.
 * When the user leaves the zone (navigates away or closes tab),
 * these extensions are automatically re-enabled.
 */
const disabledByZone = new Map<number, string[]>();

async function reEnableExtensions(tabId: number): Promise<void> {
  const ids = disabledByZone.get(tabId);
  if (!ids || ids.length === 0) return;

  for (const extId of ids) {
    try {
      await chrome.management.setEnabled(extId, true);
    } catch {
      // Extension may have been uninstalled
    }
  }
  disabledByZone.delete(tabId);
}

async function evaluateTab(tabId: number, url: string): Promise<void> {
  const protectionEnabled = await getFromStorage<boolean>('protectionEnabled', true);
  if (!protectionEnabled) {
    await reEnableExtensions(tabId);
    return;
  }

  const hostname = getHostname(url);
  if (!hostname) {
    await reEnableExtensions(tabId);
    return;
  }

  const zones = await getFromStorage<CriticalZone[]>('criticalZones', []);

  // Find zone where ANY pattern matches the hostname
  const activeZone = zones.find(z =>
    z.patterns.some(p => matchesZonePattern(hostname, p))
  );

  // If NOT in a zone, re-enable any previously disabled extensions
  if (!activeZone) {
    await reEnableExtensions(tabId);
    return;
  }

  // Get category overrides
  const categoryOverrides = await getFromStorage<Record<string, string>>('categoryOverrides', {});

  // Evaluate ALL extensions
  const extensions = await chrome.management.getAll();
  const riskyExts = extensions.filter(ext => {
    if (ext.type !== 'extension' || !ext.enabled || ext.id === chrome.runtime.id) return false;

    const permissions = ext.permissions ?? [];
    const hostPermissions = ext.hostPermissions ?? [];
    const category = categoryOverrides[ext.id] ?? 'Tools';

    const risk = computeRisk(permissions, hostPermissions, category);

    // Block if risk is high or critical in a critical zone
    return risk.level === 'critical' || risk.level === 'high';
  });

  const disabledIds: string[] = [];

  for (const ext of riskyExts) {
    const permissions = ext.permissions ?? [];
    const hostPermissions = ext.hostPermissions ?? [];

    // Auto-disable the risky extension
    try {
      await chrome.management.setEnabled(ext.id, false);
      disabledIds.push(ext.id);
    } catch {
      // May lack permission to disable
    }

    // Notify user via content script alert
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'showAlert',
        extension: {
          id: ext.id,
          name: ext.name,
          permissions,
          hostPermissions,
        },
        zone: {
          id: activeZone.id,
          category: activeZone.category,
          pattern: activeZone.patterns.join(', '),
        },
      });
    } catch {
      // Content script not ready
    }

    await addActivity({
      extensionId: ext.id,
      extensionName: ext.name,
      module: `Zona: ${activeZone.category}`,
      action: 'blocked',
      detail: `Extensión deshabilitada en ${activeZone.category}`,
    });

    await incrementBlocked();
  }

  // Track which extensions were disabled for this tab
  if (disabledIds.length > 0) {
    const existing = disabledByZone.get(tabId) ?? [];
    disabledByZone.set(tabId, [...new Set([...existing, ...disabledIds])]);
  }
}

// ── Event Listeners ──

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    evaluateTab(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async activeInfo => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    evaluateTab(activeInfo.tabId, tab.url);
  }
});

// Re-enable extensions when tab is closed
chrome.tabs.onRemoved.addListener(tabId => {
  reEnableExtensions(tabId);
});

chrome.management.onInstalled.addListener(ext => {
  if (ext.type === 'extension' && ext.id !== chrome.runtime.id) {
    addActivity({
      extensionId: ext.id,
      extensionName: ext.name,
      module: 'Sistema',
      action: 'installed',
      detail: `Nueva extensión: ${ext.name} v${ext.version}`,
    });
  }
});

chrome.management.onUninstalled.addListener(id => {
  addActivity({
    extensionId: id,
    extensionName: id,
    module: 'Sistema',
    action: 'removed',
    detail: `Extensión desinstalada: ${id}`,
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'disableExtension' && message.extensionId) {
    chrome.management.setEnabled(message.extensionId, false, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        addActivity({
          extensionId: message.extensionId,
          extensionName: message.extensionId,
          module: 'Usuario',
          action: 'blocked',
          detail: 'Extensión deshabilitada por el usuario',
        });
        sendResponse({ success: true });
      }
    });
    return true;
  }
});

// Daily counter reset
chrome.alarms.create('resetDailyCounter', {
  when: (() => { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); })(),
  periodInMinutes: 24 * 60,
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'resetDailyCounter') {
    setInStorage('blockedToday', 0);
    setInStorage('blockedDate', new Date().toDateString());
  }
});

console.log('[ExtWarden] Service Worker initialized');
