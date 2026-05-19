# Engine de Riesgo Local

Implementado en [src/engine/riskEngine.ts](../src/engine/riskEngine.ts). Calcula un puntaje de riesgo para cada extensión instalada **sin necesidad de servidor**, leyendo únicamente el manifest.

## Fórmula (Sección 4.4, Tesis ExtWarden)

```
Riesgo = Σ(i ∈ S) [Peso_i × f(H)]  +  Σ(j ∈ E) [Peso_j]
```

- **S** — permisos cuyo riesgo depende del alcance de host (ej. `scripting`, `cookies`)
- **E** — permisos cuyo riesgo es fijo independientemente de los hosts (ej. `history`, `management`)
- **f(H)** — factor de alcance según los `host_permissions` declarados

## Factor de alcance f(H)

| Situación | f(H) |
|-----------|------|
| Sin `host_permissions` ni `activeTab` | 0.0 |
| Solo `activeTab` | 0.3 |
| Dominios específicos (`https://example.com/*`) | 0.5 |
| Wildcards amplios (`*://*.domain.com/*`) | 0.8 |
| `<all_urls>`, `http://*/*`, `https://*/*` | 1.0 |

## Pesos por permiso

| Nivel | Peso | Ejemplos |
|-------|------|---------|
| Crítico | 10 | `tabCapture`, `pageCapture`, `debugger`, `nativeMessaging`, `proxy`, `vpnProvider` |
| Alto | 5 | `cookies`, `scripting`, `webRequest`, `history`, `downloads`, `management`, `desktopCapture` |
| Medio | 2 | `activeTab`, `tabs`, `bookmarks`, `identity`, `alarms`, `dns` |
| Bajo | 1 | `storage`, `notifications`, `idle`, `tts`, `power` |

La clasificación completa de los 69 permisos está en [src/data/permissionWeights.ts](../src/data/permissionWeights.ts).

## Umbrales de interpretación

| Puntaje | Nivel | Color |
|---------|-------|-------|
| 0–5 | Bajo | Azul |
| 6–15 | Moderado | Ámbar |
| 16–30 | Alto | Naranja |
| 31+ | Crítico | Rojo |

## Ejemplo: Happy Dog (`scripting` + `tabs` + `http://*/*` + `https://*/*`)

- `http://*/*` y `https://*/*` → f(H) = 1.0
- `scripting` (S, peso 5) × 1.0 = 5
- `tabs` (E, peso 2) × 1.0 = 2
- `host_permissions` no suman al score (su impacto ya está en f(H))
- **Total = 7 → Moderado**

## Nota sobre host_permissions en la UI

Los `host_permissions` se muestran en la lista de permisos sensibles pero **no se suman al score** — su efecto ya está capturado multiplicando f(H) por los pesos del conjunto S. Se muestran visualmente con el texto legible correspondiente:

- `http://*/*` → **"Todos los sitios web"**
- `https://*.example.com/*` → **"Todos los subdominios de example.com"**
- `https://example.com/*` → **"Accede a: example.com"**
