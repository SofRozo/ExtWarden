# ExtWarden

Extensión de Chrome que analiza los permisos de tus extensiones instaladas y te protege en sitios sensibles.

## ¿Qué hace?

- Analiza automáticamente los permisos de cada extensión instalada
- Permite definir sitios sensibles por categoría (bancos, correo, universidad)
- Desactiva temporalmente las demás extensiones cuando visitas un sitio sensible
- Disponible en Español e Inglés
- Todo se procesa localmente — tus datos nunca salen de tu navegador

## ¿Cómo funciona?

1. La extensión lee la lista de extensiones instaladas y sus permisos usando la API de Chrome.
2. Cada extensión recibe un puntaje de riesgo basado en sus permisos y el alcance de sus permisos de host.
3. Cuando navegas a un sitio que marcaste como sensible, ExtWarden desactiva temporalmente las demás extensiones y las restaura al salir.

## Fórmula de riesgo

`R = Σ(Peso × f(H))` para permisos sensibles al host + `Σ(Peso)` para permisos estáticos.

- 69 permisos de Chrome clasificados en 4 niveles de severidad
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

## Cargar en Chrome (modo desarrollador)

1. Abre `chrome://extensions/`
2. Activa "Modo de desarrollador"
3. Clic en "Cargar extensión sin empaquetar"
4. Selecciona la carpeta `extension-ui/dist`

## Comprimir para distribución

Después de `npm run build`, comprime el contenido de `dist/` en un `.zip`.

**Windows (PowerShell):**
```powershell
Compress-Archive -Force -Path dist\* -DestinationPath extwarden.zip
```

**macOS / Linux:**
```bash
cd dist && zip -r ../extwarden.zip . && cd ..
```

El archivo `extwarden.zip` resultante es el que se sube al [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) o se comparte para instalación manual.

> **Instalación manual desde el zip:** extrae el `.zip`, luego sigue los pasos de "Cargar en Chrome" apuntando a la carpeta extraída.

## Stack

- React 18 + TypeScript + Vite 6 + Tailwind CSS
- Chrome Extension Manifest V3
- react-i18next (ES/EN)
- Sin servidor — todo local en el navegador
