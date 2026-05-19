/** Descripciones legibles de permisos en ES/EN — para la UI de auditoría */

const DESCRIPTIONS: Record<string, { es: string; en: string }> = {
  '<all_urls>':    { es: 'Puede acceder a todos los sitios web que visitas', en: 'Can access all websites you visit' },
  '*://*/*':       { es: 'Puede acceder a todos los sitios web que visitas', en: 'Can access all websites you visit' },
  debugger:        { es: 'Puede inspeccionar y modificar el contenido de cualquier página', en: 'Can inspect and modify the content of any page' },
  nativeMessaging: { es: 'Puede comunicarse con programas instalados en tu computador', en: 'Can communicate with programs installed on your computer' },
  proxy:           { es: 'Puede controlar toda tu conexión a internet', en: 'Can control your entire internet connection' },
  vpnProvider:     { es: 'Puede crear un túnel VPN y ver tu tráfico de red', en: 'Can create a VPN tunnel and see your network traffic' },
  desktopCapture:  { es: 'Puede tomar capturas de pantalla de tu escritorio', en: 'Can take screenshots of your desktop' },
  tabCapture:      { es: 'Puede grabar video y audio de tus pestañas', en: 'Can record video and audio from your tabs' },
  pageCapture:     { es: 'Puede guardar una copia completa de cualquier página', en: 'Can save a complete copy of any page' },
  cookies:         { es: 'Puede leer y modificar las cookies de los sitios (sesiones, datos de login)', en: 'Can read and modify site cookies (sessions, login data)' },
  scripting:       { es: 'Puede ejecutar código en las páginas web que visitas', en: 'Can run code on the web pages you visit' },
  declarativeNetRequest: { es: 'Puede bloquear o modificar las peticiones de red', en: 'Can block or modify network requests' },
  webRequest:      { es: 'Puede ver todas las peticiones que hace tu navegador', en: 'Can see all requests your browser makes' },
  webRequestBlocking: { es: 'Puede bloquear o modificar peticiones antes de que se envíen', en: 'Can block or modify requests before they are sent' },
  history:         { es: 'Puede ver todo tu historial de navegación', en: 'Can see your entire browsing history' },
  downloads:       { es: 'Puede iniciar descargas y ver tus archivos descargados', en: 'Can start downloads and see your downloaded files' },
  'downloads.open':{ es: 'Puede abrir archivos descargados automáticamente', en: 'Can automatically open downloaded files' },
  privacy:         { es: 'Puede modificar la configuración de privacidad del navegador', en: 'Can modify browser privacy settings' },
  browsingData:    { es: 'Puede borrar tu historial, cookies y datos de navegación', en: 'Can delete your history, cookies and browsing data' },
  contentSettings: { es: 'Puede cambiar permisos de sitios (cámara, micrófono, ubicación)', en: 'Can change site permissions (camera, microphone, location)' },
  webNavigation:   { es: 'Puede ver todos los sitios web que visitas en tiempo real', en: 'Can see all websites you visit in real time' },
  userScripts:     { es: 'Puede inyectar scripts personalizados en páginas web', en: 'Can inject custom scripts into web pages' },
  declarativeNetRequestWithHostAccess: { es: 'Puede modificar peticiones de red con acceso a hosts específicos', en: 'Can modify network requests with specific host access' },
  webAuthenticationProxy:    { es: 'Puede interceptar flujos de autenticación WebAuthn', en: 'Can intercept WebAuthn authentication flows' },
  webRequestAuthProvider:    { es: 'Puede responder automáticamente a ventanas de contraseña de sitios web', en: 'Can automatically respond to website password prompts' },
  activeTab:       { es: 'Puede acceder temporalmente a la pestaña activa cuando haces clic', en: 'Can temporarily access the active tab when you click' },
  tabs:            { es: 'Puede ver las URLs y títulos de tus pestañas abiertas', en: 'Can see the URLs and titles of your open tabs' },
  bookmarks:       { es: 'Puede leer y modificar tus marcadores', en: 'Can read and modify your bookmarks' },
  clipboardRead:   { es: 'Puede leer lo que copias al portapapeles', en: 'Can read what you copy to the clipboard' },
  clipboardWrite:  { es: 'Puede escribir en tu portapapeles', en: 'Can write to your clipboard' },
  geolocation:     { es: 'Puede conocer tu ubicación sin pedirte permiso', en: 'Can know your location without asking permission' },
  identity:        { es: 'Puede acceder a tu cuenta de Google', en: 'Can access your Google account' },
  'identity.email':{ es: 'Puede ver tu dirección de correo electrónico', en: 'Can see your email address' },
  management:      { es: 'Puede ver y controlar tus otras extensiones instaladas', en: 'Can see and control your other installed extensions' },
  topSites:        { es: 'Puede ver tus sitios más visitados', en: 'Can see your most visited sites' },
  alarms:          { es: 'Puede ejecutar tareas en segundo plano periódicamente', en: 'Can run background tasks periodically' },
  contextMenus:    { es: 'Puede agregar opciones al menú del clic derecho', en: 'Can add options to the right-click menu' },
  offscreen:       { es: 'Puede crear documentos ocultos con acceso al DOM', en: 'Can create hidden documents with DOM access' },
  sessions:        { es: 'Puede acceder a tus sesiones y pestañas recientes', en: 'Can access your recent sessions and tabs' },
  storage:         { es: 'Puede guardar datos localmente en tu navegador', en: 'Can store data locally in your browser' },
  unlimitedStorage:{ es: 'Puede guardar datos sin límite de almacenamiento', en: 'Can store data without storage limits' },
  notifications:   { es: 'Puede mostrarte notificaciones en el escritorio', en: 'Can show you desktop notifications' },
  idle:            { es: 'Puede detectar si estás usando el computador', en: 'Can detect if you are using the computer' },
  sidePanel:       { es: 'Puede mostrar contenido en el panel lateral de Chrome', en: 'Can show content in Chrome\'s side panel' },
  tts:             { es: 'Puede leer texto en voz alta', en: 'Can read text aloud' },
  fontSettings:    { es: 'Puede cambiar la configuración de fuentes del navegador', en: 'Can change browser font settings' },
  search:          { es: 'Puede interactuar con la barra de búsqueda de Chrome', en: 'Can interact with Chrome\'s search bar' },
  tabGroups:       { es: 'Puede ver y gestionar tus grupos de pestañas', en: 'Can view and manage your tab groups' },
  dns:             { es: 'Puede realizar consultas DNS directas', en: 'Can make direct DNS queries' },
  processes:       { es: 'Puede monitorear los procesos internos del navegador', en: 'Can monitor internal browser processes' },
  power:           { es: 'Puede mantener la pantalla encendida', en: 'Can keep the screen awake' },
  ttsEngine:       { es: 'Puede implementar un motor de voz personalizado', en: 'Can implement a custom text-to-speech engine' },
  declarativeContent: { es: 'Puede activar acciones según el contenido de la página', en: 'Can activate actions based on page content' },
  gcm:             { es: 'Puede recibir mensajes desde servidores de Google', en: 'Can receive messages from Google servers' },
  favicon:         { es: 'Puede leer los íconos de los sitios web que visitas', en: 'Can read the icons of websites you visit' },
  readingList:     { es: 'Puede acceder a tu lista de lectura', en: 'Can access your reading list' },
  printing:        { es: 'Puede usar funciones de impresión', en: 'Can use printing functions' },
  printingMetrics: { es: 'Puede ver métricas de tus impresiones', en: 'Can view your printing metrics' },
  documentScan:    { es: 'Puede acceder a escáneres de documentos', en: 'Can access document scanners' },
  loginState:      { es: 'Puede detectar el estado de inicio de sesión', en: 'Can detect login state' },
  background:      { es: 'Puede iniciar Chrome automáticamente al encender el equipo', en: 'Can start Chrome automatically at login' },
  declarativeNetRequestFeedback: { es: 'Puede depurar las reglas de red aplicadas', en: 'Can debug applied network rules' },
  'downloads.ui':  { es: 'Puede modificar la interfaz de descargas', en: 'Can modify the downloads UI' },
  'system.cpu':    { es: 'Puede ver información de tu procesador', en: 'Can view your CPU information' },
  'system.display':{ es: 'Puede ver información de tus pantallas', en: 'Can view your display information' },
  'system.memory': { es: 'Puede ver información de tu memoria RAM', en: 'Can view your RAM information' },
  'system.storage':{ es: 'Puede gestionar el almacenamiento del sistema', en: 'Can manage system storage' },
  printerProvider: { es: 'Puede implementar un proveedor de impresora', en: 'Can implement a printer provider' },
  platformKeys:    { es: 'Puede acceder a claves criptográficas de la plataforma', en: 'Can access platform cryptographic keys' },
  certificateProvider: { es: 'Puede proveer certificados TLS al navegador', en: 'Can provide TLS certificates to the browser' },
  'accessibilityFeatures.modify': { es: 'Puede modificar las funciones de accesibilidad', en: 'Can modify accessibility features' },
  'accessibilityFeatures.read':   { es: 'Puede leer el estado de accesibilidad', en: 'Can read accessibility state' },
};

/**
 * Retorna la descripción legible de un permiso en el idioma indicado.
 * Si no se encuentra, genera una descripción genérica.
 */
export function getPermissionDescription(permission: string, lang: 'es' | 'en'): string {
  const entry = DESCRIPTIONS[permission];
  if (entry) return entry[lang];

  // Host patterns como "https://example.com/*"
  if (permission.includes('://') || permission === '<all_urls>') {
    const isUniversal =
      permission === '<all_urls>' ||
      permission === '*://*/*' ||
      permission === 'http://*/*' ||
      permission === 'https://*/*';
    if (isUniversal) {
      return lang === 'es' ? 'Todos los sitios web' : 'All websites';
    }
    // Patrón de subdominio wildcard: *://*.example.com/*
    const subdomainMatch = permission.match(/^[*a-z]+:\/\/\*\.(.+?)\/.*$/);
    if (subdomainMatch) {
      return lang === 'es'
        ? `Todos los subdominios de ${subdomainMatch[1]}`
        : `All subdomains of ${subdomainMatch[1]}`;
    }
    // Dominio específico: https://example.com/*
    const domainMatch = permission.match(/^[*a-z]+:\/\/([^/]+)\//);
    const display = domainMatch ? domainMatch[1] : permission;
    return lang === 'es' ? `Accede a: ${display}` : `Access: ${display}`;
  }

  return permission;
}
