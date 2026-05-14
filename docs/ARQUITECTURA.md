# ExtWarden — Documentación Técnica

> **Proyecto de Grado** — Adriana Sofía Rozo Cepeda  
> Universidad de los Andes · Departamento de Ingeniería de Sistemas y Computación  
> Asesora: Yuri Andrea Pinto Rojas

---

## Tabla de Contenidos

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Arquitectura General](#2-arquitectura-general)
3. [Motor de Evaluación de Riesgo](#3-motor-de-evaluación-de-riesgo)
4. [Módulo de Detección de Cambios](#4-módulo-de-detección-de-cambios)
5. [Sistema de Zonas Seguras](#5-sistema-de-zonas-seguras)
6. [Interfaz de Usuario](#6-interfaz-de-usuario)
7. [Flujo de Datos Completo](#7-flujo-de-datos-completo)
8. [Permisos Declarados y Justificación](#8-permisos-declarados-y-justificación)
9. [Persistencia de Datos](#9-persistencia-de-datos)
10. [Internacionalización](#10-internacionalización)
11. [Stack Tecnológico](#11-stack-tecnológico)
12. [Comparación Tesis vs. Implementación](#12-comparación-tesis-vs-implementación)

---

## 1. Resumen del Sistema

ExtWarden es una extensión de Google Chrome (Manifest V3) que implementa tres mecanismos de seguridad complementarios para proteger al usuario de los riesgos asociados a otras extensiones instaladas:

| Módulo | Qué hace | Cómo lo hace |
|--------|----------|--------------|
| **Auditoría de Permisos** | Calcula un puntaje de riesgo 0–100+ para cada extensión | Fórmula semi-cuantitativa: Peso × Alcance |
| **Detección de Cambios** | Alerta cuando una extensión actualiza y adquiere nuevos permisos | Snapshots en `chrome.storage`, comparados en `onInstalled` |
| **Zonas Seguras** | Deshabilita automáticamente las demás extensiones en sitios sensibles | Listeners de navegación + `chrome.management.setEnabled` |

---

## 2. Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                  MANIFEST V3                        │
│                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐ │
│  │   Service Worker     │  │   Content Script     │ │
│  │  (service-worker.ts) │  │ (content-script.ts)  │ │
│  │                      │  │                      │ │
│  │ • evaluateTab()      │◄─┤ • showAlert overlay  │ │
│  │ • onInstalled()      │  │ • Recibe mensajes     │ │
│  │ • onUpdated()        │──►│   del SW             │ │
│  │ • computeRisk()      │  └──────────────────────┘ │
│  │ • chrome.management  │                           │
│  └────────┬─────────────┘                           │
│           │  chrome.storage.local                   │
│           ▼                                         │
│  ┌────────────────────┐   ┌────────────────────┐   │
│  │    Popup UI        │   │    Options UI       │   │
│  │   (popup.html)     │   │  (options.html)     │   │
│  │                    │   │                     │   │
│  │ • Estado actual    │   │ • Auditoría         │   │
│  │ • Dominio activo   │   │ • Actualizaciones   │   │
│  │ • Zona activa      │   │ • Zonas Seguras     │   │
│  └────────────────────┘   └────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Archivos principales

```
src/
├── background/
│   └── service-worker.ts        # Core: evaluación, zonas, cambios
├── content/
│   └── content-script.ts        # Overlay de alerta en páginas web
├── popup/
│   ├── Popup.tsx                 # UI del popup (icono de extensión)
│   └── main.tsx
├── options/
│   ├── Options.tsx               # Panel de configuración principal
│   └── components/
│       ├── ExtensionAudit.tsx    # Tab de auditoría
│       ├── Updates.tsx           # Tab de detección de cambios
│       └── ContextZones.tsx      # Tab de zonas seguras
├── engine/
│   └── riskEngine.ts            # Fórmula de riesgo (Sección 4.4 tesis)
├── data/
│   ├── permissionWeights.ts     # Pesos y clasificación S/E por permiso
│   └── permissionDescriptions.ts # Descripciones amigables ES/EN
├── hooks/
│   └── useExtensions.ts         # Hook React para chrome.management
├── utils/
│   └── chromeApi.ts             # Helpers de storage: getZones, saveZones
├── types/
│   └── index.ts                 # Tipos TypeScript compartidos
└── i18n/
    ├── index.ts
    └── locales/
        ├── es.json              # Español
        └── en.json              # English
```

---

## 3. Motor de Evaluación de Riesgo

### Fórmula (Sección 4.4 de la tesis)

```
Riesgo = Σ(S) [Peso_i × f(H)]
        + Σ(E) [Peso_j]
```

Donde:
- **S** = conjunto de permisos sensibles a host (ej: `scripting`, `cookies`)
- **E** = conjunto de permisos estáticos (ej: `notifications`, `storage`)
- **f(H)** = factor de alcance de host_permissions

### Factor de Alcance f(H)

| Condición | f(H) |
|-----------|------|
| Sin `host_permissions` ni `activeTab` | 0.0 |
| Solo `activeTab` | 0.3 |
| Dominios específicos (ej: `https://example.com/*`) | 0.5 |
| Wildcards amplios (`*://*.domain.com/*`) | 0.8 |
| `<all_urls>`, `*://*/*`, `http://*/*`, `https://*/*` | 1.0 |

### Pesos por Nivel de Riesgo

| Nivel | Peso | Permisos representativos |
|-------|------|--------------------------|
| Crítico | 10 | `debugger`, `nativeMessaging`, `proxy`, `vpnProvider`, `tabCapture`, `pageCapture` |
| Alto | 5 | `cookies`, `scripting`, `history`, `downloads`, `privacy`, `webRequest` |
| Medio | 2 | `alarms`, `management`, `tabs`, `offscreen`, `identity`, `geolocation` |
| Bajo | 1 | `storage`, `notifications`, `idle`, `sidePanel`, `gcm`, `tts` |

### Umbrales de Clasificación

| Rango | Nivel | Color UI |
|-------|-------|----------|
| 0 | Seguro (`safe`) | Verde |
| 1–10 | Bajo (`low`) | Azul |
| 11–25 | Moderado (`medium`) | Amarillo |
| 26–50 | Alto (`high`) | Naranja |
| > 50 | Crítico (`critical`) | Rojo |

### Implementación: `src/engine/riskEngine.ts`

Funciones exportadas:
- `computeRisk(permissions, hostPermissions)` → `RiskBreakdown`
- `computeHostFactor(hostPermissions, permissions)` → `number`
- `scoreToLevel(score)` → `RiskLevel`
- `analyzeExtension(ext)` → `InstalledExtension`

---

## 4. Módulo de Detección de Cambios

### Funcionamiento (Service Worker)

```
chrome.management.onInstalled → (extensión instalada/actualizada)
        │
        ├── ¿Primera vez vista?
        │       └── log 'installed' en activityLog
        │
        └── ¿Actualización?
                ├── Comparar permisos: version N vs N+1
                ├── ¿Nuevos permisos añadidos?
                │       ├── chrome.management.setEnabled(ext.id, false) ← AUTO-DISABLE
                │       ├── Guardar en changeHistory
                │       ├── log 'warning' en activityLog
                │       └── chrome.notifications.create() ← NOTIFICACIÓN NATIVA
                └── Sin cambios de permisos
                        └── log 'allowed' en activityLog
```

### Snapshot de Permisos

Guardado en `chrome.storage.local` bajo la clave `extSnapshots`:

```json
{
  "extensionId": {
    "version": "5.12.2",
    "permissions": ["management", "cookies", "scripting"],
    "hostPermissions": ["<all_urls>"]
  }
}
```

### Estructura de changeHistory

```json
{
  "id": "chg-1710000000000",
  "timestamp": "2026-04-04T10:00:00.000Z",
  "extensionId": "abc123",
  "extensionName": "Urban VPN Proxy",
  "type": "new_permissions",
  "details": "v5.12.1 → v5.12.2",
  "newPermissions": ["webRequest", "tabs"],
  "autoDisabled": true
}
```

---

## 5. Sistema de Zonas Seguras

### Flujo de Evaluación

```
chrome.tabs.onUpdated / onActivated
        │
        └── evaluateTab(tabId, url)
                │
                ├── ¿Protección desactivada? → reEnableExtensions()
                ├── ¿URL sin hostname? → reEnableExtensions()
                ├── ¿Hostname coincide con alguna zona?
                │       └── NO → reEnableExtensions()
                │
                └── SÍ (zona activa)
                        ├── Obtener todas las extensiones instaladas
                        ├── Para cada extensión habilitada que no sea ExtWarden:
                        │       ├── chrome.management.setEnabled(false) ← DESHABILITAR
                        │       ├── log 'blocked' en activityLog
                        │       └── incrementBlocked()
                        └── Guardar IDs deshabilitados en storage: disabledByZone[tabId]

chrome.tabs.onRemoved / navegación fuera de zona
        └── reEnableExtensions(tabId) ← RE-HABILITAR AUTOMÁTICAMENTE
```

### Coincidencia de Patrones

La función `matchesZonePattern(hostname, pattern)` soporta:

| Patrón | Ejemplo | Coincide con |
|--------|---------|--------------|
| Wildcard | `*.bancolombia.com` | `sucursal.bancolombia.com`, `bancolombia.com` |
| Palabra clave | `bancolombia` | `www.bancolombia.com`, `app.bancolombia.co` |
| Dominio exacto | `bancolombia.com` | `bancolombia.com`, `www.bancolombia.com` |

### Estructura de CriticalZone

```typescript
interface CriticalZone {
  id: string;           // "zone-1710000000000"
  category: string;     // "Banca"
  patterns: string[];   // ["bancolombia.com", "*.davivienda.com"]
  blockedExtensions: string[];  // reservado para uso futuro
  createdAt: string;    // ISO timestamp
}
```

---

## 6. Interfaz de Usuario

### Panel de Opciones (`options.html`)

Diseño: página centrada, `max-w-screen-xl`, navegación por tabs horizontales.

| Tab | Componente | Funcionalidad |
|-----|-----------|---------------|
| **Auditoría** | `ExtensionAudit.tsx` | Tabla de extensiones con riesgo calculado, badges de permisos sensibles, toggle de habilitación, búsqueda y paginación |
| **Actualizaciones** | `Updates.tsx` | Lista de cambios detectados, extensiones con nuevos permisos pendientes de revisión, botón para re-habilitar |
| **Zonas Seguras** | `ContextZones.tsx` | CRUD de zonas: crear categoría, agregar URLs, eliminar URLs individuales, eliminar zona |

### Popup (`popup.html`)

Muestra:
- Dominio activo de la pestaña actual
- Si el dominio está en una zona segura (zona activa / contexto seguro)
- Número de extensiones activas en la pestaña
- Enlace al panel completo

### Alerta del Content Script

Se inyecta en la página cuando el Service Worker detecta una extensión bloqueada en una zona. Muestra:
- Nombre de la extensión bloqueada
- Nivel de riesgo
- Zona activa
- Botón para ignorar o desactivar permanentemente

---

## 7. Flujo de Datos Completo

```
Usuario navega a bancolombia.com
        │
        ├── tabs.onUpdated → evaluateTab()
        │       ├── Lee criticalZones de storage
        │       ├── Coincide con zona "Banca"
        │       ├── Obtiene todas las extensiones (chrome.management.getAll)
        │       ├── Deshabilita cada extensión habilitada que no sea ExtWarden
        │       ├── addActivity({action:'blocked',...})
        │       └── Guarda disabledByZone[tabId] en chrome.storage.local
        │
        ├── Las demás extensiones quedan apagadas durante la zona
        │
        │
        └── Usuario abre popup
                └── Muestra "Zona de protección activa · Banca"

Usuario navega a google.com (fuera de zona)
        └── tabs.onUpdated → evaluateTab()
                └── reEnableExtensions(tabId)
                        └── setEnabled(extId, true) para cada extensión apagada por ExtWarden
```

---

## 8. Permisos Declarados y Justificación

Permisos en `public/manifest.json`:

| Permiso | Por qué ExtWarden lo necesita |
|---------|-------------------------------|
| `management` | Leer lista de extensiones instaladas y deshabilitar/re-habilitar extensiones durante zonas seguras |
| `storage` | Guardar zonas configuradas, historial de actividad, snapshots de permisos y contadores |
| `tabs` | Leer la URL de la pestaña activa para detectar si está en una zona segura |
| `activeTab` | Acceder a la pestaña activa desde el popup |
| `alarms` | Resetear el contador diario de bloqueos a medianoche |
| `notifications` | Mostrar notificaciones nativas cuando se detectan nuevos permisos en una actualización |
| `<all_urls>` (host) | Necesario para que el content script se inyecte en cualquier página y para enviar mensajes a pestañas arbitrarias |

---

## 9. Persistencia de Datos

Todas las claves se guardan en `chrome.storage.local`:

| Clave | Tipo | Descripción | Límite |
|-------|------|-------------|--------|
| `criticalZones` | `CriticalZone[]` | Zonas seguras configuradas por el usuario | Sin límite |
| `activityLog` | `ActivityEvent[]` | Log de eventos de seguridad | 100 entradas (FIFO) |
| `changeHistory` | `object[]` | Historial de actualizaciones con nuevos permisos | 100 entradas (FIFO) |
| `extSnapshots` | `Record<string, Snapshot>` | Huella digital de permisos por extensión | Una por extensión |
| `disabledByZone` | `Record<string, string[]>` | Extensiones deshabilitadas temporalmente por pestaña en zonas seguras | Una lista por pestaña |
| `protectionEnabled` | `boolean` | Activar/desactivar la protección global | — |
| `blockedToday` | `number` | Extensiones bloqueadas hoy | Reset diario |
| `blockedTotal` | `number` | Total histórico de bloqueos | Acumulativo |
| `blockedDate` | `string` | Fecha del último reset diario | — |

---

## 10. Internacionalización

La extensión soporta **Español** (default) e **Inglés**, implementado con `i18next` + `react-i18next`.

Archivos:
- `src/i18n/locales/es.json`
- `src/i18n/locales/en.json`

El idioma se selecciona desde el `LanguageSwitcher` en el panel de opciones. Las descripciones de permisos en la auditoría también están en ambos idiomas (`permissionDescriptions.ts`).

---

## 11. Stack Tecnológico

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| TypeScript | 5.6 | Lenguaje principal |
| React | 18.3 | UI del popup y panel de opciones |
| Vite | 6.0 | Bundler con soporte multi-entry (popup, options, content-script, service-worker) |
| Tailwind CSS | 3.4 | Estilos utilitarios |
| i18next / react-i18next | 23/14 | Internacionalización ES/EN |
| Chrome Extensions API | MV3 | `management`, `storage`, `tabs`, `alarms`, `notifications` |

### Build

```bash
npm install
npm run build    # tsc --noEmit && vite build
```

Salida en `dist/`. Para cargar en Chrome:
1. `chrome://extensions` → Modo desarrollador ON
2. "Cargar descomprimida" → seleccionar `dist/`

### Configuración Vite (`vite.config.ts`)

Entradas múltiples:
```
popup.html     → dist/popup.html + JS bundle
options.html   → dist/options.html + JS bundle  
content-script → dist/content-script.js
service-worker → dist/service-worker.js (iife, no chunks)
```

---

## 12. Comparación Tesis vs. Implementación

### Estado de Implementación por Objetivo

| Objetivo (Tesis) | Estado | Implementación |
|-----------------|--------|----------------|
| Motor de evaluación de riesgo (Sección 4.4) | ✅ Completo | `riskEngine.ts`, `permissionWeights.ts` |
| Fórmula: Peso × f(H) para permisos sensibles a host + Peso para permisos estáticos | ✅ Completo | `computeRisk()` en `riskEngine.ts` |
| 58+ permisos clasificados | ✅ Completo | `permissionWeights.ts` |
| Factor f(H) con 5 niveles | ✅ Completo | `computeHostFactor()` |
| Umbrales 0/10/25/50 | ✅ Completo | `scoreToLevel()` |
| Módulo Update Watcher | ✅ Completo | `onInstalled` en `service-worker.ts` |
| Snapshot de permisos v_N vs v_{N+1} | ✅ Completo | `extSnapshots` en storage |
| Auto-deshabilitar en nuevos permisos | ✅ Completo | `setEnabled(false)` + notificación |
| Historial de cambios UI | ✅ Completo | `Updates.tsx` + `changeHistory` |
| Sistema de Zonas Seguras | ✅ Completo | `evaluateTab()`, `disabledByZone` en storage |
| Re-habilitar al salir de zona | ✅ Completo | `reEnableExtensions()` en `onRemoved`/`onActivated` |
| Alerta en página (content script) | ✅ Completo | `content-script.ts` overlay |
| Popup con estado de zona | ✅ Completo | `Popup.tsx` |
| CRUD de zonas UI | ✅ Completo | `ContextZones.tsx` |
| Interfaz bilingüe ES/EN | ✅ Completo | `i18n/locales/*.json` |
| Exclusión de sí misma del análisis | ✅ Completo | `ext.id === chrome.runtime.id` check |
| Contador de bloqueos (hoy/total) | ✅ Completo | `incrementBlocked()` + reset diario |

### Diferencias con el Whitepaper de Google (implementadas)

Los siguientes permisos tienen clasificaciones distintas a las del whitepaper de Google 2019, justificadas por evidencia de ataques 2024-2026:

| Permiso | Google | ExtWarden | Razón |
|---------|--------|-----------|-------|
| `cookies` | Medium | **Alto** | DataByCloud session hijacking (2026) |
| `scripting` | Medium | **Alto** | Keyloggers en MV3 (Singh et al. 2025) |
| `alarms` | Low | **Medio** | Vector de persistencia estándar en MV3 |
| `offscreen` | N/A | **Medio** | Permiso nuevo MV3, DOM oculto persistente |
| `desktopCapture` | Medium | **Alto** | Captura fuera del navegador |
| `tabs` | High | **Medio** | Baja prevalencia en ataques documentados |
| `system.storage` | Medium | **Bajo** | Sin datos personales, sin ataques documentados |

---

## `webRequestAuthProvider` — Explicación

Este permiso, que aparece en Urban VPN Proxy, permite a la extensión **interceptar y responder automáticamente a cuadros de diálogo de autenticación HTTP** (ventanas emergentes que piden usuario/contraseña para acceder a un recurso web protegido).

En la práctica, una extensión con este permiso puede:
1. Detectar cuando un sitio web solicita credenciales HTTP Basic/Digest
2. Proveer automáticamente credenciales sin mostrar el diálogo al usuario
3. Potencialmente **interceptar las credenciales** que el usuario ingresaría

En el contexto de una VPN proxy como Urban VPN, su uso podría ser legítimo (manejo de autenticación del proxy). Sin embargo, combinado con `proxy` y `management`, justifica la clasificación **Crítico** asignada por ExtWarden.

La descripción amigable en la UI es: *"Puede responder automáticamente a ventanas de contraseña de sitios web"*
