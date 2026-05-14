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
    const risk = computeRisk(permissions, hostPermissions);

    console.log(`[ExtWarden] "${ext.name}" → score=${risk.score} level=${risk.level}`);
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

chrome.management.onInstalled.addListener((ext) => { void (async () => {
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

})(); });

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
  status:
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
  submittedAt: string;
  completedAt?: string;
  failureCount: number;
}

type Agent1OutputSW = {
  proposito: string;
  categoria: string;
  acciones_esperadas: string[];
  acciones_NO_esperadas: string[];
  senales_alarma_manifest: string[];
  nivel_riesgo_inicial: 'bajo' | 'medio' | 'alto' | 'critico';
  razon_nivel_riesgo: string;
};

interface SandboxReportSW {
  jobId: string;
  agente1: Agent1OutputSW | null;
  dominios_contactados_prioritarios: string[];
  hallazgos_estaticos_positivos: string[];
  hallazgos_dinamicos_positivos: string[];
  estructura: {
    resultado1: any[];
    resultado2_priority: any[];
    resultado2_unknown: any[];
    resultado_dinamico: any[];
  };
  navegacionDominios: any[];
  puntuacion_riesgo?: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasons: string[];
  };
  /** Derived from the verdicted findings so existing UI badges keep working. */
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Normalises the backend's new contract and derives a `riskLevel` so existing
// frontend UI elements (badges, bento stats) keep working without each one
// having to recompute it.
function normalizeReport(raw: Record<string, unknown>): SandboxReportSW {
  const toStr = (v: unknown): string =>
    typeof v === 'string' ? v : v != null ? JSON.stringify(v) : '';
  const toStringArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? (v as unknown[]).map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
      : [];

  const agente1 = (raw.agente1 ?? null) as Agent1OutputSW | null;

  const estructuraRaw = (raw.estructura ?? {}) as Record<string, unknown>;
  const estructura = {
    resultado1: Array.isArray(estructuraRaw.resultado1)
      ? (estructuraRaw.resultado1 as any[])
      : [],
    resultado2_priority: Array.isArray(estructuraRaw.resultado2_priority)
      ? (estructuraRaw.resultado2_priority as any[])
      : [],
    resultado2_unknown: Array.isArray(estructuraRaw.resultado2_unknown)
      ? (estructuraRaw.resultado2_unknown as any[])
      : [],
    resultado_dinamico: Array.isArray(estructuraRaw.resultado_dinamico)
      ? (estructuraRaw.resultado_dinamico as any[])
      : [],
  };

  // ── Derive riskLevel ────────────────────────────────────────────────────
  // CRITICAL: any dynamic finding is "maliciosa" OR ≥1 positive static finding
  //           comes from a content_script with a high-risk discoveryType.
  // HIGH:     any dynamic finding is "sospechosa" OR there are ≥3 positive
  //           static findings.
  // MEDIUM:   ≥1 positive static finding.
  // LOW:      agent1 says nivel_riesgo_inicial=alto|critico but no findings.
  // NONE:     nothing.
  const dynamicHasMalicious = estructura.resultado_dinamico.some(
    (f) => f?.veredicto === 'maliciosa',
  );
  const dynamicHasSuspicious = estructura.resultado_dinamico.some(
    (f) => f?.veredicto === 'sospechosa',
  );
  const positiveStatic = estructura.resultado1.filter(
    (f) => f?.veredicto === 'positivo',
  );
  const positiveDomain = [
    ...estructura.resultado2_priority,
    ...estructura.resultado2_unknown,
  ].filter((f) => f?.veredicto === 'positivo');
  const totalPositiveStatic = positiveStatic.length + positiveDomain.length;

  const HIGH_RISK_DISCOVERY_TYPES = new Set([
    'flujo_datos_a_red',
    'codigo_ofuscado',
    'script_remoto_mv3',
    'listener_teclado',
    'lectura_cookies',
  ]);
  const csCriticalStatic = positiveStatic.some(
    (f) =>
      f?.fileType === 'content_script' &&
      HIGH_RISK_DISCOVERY_TYPES.has(f?.discoveryType),
  );

  const backendRisk = raw.puntuacion_riesgo as SandboxReportSW['puntuacion_riesgo'] | undefined;

  let riskLevel: SandboxReportSW['riskLevel'];
  if (backendRisk?.level === 'CRITICAL' || dynamicHasMalicious || csCriticalStatic) {
    riskLevel = 'CRITICAL';
  } else if (backendRisk?.level === 'HIGH' || dynamicHasSuspicious || totalPositiveStatic >= 3) {
    riskLevel = 'HIGH';
  } else if (backendRisk?.level === 'MEDIUM' || totalPositiveStatic >= 1) {
    riskLevel = 'MEDIUM';
  } else if (backendRisk?.level === 'LOW') {
    riskLevel = 'LOW';
  } else if (
    agente1 &&
    (agente1.nivel_riesgo_inicial === 'alto' ||
      agente1.nivel_riesgo_inicial === 'critico')
  ) {
    riskLevel = 'LOW';
  } else {
    riskLevel = 'NONE';
  }

  const navegacionDominios = Array.isArray(raw.navegacionDominios)
    ? (raw.navegacionDominios as any[])
    : [];

  return {
    jobId: toStr(raw.jobId),
    agente1,
    navegacionDominios,
    dominios_contactados_prioritarios: toStringArray(
      raw.dominios_contactados_prioritarios,
    ),
    hallazgos_estaticos_positivos: toStringArray(
      raw.hallazgos_estaticos_positivos,
    ),
    hallazgos_dinamicos_positivos: toStringArray(
      raw.hallazgos_dinamicos_positivos,
    ),
    estructura,
    puntuacion_riesgo: backendRisk,
    riskLevel,
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

  const totalPositive =
    report.hallazgos_estaticos_positivos.length +
    report.hallazgos_dinamicos_positivos.length;

  if (report.riskLevel === 'CRITICAL' || report.riskLevel === 'HIGH') {
    title = `⚠️ Riesgo detectado: ${extName}`;
    message = `${totalPositive} comportamiento(s) sospechoso(s) encontrado(s). Toca para ver detalles.`;
    priority = 2;
  } else if (report.riskLevel === 'MEDIUM') {
    title = `Análisis completado: ${extName}`;
    message = 'Algunos comportamientos requieren revisión.';
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
  if (message.action === 'resumeSandboxPolling') {
    void ensurePollingAlarm().then(() => sendResponse({ success: true }));
    return true;
  }
});

// Resume polling for any in-progress jobs from previous session
void ensurePollingAlarm();
