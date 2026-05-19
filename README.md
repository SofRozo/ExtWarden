# ExtWarden

Extensión de Chrome que evalúa el riesgo de las extensiones instaladas mediante dos niveles de análisis: una puntuación local instantánea basada en permisos, y un análisis profundo de código fuente con IA a través del backend Extension Warden.

## Funcionalidades

- **Auditoría de extensiones** — puntuación de riesgo local + análisis profundo con AST y LLM opcional
- **Zonas de contexto** — deshabilita automáticamente otras extensiones al entrar a sitios sensibles (banca, correo, gobierno)
- **Vigilancia de actualizaciones** — detecta cuando una extensión actualiza sus permisos y la deshabilita hasta revisión
- **Popup** — resumen rápido de extensiones activas y estado de protección

## Análisis profundo (backend requerido)

Requiere el backend Extension Warden corriendo en `http://localhost:3000`. Ver [backend-extension-warden/README.md](../backend-extension-warden/README.md).

## Desarrollo

```bash
npm install
npm run dev     # preview en navegador
npm run build   # genera dist/ para cargar en Chrome
```

**Cargar en Chrome:** `chrome://extensions/` → modo desarrollador → "Cargar sin empaquetar" → carpeta `dist/`.

## Documentación

Ver [docs/](docs/) para documentación técnica completa:

- [Arquitectura](docs/architecture.md) — módulos, flujo de datos, almacenamiento
- [Engine de riesgo local](docs/risk-engine.md) — fórmula, pesos, factor de alcance
- [Análisis profundo](docs/deep-analysis.md) — flujo completo y resultado mostrado al usuario
- [Zonas de contexto](docs/context-zones.md) — protección automática por dominio
- [Service worker](docs/service-worker.md) — lógica de fondo y eventos

## Stack

- React 18 + TypeScript + Vite 6 + Tailwind CSS
- Chrome Extension Manifest V3
- react-i18next (ES / EN)
