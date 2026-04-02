# ExtWarden

Extensión de Chrome que analiza los permisos de tus extensiones instaladas y te protege en sitios sensibles.

## ¿Qué hace?

- Analiza automáticamente los permisos de cada extensión instalada
- Permite definir sitios sensibles por categoría (bancos, correo, universidad)
- Alerta en tiempo real si una extensión riesgosa está activa en un sitio sensible
- Disponible en Español e Inglés
- Todo se procesa localmente — tus datos nunca salen de tu navegador

## ¿Cómo funciona?

1. La extensión lee la lista de extensiones instaladas y sus permisos usando la API de Chrome.
2. Cada extensión recibe un puntaje de riesgo basado en sus permisos, la categoría de la extensión, y el alcance de sus permisos de host.
3. Cuando navegas a un sitio que marcaste como sensible, se te avisa si alguna extensión riesgosa está activa.

## Fórmula de riesgo

`R = Σ(Peso × Factor_Coherencia × f(H))` para permisos sensibles al host + `Σ(Peso × Factor_Coherencia)` para permisos estáticos.

- 76 permisos de Chrome clasificados en 4 niveles de severidad
- 18 categorías de la Chrome Web Store con matrices de coherencia
- Factor de alcance de host: 0.0 (ninguno) → 0.3 (activeTab) → 0.5 (específico) → 0.8 (wildcard) → 1.0 (<all_urls>)

## Interpretación del riesgo

| Puntaje | Nivel |
|---------|-------|
| 0-10    | Bajo  |
| 11-25   | Medio |
| 26-50   | Alto  |
| 51+     | Crítico |

## Desarrollo

```bash
cd extension-ui
npm install
npm run dev     # preview en navegador
npm run build   # genera dist/ para cargar en Chrome
```

## Cargar en Chrome

1. Abre `chrome://extensions/`
2. Activa "Modo de desarrollador"
3. Clic en "Cargar extensión sin empaquetar"
4. Selecciona la carpeta `extension-ui/dist`

## Stack

- React 18 + TypeScript + Vite 6 + Tailwind CSS
- Chrome Extension Manifest V3
- react-i18next (ES/EN)
- Sin servidor — todo local en el navegador
