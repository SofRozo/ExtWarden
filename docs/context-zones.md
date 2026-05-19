# Zonas de Contexto

Las zonas de contexto permiten al usuario definir sitios web sensibles donde ExtWarden deshabilita automáticamente todas las demás extensiones instaladas mientras navega en ellos, y las restaura al salir.

## Concepto

Una extensión legítima de productividad puede representar un riesgo si corre activa mientras el usuario está en su banco, correo corporativo o portal de gobierno. Las zonas de contexto aplican el principio de mínimo privilegio: las otras extensiones no corren en sitios donde no deberían.

## Estructura de una zona

```typescript
{
  id: string,                    // UUID generado al crear
  category: string,              // Nombre legible ("Banca", "Universidad")
  patterns: string[],            // Patrones de dominio (ver abajo)
  blockedExtensions: string[],   // IDs de extensiones que esta zona bloqueó
  createdAt: string,             // ISO timestamp
}
```

## Patrones de dominio

| Patrón | Coincide con |
|--------|-------------|
| `*.bancolombia.com` | Todos los subdominios de bancolombia.com |
| `bancolombia.com` | bancolombia.com y sus subdominios |
| `bancolombia` | Cualquier host que contenga esa palabra |

## Flujo de protección

```
Usuario navega a una URL
    │
    ▼
service-worker.ts — evaluateTab(tabId, url)
    ├─ Obtiene hostname de la URL
    ├─ Carga criticalZones de chrome.storage.local
    └─ Para cada zona: ¿algún patrón coincide con el hostname?
           │
      SÍ ──┘
           ▼
    chrome.management.getAll()
    → filtra extensiones enabled (excepto ExtWarden)
    → chrome.management.setEnabled(extId, false) para cada una
    → disabledByZone[tabId] = [extIds...]
    → activityLog.push({ action: 'blocked', ... })
    → content-script recibe mensaje → muestra banner de protección
           │
    Usuario sale del dominio (onUpdated / onActivated)
           ▼
    Comprueba si hay otra zona activa para el nuevo dominio
    Si no hay:
    → chrome.management.setEnabled(extId, true) para las IDs guardadas
    → limpia disabledByZone[tabId]
    → banner desaparece
```

## Gestión desde la UI (ContextZones.tsx)

- **Crear zona:** nombre de categoría + lista de patrones de dominio
- **Editar zona:** modificar nombre o patrones
- **Eliminar zona:** borra la zona y su historial de bloqueos
- Los cambios se persisten inmediatamente en `chrome.storage.local`
- El service-worker los toma en la siguiente navegación

## Banner de protección (content script)

Cuando una zona está activa, el content script inyecta un banner no intrusivo en la esquina de la página indicando que la protección está activa y qué zona la disparó. El banner no interfiere con el contenido de la página.

## Toggle global

El usuario puede desactivar la protección de zonas globalmente desde el popup sin borrar las zonas configuradas. Se persiste en `chrome.storage.local` bajo la clave `protectionEnabled`.
