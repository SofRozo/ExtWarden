/**
 * Permission risk taxonomy — Capítulo 4, Tesis ExtWarden
 *
 * Pesos de impacto (Tabla tab:impact_weights):
 *   CRÍTICO = 10  |  ALTO = 5  |  MEDIO = 2  |  BAJO = 1
 *
 * Factores de coherencia (Tabla tab:coherence_factors):
 *   Esperado = 0.1  |  Sospechoso = 1.0  |  Incoherente = 5.0
 *
 * Clasificación S/E (Tabla tab:se_classification):
 *   S = sensibles a host (se multiplican por f(H))
 *   E = estáticos (riesgo independiente del alcance de hosts)
 */

export type PermissionLevel = 'critical' | 'high' | 'medium' | 'low';

export interface PermissionInfo {
  level: PermissionLevel;
  weight: number;
  /** true → pertenece al conjunto S; se multiplica por f(H) */
  hostSensitive: boolean;
}

/** Pesos e información de riesgo por permiso */
export const PERMISSION_WEIGHTS: Record<string, PermissionInfo> = {
  // ── CRÍTICO / S ──────────────────────────────────────────────────────────
  tabCapture:  { level: 'critical', weight: 10, hostSensitive: true  },
  pageCapture: { level: 'critical', weight: 10, hostSensitive: true  },

  // ── CRÍTICO / E ──────────────────────────────────────────────────────────
  debugger:        { level: 'critical', weight: 10, hostSensitive: false },
  nativeMessaging: { level: 'critical', weight: 10, hostSensitive: false },
  proxy:           { level: 'critical', weight: 10, hostSensitive: false },
  vpnProvider:     { level: 'critical', weight: 10, hostSensitive: false },

  // ── ALTO / S ─────────────────────────────────────────────────────────────
  cookies:                              { level: 'high', weight: 5, hostSensitive: true },
  scripting:                            { level: 'high', weight: 5, hostSensitive: true },
  declarativeNetRequest:                { level: 'high', weight: 5, hostSensitive: true },
  webRequest:                           { level: 'high', weight: 5, hostSensitive: true },
  webRequestBlocking:                   { level: 'high', weight: 5, hostSensitive: true },
  userScripts:                          { level: 'high', weight: 5, hostSensitive: true },
  declarativeNetRequestWithHostAccess:  { level: 'high', weight: 5, hostSensitive: true },
  /** Elevado de CRÍTICO a ALTO; ahora en conjunto S (Tabla tab:se_classification) */
  desktopCapture:                       { level: 'high', weight: 5, hostSensitive: true },

  // ── ALTO / E ─────────────────────────────────────────────────────────────
  history:               { level: 'high', weight: 5, hostSensitive: false },
  downloads:             { level: 'high', weight: 5, hostSensitive: false },
  'downloads.open':      { level: 'high', weight: 5, hostSensitive: false },
  privacy:               { level: 'high', weight: 5, hostSensitive: false },
  browsingData:          { level: 'high', weight: 5, hostSensitive: false },
  contentSettings:       { level: 'high', weight: 5, hostSensitive: false },
  webNavigation:         { level: 'high', weight: 5, hostSensitive: false },
  webAuthenticationProxy:{ level: 'high', weight: 5, hostSensitive: false },
  certificateProvider:   { level: 'high', weight: 5, hostSensitive: false },
  platformKeys:          { level: 'high', weight: 5, hostSensitive: false },

  // ── MEDIO / E ────────────────────────────────────────────────────────────
  // activeTab: tratado como E en la suma (ver Sección 4.4.2, Ejemplo 1)
  activeTab:    { level: 'medium', weight: 2, hostSensitive: false },
  alarms:       { level: 'medium', weight: 2, hostSensitive: false },
  bookmarks:    { level: 'medium', weight: 2, hostSensitive: false },
  clipboardRead:  { level: 'medium', weight: 2, hostSensitive: false },
  clipboardWrite: { level: 'medium', weight: 2, hostSensitive: false },
  geolocation:  { level: 'medium', weight: 2, hostSensitive: false },
  identity:         { level: 'medium', weight: 2, hostSensitive: false },
  'identity.email': { level: 'medium', weight: 2, hostSensitive: false },
  management:   { level: 'medium', weight: 2, hostSensitive: false },
  sessions:     { level: 'medium', weight: 2, hostSensitive: false },
  topSites:     { level: 'medium', weight: 2, hostSensitive: false },
  contextMenus: { level: 'medium', weight: 2, hostSensitive: false },
  tabGroups:    { level: 'medium', weight: 2, hostSensitive: false },
  dns:          { level: 'medium', weight: 2, hostSensitive: false },
  tabs:         { level: 'medium', weight: 2, hostSensitive: false },
  offscreen:    { level: 'medium', weight: 2, hostSensitive: false },
  processes:    { level: 'medium', weight: 2, hostSensitive: false },

  // ── BAJO / E (peso = 1) ──────────────────────────────────────────────────
  storage:           { level: 'low', weight: 1, hostSensitive: false },
  unlimitedStorage:  { level: 'low', weight: 1, hostSensitive: false },
  notifications:     { level: 'low', weight: 1, hostSensitive: false },
  idle:              { level: 'low', weight: 1, hostSensitive: false },
  power:             { level: 'low', weight: 1, hostSensitive: false },
  tts:               { level: 'low', weight: 1, hostSensitive: false },
  ttsEngine:         { level: 'low', weight: 1, hostSensitive: false },
  fontSettings:      { level: 'low', weight: 1, hostSensitive: false },
  declarativeContent:{ level: 'low', weight: 1, hostSensitive: false },
  gcm:               { level: 'low', weight: 1, hostSensitive: false },
  sidePanel:         { level: 'low', weight: 1, hostSensitive: false },
  search:            { level: 'low', weight: 1, hostSensitive: false },
  favicon:           { level: 'low', weight: 1, hostSensitive: false },
  readingList:       { level: 'low', weight: 1, hostSensitive: false },
  printing:          { level: 'low', weight: 1, hostSensitive: false },
  printingMetrics:   { level: 'low', weight: 1, hostSensitive: false },
  documentScan:      { level: 'low', weight: 1, hostSensitive: false },
  loginState:        { level: 'low', weight: 1, hostSensitive: false },
  'accessibilityFeatures.modify': { level: 'low', weight: 1, hostSensitive: false },
  'accessibilityFeatures.read':   { level: 'low', weight: 1, hostSensitive: false },
  background:                     { level: 'low', weight: 1, hostSensitive: false },
  declarativeNetRequestFeedback:  { level: 'low', weight: 1, hostSensitive: false },
  'downloads.ui':   { level: 'low', weight: 1, hostSensitive: false },
  'system.cpu':     { level: 'low', weight: 1, hostSensitive: false },
  'system.display': { level: 'low', weight: 1, hostSensitive: false },
  'system.memory':  { level: 'low', weight: 1, hostSensitive: false },
  'system.storage': { level: 'low', weight: 1, hostSensitive: false },
  printerProvider:  { level: 'low', weight: 1, hostSensitive: false },
};

/** Factores de coherencia — Tabla tab:coherence_factors */
export const COHERENCE_FACTORS = {
  expected:    0.1,
  suspicious:  1.0,
  incoherent:  5.0,
} as const;

export type CoherenceLevel = keyof typeof COHERENCE_FACTORS;
