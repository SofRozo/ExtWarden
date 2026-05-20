# Análisis Profundo

El análisis profundo envía la extensión al backend Extension Warden para auditar su código fuente real con AST, taint analysis y un módulo LLM explicativo basado en evidencia. El resultado reemplaza la puntuación de permisos con un veredicto basado en lo que el código **efectivamente hace**.

## Flujo completo

```
Usuario abre el drawer de una extensión
    │
    └─ Clic en "Analizar en profundidad"
           │
           ▼
ExtensionAudit.tsx
    chrome.runtime.sendMessage({ action: 'reanalyzeExtension', extensionId })
           │
           ▼
service-worker.ts — submitToBackend()
    POST http://localhost:3000/analyze
    { extensionId }
    ← { jobId, status: "queued" }
           │
           └─ chrome.alarms.create(SANDBOX_POLL_ALARM, { periodInMinutes: 0.5 })
                  │
                  ▼ [cada 30 segundos]
           pollSandboxJobs()
    GET http://localhost:3000/status/{jobId}
    ← { status: "downloading" | "preprocessing" | "ai_analysis" | ... }
           │
           └─ Cuando status === "completed":
                  GET http://localhost:3000/report/{jobId}
                  ← SandboxReport (JSON completo)
                  → normalizeReport() — deriva riskLevel
                  → chrome.storage.local.set({ sandboxReports })
                  → chrome.notifications.create() — avisa al usuario
                  │
                  ▼
           useSandboxData() detecta cambio en storage
           → re-render del drawer con el reporte
```

**Tiempo estimado:** 2–10 minutos según la complejidad de la extensión.

**Fallos y reintentos:** si el backend devuelve error, el job registra `failureCount`. Tras 3 fallos consecutivos se marca como `failed` y se muestra mensaje de error en el drawer.

## Lo que el usuario ve: los 4 bloques del drawer

### Bloque 1 — Riesgo por permisos declarados

Siempre visible, calculado localmente sin el backend.

- Badge de nivel: **Bajo / Moderado / Alto / Crítico**
- Contadores de permisos por gravedad (Críticos / Elevados / Bajos)
- Lista de permisos sensibles con texto legible
- Subtítulo: *"Calculado localmente según los privilegios que la extensión solicita — declarar un permiso no significa usarlo mal."*

### Bloque 2 — Veredicto del análisis de código

Aparece solo cuando el análisis profundo completó.

- Badge combinado: **Veredicto · Nivel de riesgo**
  - Veredicto: `Benigna` / `Sospechosa` / `Maliciosa`
  - Nivel: `Bajo` / `Medio` / `Alto` / `Crítico`
- Subtítulo: *"El módulo LLM explicativo analizó el código real y evaluó si la extensión usa esas capacidades de forma legítima o sospechosa."*

Debajo del bloque 2, si hay datos disponibles:

**Propósito detectado** — una oración del módulo LLM describiendo qué hace la extensión.

**Dominios detectados** — dominios encontrados en el código o en `host_permissions`, agrupados por categoría sensible (Financiero, Identidad, Redes sociales, IA/LLM, Gubernamental, Desconocido).

**Permisos declarados pero no usados** — permisos en el manifest que el análisis estático no detectó en el código. Una actualización futura podría activarlos sin que Chrome avise al usuario.

### Bloque 3 — Explicación del módulo LLM

Texto narrativo generado por el módulo LLM explicativo:
- Párrafo de 4–8 oraciones explicando el comportamiento de la extensión en lenguaje cotidiano, cruzando los hallazgos con el propósito declarado
- Recomendación directa al usuario (desinstalar / mantener con precaución / segura)

### Bloque 4 — Preguntas frecuentes

10 preguntas respondidas por el módulo LLM explicativo con `Sí` / `Posible` / `No detectado` y una razón en texto que explica el porqué — sin color de alarma, la razón hace el trabajo explicativo.

| Pregunta |
|----------|
| ¿Puede capturar contraseñas? |
| ¿Puede registrar lo que escribes? |
| ¿Puede espiarte sin que lo sepas? |
| ¿Puede leer formularios y contraseñas? |
| ¿Puede modificar páginas web? |
| ¿Puede interceptar tu tráfico de red? |
| ¿Puede ver las páginas que visitas? |
| ¿Puede ver tu historial de navegación? |
| ¿Tiene código oculto o sospechoso? |
| ¿Puede afectar otras extensiones? |

**Importante:** "Sí" significa que la capacidad existe en el código — no necesariamente que sea maliciosa. La razón generada por el módulo LLM explica si esa capacidad es esperada para el propósito declarado o va más allá de él.

### Bloque adicional — Señales por categoría (colapsado)

Detalle técnico expandible: las 13 categorías de riesgo evaluadas por el backend con estado (`no_detectado` / `capacidad` / `sospechoso` / `crítico`), evidencias textuales y referencias al código fuente (archivo y línea).

## Estructura del reporte del backend (SandboxReport)

```typescript
{
  jobId: string,
  crxHash: string,
  cwsCategory: string | null,         // categoría en Chrome Web Store

  agente1: {
    veredicto_global: 'maliciosa' | 'sospechosa' | 'benigna',
    nivel_riesgo_inicial: 'bajo' | 'medio' | 'alto' | 'critico',
    proposito: string,                 // una oración
    explicacion: string,               // párrafo + recomendación
    respuestas_usuario: {
      [pregunta]: { valor: 'si' | 'posible' | 'no_detectado', razon: string }
    },
    ranSuccessfully: boolean,
  },

  veredicto_usuario: {
    veredicto: 'maliciosa' | 'sospechosa' | 'benigna',
    nivel: 'critico' | 'alto' | 'medio' | 'bajo',
  },

  resumen_usuario: UserRiskSummaryItem[],   // 13 categorías evaluadas

  estructura: {
    resultado1: VerdictedStaticFinding[],        // hallazgos estáticos
    resultado2_priority: VerdictedDomainFinding[], // dominios sensibles
    resultado2_unknown: VerdictedDomainFinding[], // dominios desconocidos
  },

  permisos_no_usados: PermisNoUsado[],

  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE',  // derivado en frontend
}
```
