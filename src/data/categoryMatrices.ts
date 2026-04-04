/**
 * Matrices de correlación Categoría–Permisos — Sección 4.3, Tesis ExtWarden
 *
 * 18 categorías de la Chrome Web Store (marzo 2026):
 *   Productividad (5): Developer Tools, Workflow & Planning, Education,
 *                      Communication, Tools
 *   Estilo de Vida (10): Entertainment, Games, News & Weather, Shopping,
 *                        Social Networking, Travel, Well-being, Household,
 *                        Art & Design, Just for Fun
 *   Personalizar Chrome (3): Accessibility, Functionality & UI,
 *                            Privacy & Security
 */

export interface CategoryMatrix {
  nameEs: string;
  nameEn: string;
  expected: string[];
  suspicious: string[];
  incoherent: string[];
}

export const CATEGORY_MATRICES: Record<string, CategoryMatrix> = {

  // ── PRODUCTIVIDAD ────────────────────────────────────────────────────────

  developer_tools: {
    nameEs: 'Herramientas de Desarrollo',
    nameEn: 'Developer Tools',
    expected:   ['storage', 'tabs', 'activeTab', 'scripting', 'contextMenus', 'notifications', 'sidePanel'],
    suspicious: ['cookies', 'history', 'webNavigation', 'downloads', 'clipboardRead'],
    incoherent: ['debugger', 'nativeMessaging', 'proxy', 'desktopCapture', 'tabCapture'],
  },

  workflow: {
    nameEs: 'Flujo de Trabajo',
    nameEn: 'Workflow & Planning',
    expected:   ['storage', 'activeTab', 'notifications', 'alarms', 'identity', 'contextMenus', 'sidePanel'],
    suspicious: ['tabs', 'history', 'bookmarks', 'clipboardRead', 'scripting'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'webRequest', 'proxy', 'desktopCapture', 'tabCapture'],
  },

  education: {
    nameEs: 'Educación',
    nameEn: 'Education',
    expected:   ['storage', 'activeTab', 'tts', 'notifications', 'contextMenus', 'sidePanel'],
    suspicious: ['tabs', 'history', 'scripting', 'downloads', 'identity.email'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'webRequest', 'proxy', 'clipboardRead', 'desktopCapture'],
  },

  communication: {
    nameEs: 'Comunicación',
    nameEn: 'Communication',
    expected:   ['storage', 'activeTab', 'notifications', 'identity', 'contextMenus', 'sidePanel'],
    suspicious: ['tabs', 'scripting', 'history', 'clipboardRead', 'clipboardWrite'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'desktopCapture'],
  },

  tools: {
    nameEs: 'Herramientas Generales',
    nameEn: 'Tools',
    expected:   ['storage', 'activeTab', 'contextMenus', 'notifications', 'sidePanel', 'alarms'],
    suspicious: ['tabs', 'scripting', 'clipboardRead', 'clipboardWrite', 'downloads', 'identity', 'bookmarks', 'history'],
    incoherent: ['debugger', 'nativeMessaging', 'proxy', 'desktopCapture', 'tabCapture', 'webRequest'],
  },

  // ── ESTILO DE VIDA ───────────────────────────────────────────────────────

  entertainment: {
    nameEs: 'Entretenimiento',
    nameEn: 'Entertainment',
    expected:   ['storage', 'activeTab', 'notifications', 'contextMenus'],
    suspicious: ['tabs', 'scripting', 'history', 'downloads', 'bookmarks'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'identity', 'clipboardRead', 'geolocation'],
  },

  games: {
    nameEs: 'Juegos',
    nameEn: 'Games',
    expected:   ['storage', 'notifications', 'alarms'],
    suspicious: ['activeTab', 'tabs', 'scripting', 'identity', 'geolocation'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'history', 'downloads', 'clipboardRead'],
  },

  news: {
    nameEs: 'Noticias y Clima',
    nameEn: 'News & Weather',
    expected:   ['storage', 'notifications', 'alarms', 'geolocation'],
    suspicious: ['activeTab', 'tabs', 'history', 'bookmarks', 'identity'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'scripting', 'downloads'],
  },

  shopping: {
    nameEs: 'Compras',
    nameEn: 'Shopping',
    expected:   ['storage', 'activeTab', 'notifications', 'contextMenus'],
    suspicious: ['tabs', 'scripting', 'cookies', 'history', 'clipboardRead', 'webNavigation'],
    incoherent: ['debugger', 'nativeMessaging', 'proxy', 'desktopCapture', 'tabCapture', 'downloads', 'identity'],
  },

  social: {
    nameEs: 'Redes Sociales',
    nameEn: 'Social Networking',
    expected:   ['storage', 'activeTab', 'notifications', 'contextMenus', 'identity'],
    suspicious: ['tabs', 'scripting', 'history', 'downloads', 'clipboardRead', 'clipboardWrite'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest'],
  },

  travel: {
    nameEs: 'Viajes',
    nameEn: 'Travel',
    expected:   ['storage', 'notifications', 'geolocation', 'contextMenus'],
    suspicious: ['activeTab', 'tabs', 'scripting', 'history', 'bookmarks', 'identity'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'downloads', 'clipboardRead'],
  },

  wellbeing: {
    nameEs: 'Bienestar',
    nameEn: 'Well-being',
    expected:   ['storage', 'notifications', 'alarms', 'idle'],
    suspicious: ['activeTab', 'tabs', 'history', 'identity', 'geolocation'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'scripting', 'downloads'],
  },

  household: {
    nameEs: 'Hogar',
    nameEn: 'Household',
    expected:   ['storage', 'notifications', 'activeTab', 'contextMenus'],
    suspicious: ['tabs', 'scripting', 'clipboardRead', 'clipboardWrite', 'identity', 'geolocation'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'desktopCapture', 'tabCapture', 'history'],
  },

  art_design: {
    nameEs: 'Arte y Diseño',
    nameEn: 'Art & Design',
    expected:   ['storage', 'activeTab', 'contextMenus', 'notifications'],
    suspicious: ['tabs', 'scripting', 'downloads', 'clipboardRead', 'clipboardWrite', 'desktopCapture'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'history', 'bookmarks', 'identity'],
  },

  fun: {
    nameEs: 'Solo por Diversión',
    nameEn: 'Just for Fun',
    expected:   ['storage', 'notifications', 'contextMenus'],
    suspicious: ['activeTab', 'tabs', 'scripting', 'alarms', 'identity'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'history', 'downloads', 'clipboardRead', 'geolocation'],
  },

  // ── PERSONALIZAR CHROME ──────────────────────────────────────────────────

  accessibility: {
    nameEs: 'Accesibilidad',
    nameEn: 'Accessibility',
    expected:   ['storage', 'activeTab', 'tts', 'accessibilityFeatures.modify', 'accessibilityFeatures.read', 'fontSettings'],
    suspicious: ['tabs', 'scripting', 'history', 'contextMenus'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'downloads', 'clipboardRead', 'identity'],
  },

  functionality: {
    nameEs: 'Funcionalidad e Interfaz',
    nameEn: 'Functionality & UI',
    expected:   ['storage', 'activeTab', 'contextMenus', 'sidePanel', 'notifications', 'tabs'],
    suspicious: ['scripting', 'history', 'bookmarks', 'downloads', 'tabGroups'],
    incoherent: ['cookies', 'debugger', 'nativeMessaging', 'proxy', 'webRequest', 'clipboardRead', 'identity'],
  },

  privacy_security: {
    nameEs: 'Privacidad y Seguridad',
    nameEn: 'Privacy & Security',
    expected:   ['storage', 'activeTab', 'declarativeNetRequest', 'privacy', 'cookies', 'browsingData', 'webRequest'],
    suspicious: ['tabs', 'history', 'scripting', 'nativeMessaging'],
    incoherent: ['debugger', 'proxy', 'desktopCapture', 'tabCapture', 'pageCapture', 'identity'],
  },
};

// ── Aliases de nombre → clave de categoría ────────────────────────────────

const CATEGORY_ALIASES: Record<string, string> = {
  // Inglés
  'developer tools': 'developer_tools',
  'dev tools':       'developer_tools',
  'workflow & planning': 'workflow',
  'workflow':        'workflow',
  'education':       'education',
  'communication':   'communication',
  'tools':           'tools',
  'entertainment':   'entertainment',
  'games':           'games',
  'news & weather':  'news',
  'news':            'news',
  'shopping':        'shopping',
  'social networking': 'social',
  'social media & networking': 'social',
  'social':          'social',
  'travel':          'travel',
  'well-being':      'wellbeing',
  'wellbeing':       'wellbeing',
  'household':       'household',
  'art & design':    'art_design',
  'art':             'art_design',
  'just for fun':    'fun',
  'fun':             'fun',
  'accessibility':   'accessibility',
  'functionality & ui': 'functionality',
  'functionality':   'functionality',
  'privacy & security': 'privacy_security',
  'privacy':         'privacy_security',
  'security':        'privacy_security',
  // Español
  'herramientas de desarrollo': 'developer_tools',
  'desarrollo':      'developer_tools',
  'flujo de trabajo': 'workflow',
  'educación':       'education',
  'comunicación':    'communication',
  'herramientas generales': 'tools',
  'herramientas':    'tools',
  'entretenimiento': 'entertainment',
  'juegos':          'games',
  'noticias y clima': 'news',
  'noticias':        'news',
  'compras':         'shopping',
  'redes sociales':  'social',
  'viajes':          'travel',
  'bienestar':       'wellbeing',
  'hogar':           'household',
  'arte y diseño':   'art_design',
  'solo por diversión': 'fun',
  'accesibilidad':   'accessibility',
  'funcionalidad e interfaz': 'functionality',
  'privacidad y seguridad': 'privacy_security',
  // Genéricos
  'productivity':    'tools',
  'productividad':   'tools',
  'utilidades':      'tools',
};

export function resolveCategoryKey(category: string): string {
  const key = category.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? 'tools';
}

export function getCategoryMatrix(category: string): CategoryMatrix {
  const key = resolveCategoryKey(category);
  return CATEGORY_MATRICES[key] ?? CATEGORY_MATRICES.tools;
}
