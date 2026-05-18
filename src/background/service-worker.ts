/**
 * Background Service Worker — Manifest V3
 *
 * 1. Tab navigation → check if URL matches a critical zone
 * 2. Disable all other extensions while the tab is inside a safe zone
 * 3. Re-enable only the extensions that ExtWarden disabled when leaving zones
 * 4. Handle messages from popup/options/content scripts
 * 5. Track blocked counters & activity log
 */

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
  action: 'blocked' | 'warning' | 'allowed' | 'installed' | 'removed' | 'updated';
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
 * Key: tabId as string → value: extension IDs that ExtWarden disabled or is
 * holding disabled for that tab. Stored in chrome.storage because MV3 service
 * workers can restart and lose in-memory Maps.
 */
const DISABLED_BY_ZONE_KEY = 'disabledByZone';
type DisabledByZone = Record<string, string[]>;

async function getDisabledByZone(): Promise<DisabledByZone> {
  return getFromStorage<DisabledByZone>(DISABLED_BY_ZONE_KEY, {});
}

async function setDisabledByZone(value: DisabledByZone): Promise<void> {
  await setInStorage(DISABLED_BY_ZONE_KEY, value);
}

async function reEnableExtensions(tabId: number): Promise<void> {
  const disabledByZone = await getDisabledByZone();
  const tabKey = String(tabId);
  const ids = disabledByZone[tabKey];
  if (!ids || ids.length === 0) return;

  // Extensions still held by other tabs must not be re-enabled
  const heldElsewhere = new Set<string>();
  for (const [otherTabId, otherIds] of Object.entries(disabledByZone)) {
    if (otherTabId !== tabKey) otherIds.forEach(id => heldElsewhere.add(id));
  }

  for (const extId of ids) {
    if (heldElsewhere.has(extId)) continue;
    try {
      await chrome.management.setEnabled(extId, true);
    } catch {
      // Extension may have been uninstalled
    }
  }
  delete disabledByZone[tabKey];
  await setDisabledByZone(disabledByZone);
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

  // Disable ALL enabled extensions while this tab is in a safe zone.
  // Already-disabled extensions are only tracked if ExtWarden is holding them
  // for another zone tab; user-disabled extensions are not re-enabled later.
  const extensions = await chrome.management.getAll();
  console.log('[ExtWarden] total extensions found:', extensions.length);

  const disabledByZone = await getDisabledByZone();
  const tabKey = String(tabId);
  const heldByAnyZone = new Set(Object.values(disabledByZone).flat());

  const extensionsToHold = extensions.filter(ext => {
    if (ext.type !== 'extension' || ext.id === chrome.runtime.id) {
      console.log(`[ExtWarden] skip "${ext.name}": type=${ext.type} enabled=${ext.enabled} self=${ext.id === chrome.runtime.id}`);
      return false;
    }

    return ext.enabled || heldByAnyZone.has(ext.id);
  });

  console.log('[ExtWarden] extensions to disable/hold in safe zone:', extensionsToHold.map(e => e.name));

  const disabledIds: string[] = [];

  for (const ext of extensionsToHold) {
    if (!ext.enabled) {
      disabledIds.push(ext.id);
      continue;
    }

    try {
      console.log(`[ExtWarden] calling setEnabled(false) for "${ext.name}" (${ext.id})`);
      await chrome.management.setEnabled(ext.id, false);
      console.log(`[ExtWarden] setEnabled(false) SUCCESS for "${ext.name}"`);
      disabledIds.push(ext.id);
    } catch (err) {
      console.error(`[ExtWarden] setEnabled(false) FAILED for "${ext.name}":`, err);
      continue;
    }

    try {
      await addActivity({
        extensionId: ext.id,
        extensionName: ext.name,
        module: `Zona: ${activeZone.category}`,
        action: 'blocked',
        detail: `Extensión deshabilitada en ${activeZone.category}`,
      });
      await incrementBlocked();
    } catch {
      // Activity/increment are best-effort; disabling already succeeded.
    }
  }

  // Track which extensions were disabled for this tab
  if (disabledIds.length > 0) {
    const existing = disabledByZone[tabKey] ?? [];
    disabledByZone[tabKey] = [...new Set([...existing, ...disabledIds])];
    await setDisabledByZone(disabledByZone);
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
  nivel_riesgo_inicial: 'bajo' | 'medio' | 'alto' | 'critico';
  veredicto_global: 'maliciosa' | 'sospechosa' | 'benigna';
  explicacion: string;
  violacion_minimo_privilegio?: { detectada: boolean; razones: string[] };
  hallazgos_propios?: unknown[];
  respuestas_usuario?: Record<string, { valor: 'si' | 'no_detectado' | 'posible'; razon: string }>;
};

type UserRiskSummaryItemSW = {
  id: string;
  titulo: string;
  estado: 'no_detectado' | 'capacidad' | 'sospechoso' | 'critico';
  resumen: string;
  evidencias: string[];
  reglas_activadas?: string[];
  preguntas_responde: string[];
};

type UserFacingVerdictSW = {
  nivel: 'bajo' | 'medio' | 'alto' | 'critico';
  veredicto: 'benigna' | 'sospechosa' | 'maliciosa';
  resumen: string;
  razones: string[];
};

interface SandboxReportSW {
  jobId: string;
  extensionId?: string;
  extensionName?: string;
  extensionVersion?: string;
  extensionAuthor?: string;
  crxHash?: string;
  analysisTimestamp?: string;
  analysisDuration?: number;
  agente1: Agent1OutputSW | null;
  resumen_usuario: UserRiskSummaryItemSW[];
  veredicto_usuario: UserFacingVerdictSW | null;
  hallazgos_estaticos_positivos: string[];
  permisos_no_usados: Array<{ permission: string; categoria: string; descripcion: string }>;
  estructura: {
    resultado1: any[];
    resultado2_priority: any[];
    resultado2_unknown: any[];
  };
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
  };

  // ── Derive riskLevel ────────────────────────────────────────────────────
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
  if (backendRisk?.level === 'CRITICAL' || csCriticalStatic) {
    riskLevel = 'CRITICAL';
  } else if (backendRisk?.level === 'HIGH' || totalPositiveStatic >= 3) {
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

  // El agente es la fuente de verdad del veredicto — si corrió exitosamente
  // y dice 'benigna' o nivel 'bajo'/'medio', el badge no debe superar ese nivel.
  if (agente1?.veredicto_global === 'benigna' || agente1?.nivel_riesgo_inicial === 'bajo') {
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') riskLevel = 'LOW';
  } else if (agente1?.nivel_riesgo_inicial === 'medio') {
    if (riskLevel === 'CRITICAL') riskLevel = 'MEDIUM';
  }

  const resumenUsuario = Array.isArray(raw.resumen_usuario)
    ? (raw.resumen_usuario as UserRiskSummaryItemSW[])
    : [];
  const veredictoUsuario = (raw.veredicto_usuario ??
    null) as UserFacingVerdictSW | null;

  return {
    jobId: toStr(raw.jobId),
    extensionId: typeof raw.extensionId === 'string' ? raw.extensionId : undefined,
    extensionName: typeof raw.extensionName === 'string' ? raw.extensionName : undefined,
    extensionVersion: typeof raw.extensionVersion === 'string' ? raw.extensionVersion : undefined,
    extensionAuthor: typeof raw.extensionAuthor === 'string' ? raw.extensionAuthor : undefined,
    crxHash: typeof raw.crxHash === 'string' ? raw.crxHash : undefined,
    analysisTimestamp: typeof raw.analysisTimestamp === 'string' ? raw.analysisTimestamp : undefined,
    analysisDuration: typeof raw.analysisDuration === 'number' ? raw.analysisDuration : undefined,
    agente1,
    resumen_usuario: resumenUsuario,
    veredicto_usuario: veredictoUsuario,
    hallazgos_estaticos_positivos: toStringArray(raw.hallazgos_estaticos_positivos),
    permisos_no_usados: Array.isArray(raw.permisos_no_usados)
      ? (raw.permisos_no_usados as any[])
      : [],
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

  const totalPositive = report.hallazgos_estaticos_positivos.length;

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
