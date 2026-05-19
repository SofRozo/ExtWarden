# Arquitectura

## Estructura de módulos

```
src/
├── background/
│   └── service-worker.ts       # Núcleo: zonas, polling, integración backend
├── content/
│   ├── content-script.ts       # Inyecta alerta visual en páginas protegidas
│   └── AlertOverlay.tsx        # Componente del banner de protección
├── engine/
│   └── riskEngine.ts           # Fórmula de riesgo local (sin servidor)
├── data/
│   ├── permissionWeights.ts    # Pesos e info de 69 permisos Chrome
│   └── permissionDescriptions.ts # Textos legibles por permiso (ES/EN)
├── hooks/
│   ├── useExtensions.ts        # Lista extensiones con riskEngine aplicado
│   ├── useSandboxData.ts       # Lee jobs y reportes del backend desde storage
│   ├── useChromeStorage.ts     # Hook bidireccional sobre chrome.storage.local
│   └── useCurrentTab.ts        # Hostname de la pestaña activa
├── options/
│   ├── Options.tsx             # Navegación: Auditoría / Actualizaciones / Zonas
│   └── components/
│       ├── ExtensionAudit.tsx  # Tabla + drawer de análisis profundo
│       ├── Dashboard.tsx       # Resumen general y actividad
│       ├── ContextZones.tsx    # CRUD de zonas de protección
│       └── Updates.tsx         # Historial de cambios en extensiones
├── popup/
│   └── Popup.tsx               # Vista compacta (330px) para el ícono
└── types/index.ts              # Contratos de tipos (local + backend)
```

## Dos entornos de ejecución

| Entorno | Archivo | Cuándo corre |
|---------|---------|--------------|
| Service worker (background) | `service-worker.ts` | Siempre, en segundo plano |
| UI (options + popup) | `Options.tsx`, `Popup.tsx` | Solo cuando el usuario abre la extensión |
| Content script | `content-script.ts` | En cada página web cargada |

La comunicación entre ellos ocurre via `chrome.runtime.sendMessage()` y `chrome.storage.local`.

## Almacenamiento (`chrome.storage.local`)

| Clave | Contenido |
|-------|-----------|
| `criticalZones` | Zonas de contexto definidas por el usuario |
| `sandboxJobs` | Estado actual de jobs en progreso (`Record<extId, SandboxJob>`) |
| `sandboxReports` | Reportes completados del backend (`Record<extId, SandboxReport>`) |
| `activityLog` | Últimos 100 eventos (bloqueos, instalaciones, actualizaciones) |
| `extSnapshots` | Snapshot de permisos por extensión para detectar cambios |
| `changeHistory` | Historial de actualizaciones detectadas |
| `disabledByZone` | Qué extensiones deshabilitó ExtWarden por tab (`Record<tabId, extId[]>`) |
| `protectionEnabled` | Toggle global de protección de zonas |
| `blockedToday` / `blockedTotal` | Contadores de bloqueos |
| `openDrawerForExtension` | Flag para abrir drawer automáticamente tras notificación |

## Popup vs Options

| | Popup | Options |
|--|-------|---------|
| Tamaño | 330px × compacto | Pantalla completa |
| Contenido | Dominio activo + lista rápida | Auditoría completa + zonas + actualizaciones |
| Análisis profundo | Solo indicador (dot + check) | Drawer completo con 4 bloques |
| Acceso | Clic en ícono de Chrome | Desde popup o menú de extensiones |
