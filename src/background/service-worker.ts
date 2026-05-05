/**
 * Background Service Worker — Manifest V3
 *
 * 1. Tab navigation → check if URL matches a critical zone
 * 2. Evaluate extensions using the thesis risk engine
 * 3. Send alerts to content scripts for risky extensions in zones
 * 4. Handle messages from popup/options/content scripts
 * 5. Track blocked counters & activity log
 */

import { computeRisk, inferCategory } from '../engine/riskEngine';

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
  // Normalize: remove protocol, path, port and trailing slashes — keep only the host
  const clean = pattern
    .replace(/^https?:\/\//, '')  // strip protocol
    .split('/')[0]                 // strip path
    .split(':')[0]                 // strip port
    .replace(/\.*$/, '')           // strip trailing dots
    .toLowerCase();
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
      resolve(result[key] !== undefined ? (result[key] as T) : defaultValue);
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

  // Extensions still held by other tabs must not be re-enabled
  const heldElsewhere = new Set<string>();
  for (const [otherTabId, otherIds] of disabledByZone.entries()) {
    if (otherTabId !== tabId) otherIds.forEach(id => heldElsewhere.add(id));
  }

  for (const extId of ids) {
    if (heldElsewhere.has(extId)) continue;
    try {
      await chrome.management.setEnabled(extId, true);
    } catch {
      // Extension may have been uninstalled
    }
  }
  disabledByZone.delete(tabId);
}

async function evaluateTab(tabId: number, url: string): Promise<void> {
  console.log('[ExtWarden] evaluateTab →', url);

  const protectionEnabled = await getFromStorage<boolean>('protectionEnabled', true);
  console.log('[ExtWarden] protectionEnabled:', protectionEnabled);
  if (!protectionEnabled) {
    await reEnableExtensions(tabId);
    return;
  }

  const hostname = getHostname(url);
  console.log('[ExtWarden] hostname:', hostname);
  if (!hostname) {
    await reEnableExtensions(tabId);
    return;
  }

  const zones = await getFromStorage<CriticalZone[]>('criticalZones', []);
  console.log('[ExtWarden] zones in storage:', JSON.stringify(zones));

  // Find zone where ANY pattern matches the hostname
  const activeZone = zones.find(z => {
    const matched = z.patterns.some(p => {
      const result = matchesZonePattern(hostname, p);
      console.log(`[ExtWarden] matchesZonePattern("${hostname}", "${p}") =`, result);
      return result;
    });
    return matched;
  });

  console.log('[ExtWarden] activeZone:', activeZone ? activeZone.category : 'none');

  // If NOT in a zone, re-enable any previously disabled extensions
  if (!activeZone) {
    await reEnableExtensions(tabId);
    return;
  }

  // Get category overrides
  const categoryOverrides = await getFromStorage<Record<string, string>>('categoryOverrides', {});

  // Evaluate ALL extensions
  const extensions = await chrome.management.getAll();
  console.log('[ExtWarden] total extensions found:', extensions.length);

  const riskyExts = extensions.filter(ext => {
    if (ext.type !== 'extension' || !ext.enabled || ext.id === chrome.runtime.id) {
      console.log(`[ExtWarden] skip "${ext.name}": type=${ext.type} enabled=${ext.enabled} self=${ext.id === chrome.runtime.id}`);
      return false;
    }

    const permissions = ext.permissions ?? [];
    const hostPermissions = ext.hostPermissions ?? [];
    const category = categoryOverrides[ext.id] ?? inferCategory(ext);
    const risk = computeRisk(permissions, hostPermissions, category);

    console.log(`[ExtWarden] "${ext.name}" → category=${category} score=${risk.score} level=${risk.level}`);
    return risk.level === 'critical' || risk.level === 'high';
  });

  console.log('[ExtWarden] risky extensions to block:', riskyExts.map(e => e.name));

  const disabledIds: string[] = [];

  for (const ext of riskyExts) {
    // Auto-disable the risky extension
    try {
      console.log(`[ExtWarden] calling setEnabled(false) for "${ext.name}" (${ext.id})`);
      await chrome.management.setEnabled(ext.id, false);
      console.log(`[ExtWarden] setEnabled(false) SUCCESS for "${ext.name}"`);
      disabledIds.push(ext.id);
    } catch (err) {
      console.error(`[ExtWarden] setEnabled(false) FAILED for "${ext.name}":`, err);
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

chrome.management.onInstalled.addListener((ext) => {
  void (async () => {
    if (ext.type !== 'extension' || ext.id === chrome.runtime.id) return;

    const snapshots = await getFromStorage<Record<string, { version: string; permissions: string[]; hostPermissions: string[] }>>('extSnapshots', {});
    const prev = snapshots[ext.id];
    const perms: string[] = ext.permissions ?? [];
    const hosts: string[] = ext.hostPermissions ?? [];

    if (!prev) {
      // Primera vez que se ve: registrar como instalación
      addActivity({
        extensionId: ext.id,
        extensionName: ext.name,
        module: 'Sistema',
        action: 'installed',
        detail: `Nueva extensión: ${ext.name} v${ext.version}`,
      });
    } else if (prev.version !== ext.version) {
      // Actualización: comparar permisos
      const added = [
        ...perms.filter(p => !prev.permissions.includes(p)),
        ...hosts.filter(h => !prev.hostPermissions.includes(h)),
      ];

      if (added.length > 0) {
        // Zero-trust: deshabilitar automáticamente
        try { await chrome.management.setEnabled(ext.id, false); } catch { /* may lack permission */ }

        addActivity({
          extensionId: ext.id,
          extensionName: ext.name,
          module: 'Detección de Cambios',
          action: 'warning',
          detail: `Nuevos permisos tras actualización v${prev.version}→v${ext.version}: ${added.join(', ')}`,
        });

        // Guardar en changeHistory para que Updates.tsx lo muestre
        const history = await getFromStorage<object[]>('changeHistory', []);
        history.unshift({
          id: `chg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          extensionId: ext.id,
          extensionName: ext.name,
          type: 'new_permissions',
          details: `v${prev.version} → v${ext.version}`,
          newPermissions: added,
          autoDisabled: true,
        });
        await setInStorage('changeHistory', history.slice(0, 100));

        // Notificación nativa de Chrome
        chrome.notifications.create(`update-${ext.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon.png',
          title: 'ExtWarden — Nuevos permisos detectados',
          message: `"${ext.name}" solicitó nuevos permisos y fue deshabilitada. Revísala en el panel.`,
          priority: 2,
        });
      } else {
        addActivity({
          extensionId: ext.id,
          extensionName: ext.name,
          module: 'Detección de Cambios',
          action: 'allowed',
          detail: `Actualización sin cambios de permisos: v${prev.version}→v${ext.version}`,
        });
      }
    }

    // Actualizar snapshot
    snapshots[ext.id] = { version: ext.version, permissions: perms, hostPermissions: hosts };
    await setInStorage('extSnapshots', snapshots);

  })();
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

// ── Ext-Sandbox Backend Integration ──────────────────────────────────────────

const BACKEND_URL = 'http://localhost:3000';
const SANDBOX_POLL_ALARM = 'extSandboxPoll';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_FAILURE_COUNT = 10;

interface SandboxJobSW {
  jobId: string;
  extensionName: string;
  status: 'queued' | 'downloading' | 'static_analysis' | 'dynamic_analysis' | 'threat_intel' | 'completed' | 'failed';
  submittedAt: string;
  completedAt?: string;
  failureCount: number;
}

interface SandboxReportSW {
  jobId: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  confidence: number;
  recommendation: string;
  findings: Array<{ category: string; severity: string; description: string; evidence?: string }>;
  contactedUrls: string[];
  abusedPermissions: string[];
  privacyLabels: any[];
  staticFindings: any[];
  dynamicEvidence: { networkRequests?: any[]; domMutations?: any[]; keyboardEvents?: any[]; apiCalls?: any[]; screenshotPaths?: string[] } | null;
  threatIntelResults: any[];
  contactedUrlsReputation: any[];
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Normalizes the backend report to our internal schema.
// The backend may return `overallRisk` (lowercase) instead of `riskLevel` (uppercase),
// may put behavioral findings in `privacyLabels` as objects instead of `findings`,
// and may put contacted URLs in `dynamicAnalysis.networkRequests`.
function normalizeReport(raw: Record<string, unknown>): SandboxReportSW {
  const VALID_RISKS = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']);

  const riskRaw = ((raw.riskLevel ?? raw.overallRisk ?? 'NONE') as string).toUpperCase();
  const riskLevel = VALID_RISKS.has(riskRaw)
    ? (riskRaw as SandboxReportSW['riskLevel'])
    : 'NONE';

  const toStr = (v: unknown): string =>
    typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : '');

  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).map(x => (typeof x === 'string' ? x : JSON.stringify(x))) : [];

  // Translation map for technical findings (User-friendly / 'Mom-proof')
  const TRANSLATIONS: Record<string, string> = {
    'fetch': 'Envía tu información a servidores externos',
    'innerHTML': 'Puede cambiar lo que ves en las páginas web (ej: poner anuncios o formularios falsos)',
    'chrome.storage.local.set': 'Guarda información de forma permanente en tu navegador',
    'chrome.storage.local.get': 'Lee información que guardó anteriormente',
    'setInterval': 'Realiza acciones en segundo plano aunque no la estés usando',
    'chrome.tabs.executeScript': 'Intenta controlar o leer lo que haces en otras pestañas',
    'chrome.cookies.get': 'Intenta acceder a tus sesiones iniciadas (cookies)',
    'eval': 'Ejecuta código de forma insegura y oculta',
    'keyboard': 'Monitorea todo lo que escribes con el teclado (posible robo de contraseñas)',
    'Reads page text content': 'Puede leer todo lo que ves en pantalla (incluyendo contraseñas)',
    'Registers keyboard event listeners': 'Vigila lo que escribes con el teclado',
    'Intercepts form submissions': 'Captura la información que envías en formularios',
    'Monitors input events': 'Observa lo que escribes en tiempo real',
  };

  const mapFinding = (f: Record<string, unknown>) => {
    const pattern = toStr(f.pattern ?? '');
    const rawDesc = toStr(f.description ?? f.title ?? '');
    const description = TRANSLATIONS[pattern] || rawDesc;

    return {
      category: toStr(f.category ?? f.title),
      severity: toStr(f.severity).toUpperCase(),
      description,
      evidence: f.evidence != null
        ? (Array.isArray(f.evidence)
          ? (f.evidence as unknown[]).map(toStr).join('\n')
          : toStr(f.evidence))
        : undefined,
      count: 1,
    };
  };

  const rawFindings = Array.isArray(raw.findings) ? raw.findings as Record<string, unknown>[] : [];
  const rawStaticFindings = Array.isArray(raw.staticFindings) ? raw.staticFindings as Record<string, unknown>[] : [];

  // Deduplicate and group findings
  const groupedFindingsMap = new Map<string, any>();
  [...rawFindings, ...rawStaticFindings].forEach(rawF => {
    const f = mapFinding(rawF);
    const key = `${f.category}-${f.description}-${f.severity}`;
    if (groupedFindingsMap.has(key)) {
      const existing = groupedFindingsMap.get(key);
      existing.count++;
      // Append evidence if different
      if (f.evidence && !existing.evidence.includes(f.evidence)) {
        existing.evidence += `\n${f.evidence}`;
      }
    } else {
      groupedFindingsMap.set(key, f);
    }
  });

  const findings = Array.from(groupedFindingsMap.values());

  const rawPrivacyArr = Array.isArray(raw.privacyLabels) ? raw.privacyLabels as unknown[] : [];
  const privacyLabels = rawPrivacyArr.map(l => {
    if (typeof l === 'object' && l !== null) return l;
    if (typeof l === 'string') {
      try { return JSON.parse(l); } catch (e) {
        return { title: 'Unknown Label', category: 'UNKNOWN', description: l, evidence: [], severity: 'LOW' };
      }
    }
    return { title: 'Unknown Label', category: 'UNKNOWN', description: toStr(l), evidence: [], severity: 'LOW' };
  });

  // Consolidate URLs from all sources, including findings evidence
  const rawDynamic = (raw.dynamicEvidence ?? raw.dynamicAnalysis ?? {}) as Record<string, unknown>;
  const networkRequests = Array.isArray(rawDynamic.networkRequests) ? rawDynamic.networkRequests as unknown[] : [];

  const evidenceTexts = findings.map(f => f.evidence).filter(Boolean).join(' ');
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/gi;
  const foundInEvidence: string[] = [];
  let match;
  while ((match = urlRegex.exec(evidenceTexts)) !== null) {
    if (match[1] && match[1].includes('.') && !match[1].endsWith('.js')) {
      foundInEvidence.push(match[1]);
    }
  }

  const allUrls = [
    ...toStringArray(raw.contactedUrls),
    ...networkRequests.map(r => {
      if (typeof r === 'string') return r;
      if (typeof r === 'object' && r !== null) {
        const req = r as Record<string, unknown>;
        return toStr(req.url ?? req.host ?? req);
      }
      return '';
    }),
    ...(Array.isArray(raw.threatIntelResults) ? (raw.threatIntelResults as any[]).map(t => t.domain) : []),
    ...foundInEvidence
  ].filter(Boolean);

  const contactedUrls = [...new Set(allUrls)];

  return {
    jobId: toStr(raw.jobId),
    riskLevel,
    confidence: (raw.confidence ?? 0) as number,
    recommendation: toStr(raw.recommendation ?? 'NO_SIGNIFICANT_RISKS'),
    findings,
    contactedUrls,
    abusedPermissions: toStringArray(raw.abusedPermissions),
    privacyLabels: privacyLabels as any,
    staticFindings: Array.isArray(raw.staticFindings) ? raw.staticFindings : [],
    dynamicEvidence: (raw.dynamicEvidence ?? raw.dynamicAnalysis ?? { networkRequests: [], domMutations: [], keyboardEvents: [], apiCalls: [], screenshotPaths: [] }) as SandboxReportSW['dynamicEvidence'],
    threatIntelResults: Array.isArray(raw.threatIntelResults) ? raw.threatIntelResults : [],
    contactedUrlsReputation: Array.isArray(raw.contactedUrlsReputation) ? raw.contactedUrlsReputation : [],
  };
}

async function ensurePollingAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(SANDBOX_POLL_ALARM);
  if (!existing) {
    chrome.alarms.create(SANDBOX_POLL_ALARM, { periodInMinutes: 0.5 });
  }
}

async function submitToBackend(extensionId: string, extensionName: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BACKEND_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionId }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { jobId: string; status: string };

    const jobs = await getFromStorage<Record<string, SandboxJobSW>>('sandboxJobs', {});
    jobs[extensionId] = {
      jobId: data.jobId,
      extensionName,
      status: 'queued',
      submittedAt: new Date().toISOString(),
      failureCount: 0,
    };
    await setInStorage('sandboxJobs', jobs);
    await ensurePollingAlarm();
    return true;
  } catch {
    return false;
  }
}

async function pollSandboxJobs(): Promise<void> {
  const jobs = await getFromStorage<Record<string, SandboxJobSW>>('sandboxJobs', {});
  const pending = Object.entries(jobs).filter(
    ([, j]) => j.status !== 'completed' && j.status !== 'failed' && j.failureCount < MAX_FAILURE_COUNT,
  );

  if (pending.length === 0) {
    const anyPending = Object.values(jobs).some(
      j => j.status !== 'completed' && j.status !== 'failed',
    );
    if (!anyPending) chrome.alarms.clear(SANDBOX_POLL_ALARM);
    return;
  }

  let changed = false;

  for (const [extId, job] of pending) {
    try {
      const res = await fetchWithTimeout(`${BACKEND_URL}/status/${job.jobId}`);
      if (!res.ok) {
        jobs[extId].failureCount++;
        changed = true;
        continue;
      }
      const { status } = await res.json() as { status: SandboxJobSW['status'] };
      jobs[extId].status = status;
      jobs[extId].failureCount = 0; // reset on any successful response
      changed = true;

      if (status === 'completed') {
        jobs[extId].completedAt = new Date().toISOString();
        try {
          const repRes = await fetchWithTimeout(`${BACKEND_URL}/report/${job.jobId}`);
          if (repRes.ok) {
            const raw = await repRes.json() as Record<string, unknown>;
            const report = normalizeReport(raw);
            const reports = await getFromStorage<Record<string, SandboxReportSW>>('sandboxReports', {});
            reports[extId] = report;
            await setInStorage('sandboxReports', reports);
            showSandboxNotification(extId, job.extensionName, report);
          }
        } catch { /* report fetch failed — retry next poll */ }
      }
    } catch {
      jobs[extId].failureCount++;
      changed = true;
    }
  }

  if (changed) await setInStorage('sandboxJobs', jobs);
}

function showSandboxNotification(extId: string, extName: string, report: SandboxReportSW): void {
  const ICON = 'icons/icon.png';
  let title: string;
  let message: string;
  let priority: number;

  if (report.riskLevel === 'CRITICAL' || report.riskLevel === 'HIGH') {
    title = `⚠️ Riesgo detectado: ${extName}`;
    message = `${report.findings.length} comportamiento(s) malicioso(s) encontrado(s). Toca para ver detalles.`;
    priority = 2;
  } else if (report.riskLevel === 'MEDIUM') {
    title = `Análisis completado: ${extName}`;
    message = 'Comportamiento sospechoso detectado. Revisa el reporte.';
    priority = 1;
  } else {
    title = `✓ ${extName} analizada`;
    message = 'Sin comportamientos maliciosos detectados.';
    priority = 0;
  }

  chrome.notifications.create(`sandbox-${extId}`, {
    type: 'basic',
    iconUrl: ICON,
    title,
    message,
    priority,
  });
}

// Notification click → open options page and queue the drawer open
chrome.notifications.onClicked.addListener(notificationId => {
  if (!notificationId.startsWith('sandbox-')) return;
  const extId = notificationId.slice('sandbox-'.length);
  void setInStorage('openDrawerForExtension', extId);
  chrome.runtime.openOptionsPage();
  chrome.notifications.clear(notificationId);
});

// Sandbox poll alarm
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === SANDBOX_POLL_ALARM) {
    void pollSandboxJobs();
  }
});

// Reanalyze message from options page
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'reanalyzeExtension' && message.extensionId) {
    void (async () => {
      const jobs = await getFromStorage<Record<string, SandboxJobSW>>('sandboxJobs', {});
      delete jobs[message.extensionId as string];
      await setInStorage('sandboxJobs', jobs);
      const reports = await getFromStorage<Record<string, object>>('sandboxReports', {});
      delete reports[message.extensionId as string];
      await setInStorage('sandboxReports', reports);
      const ok = await submitToBackend(
        message.extensionId as string,
        (message.extensionName as string) ?? (message.extensionId as string),
      );
      sendResponse({ success: ok });
    })();
    return true;
  }
});

// Resume polling for any in-progress jobs from previous session
void ensurePollingAlarm();
