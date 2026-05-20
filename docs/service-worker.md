# Service Worker

Archivo: [src/background/service-worker.ts](../src/background/service-worker.ts)

El service worker es el núcleo de ExtWarden. Corre en segundo plano de forma persistente y coordina todas las funciones de la extensión: protección de zonas, integración con el backend, vigilancia de actualizaciones y actividad.

## Responsabilidades

### 1. Protección de zonas de contexto

Escucha `chrome.tabs.onUpdated` y `chrome.tabs.onActivated`. En cada navegación evalúa si el dominio coincide con alguna zona configurada y deshabilita/rehabilita extensiones en consecuencia.

Ver detalle en [context-zones.md](context-zones.md).

### 2. Integración con el backend (análisis profundo)

**Envío del análisis:**
```
submitToBackend(extensionId)
    → POST /analyze { extensionId }
    ← { jobId }
    → Guarda job en sandboxJobs[extId]
    → Activa alarma de polling
```

**Polling de estado:**
- Alarma `SANDBOX_POLL_ALARM` dispara cada 30 segundos
- `pollSandboxJobs()` itera sobre todos los jobs activos
- Para cada job: `GET /status/{jobId}` → actualiza estado en storage
- Si `completed` → `GET /report/{jobId}` → normaliza → guarda en `sandboxReports`
- Si `failed` o 3 fallos consecutivos → marca como fallido

**Normalización del reporte:**
`normalizeReport(raw)` deriva un `riskLevel` ('CRITICAL'/'HIGH'/'MEDIUM'/'LOW'/'NONE') a partir del `veredicto_global` y `nivel_riesgo_inicial` del módulo LLM explicativo para que la UI pueda colorearlo sin lógica adicional.

**Notificación al usuario:**
Cuando el análisis completa, `chrome.notifications.create()` muestra una notificación con el veredicto. Al hacer clic en ella, abre el panel de opciones con el drawer de esa extensión ya abierto (`openDrawerForExtension` en storage).

### 3. Vigilancia de actualizaciones de extensiones

Escucha `chrome.management.onInstalled`. Para cada extensión instalada o actualizada:

1. Compara los permisos actuales contra el snapshot guardado (`extSnapshots[extId]`)
2. Si hay **permisos nuevos** que no estaban antes:
   - Deshabilita la extensión automáticamente
   - Crea una entrada en `changeHistory`
   - Envía notificación al usuario
3. Actualiza el snapshot con los permisos actuales

Esto implementa la política de **zero-trust en actualizaciones**: una extensión que amplía sus permisos queda bloqueada hasta que el usuario la revise.

### 4. Registro de actividad

Todos los eventos relevantes se registran en `activityLog` (máximo 100 entradas, FIFO):

| Acción | Cuándo |
|--------|--------|
| `blocked` | Extensión deshabilitada por zona de contexto |
| `allowed` | Extensión rehabilitada al salir de zona |
| `installed` | Nueva extensión detectada |
| `updated` | Extensión actualizada (con o sin nuevos permisos) |
| `warning` | Extensión deshabilitada por nuevos permisos |
| `removed` | Extensión desinstalada |

### 5. Arranque y persistencia entre sesiones

Al iniciar (`chrome.runtime.onInstalled`, `chrome.runtime.onStartup`):
- `ensurePollingAlarm()` — reactiva la alarma de polling si hay jobs pendientes de sesiones anteriores
- `snapshotAllExtensions()` — toma snapshot inicial de permisos de todas las extensiones

Esto garantiza que si el navegador se cierra con análisis en progreso, el polling se reanuda automáticamente al reabrirse.

## Mensajes recibidos (`chrome.runtime.onMessage`)

| Acción | Enviado desde | Qué hace |
|--------|--------------|----------|
| `reanalyzeExtension` | ExtensionAudit.tsx | Limpia job/report previo y envía análisis nuevo al backend |
| `getZoneStatus` | Popup.tsx | Responde si el tab activo está en zona protegida |
| `toggleProtection` | Popup.tsx | Activa/desactiva la protección global |

## Alarmas Chrome (`chrome.alarms`)

| Nombre | Intervalo | Propósito |
|--------|-----------|-----------|
| `SANDBOX_POLL_ALARM` | 30s | Polling de jobs activos al backend |
| `DAILY_RESET_ALARM` | Medianoche | Resetea el contador `blockedToday` |
