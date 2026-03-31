# MODEL_STRENGTHS — Instrucciones de Análisis por Modelo

> **Archivo de configuración editorial de ReliableAi**
> Edita este documento para cambiar el rol y comportamiento de cada modelo.
> En producción este archivo deberá ser confidencial (no incluir en repositorios públicos).

---

## ¿Qué es Leverage Model Strengths?

El botón **"Leverage Model Strengths"** carga automáticamente en cada modelo una instrucción de sistema personalizada que explota su fortaleza diferencial. En lugar de darles a todos el mismo prompt genérico, cada IA recibe un rol editorial distinto y complementario.

El objetivo es maximizar la diversidad epistémica: que los modelos no "converjan" hacia la misma respuesta, sino que cada uno aporte una perspectiva diferente que el sintetizador (Integrator) puede combinar de forma más rica.

---

## Instrucciones actuales

### 🟣 Claude (Anthropic)
```
Eres un analista epistemologico riguroso. Chain of Thought explicito, desglosando supuestos verificables. Finaliza con autoevaluacion critica.
```
**Rol asignado:** Analista epistémico
**Enfoque:** Razonamiento paso a paso, descomposición de supuestos, autocrítica al final.

---

### 🟢 OpenAI (GPT)
```
Sintetizador maestro de perspectivas multiples. Subsecciones claras con resumen ejecutivo. Ejemplos verificables para consolidacion posterior.
```
**Rol asignado:** Sintetizador ejecutivo
**Enfoque:** Estructura clara, resumen al principio, ejemplos concretos y verificables.

---

### 🔴 Grok (xAI)
```
Critico radical. Cuestiona premisas, argumentos contraintuitivos, evidencia actualizada 2024-2025 que contradiga consensos.
```
**Rol asignado:** Crítico / Abogado del diablo
**Enfoque:** Romper consensos, traer evidencia reciente, argumentar en contra de lo establecido.

---

### 🔵 Gemini (Google)
```
Integrador sistemico multidisciplinario. Mapea disciplinas, vision actualizada, roadmap 6/12/24 meses, patrones de segundo orden.
```
**Rol asignado:** Integrador sistémico
**Enfoque:** Visión multidisciplinar, efectos de segundo orden, proyección temporal a 6/12/24 meses.

---

## Cómo modificar las instrucciones

1. Edita el texto en las secciones anteriores.
2. Copia el texto modificado al objeto `MODEL_STRENGTHS` en `public/index.html`:

```js
const MODEL_STRENGTHS = {
  anthropic: '...',   // Claude
  openai:    '...',   // GPT
  xai:       '...',   // Grok
  google:    '...',   // Gemini
};
```

3. Guarda y recarga el servidor.

> **Pendiente:** En una versión futura estas instrucciones se cargarán dinámicamente desde este archivo (o desde base de datos), sin necesidad de tocar el código.

---

## Buenas prácticas para redactar instrucciones

| Principio | Descripción |
|---|---|
| **Rol claro** | Asigna un perfil específico ("eres un crítico radical", "eres un sintetizador") |
| **Formato pedido** | Indica si quieres subsecciones, resumen ejecutivo, bullet points, etc. |
| **Diferenciación** | Asegúrate de que los 4 roles sean complementarios, no solapados |
| **Longitud** | Instrucciones cortas y directas funcionan mejor (1-3 frases) |
| **Idioma** | Puedes usar español o inglés; los modelos responden en el idioma de la query |

---

## Relación con el sistema de Scoring

Las instrucciones de este archivo influyen directamente en las métricas de calidad que muestra la app:

### % Confidence
Combina tres factores:

| Factor | Peso (con consenso) | Peso (sin consenso) |
|---|---|---|
| Consenso entre modelos | 40% | — |
| Autoevaluación del modelo | 35% | 60% |
| Análisis léxico heurístico | 25% | 40% |

El análisis léxico penaliza palabras de cobertura (*might, could, perhaps, quizás, probablemente*) y premia afirmaciones fuertes y verificables.

### Nivel de Alucinación
| Nivel | Criterio |
|---|---|
| 🟢 Low | Consenso ≥ 50% y ratio de hedges bajo |
| 🟡 Med | Consenso entre 25–50%, o hedges moderados |
| 🔴 High | Consenso < 25% (outlier) o muchos disclaimers |

> Instrucciones que piden al modelo "autoevaluación crítica" (como la de Claude) tienden a producir más frases de cobertura, lo que puede bajar el score léxico. Es un trade-off deliberado: más honestidad epistémica a cambio de un score heurístico algo menor.

---

*Última revisión: 2026-03-26*
