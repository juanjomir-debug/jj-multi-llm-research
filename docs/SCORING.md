# Cálculo de Confidence % y Hallucination Risk

## Resumen

Cada respuesta de modelo muestra dos métricas:
- **Confidence %** — probabilidad estimada de que la respuesta sea correcta y fiable
- **Hallucination** — nivel de riesgo de alucinación (Low / Med / High)

Ambas se calculan en el **frontend** (`index.html`) combinando hasta 3 señales.

---

## Señal 1 — Autoevaluación del modelo (`selfScore`)

El servidor inyecta esta instrucción al final del system prompt de cada modelo (`server.js`, `CONFIDENCE_INSTRUCTION`):

```
Al finalizar tu respuesta, añade en la ÚLTIMA línea un bloque JSON invisible:
<!--SELF_SCORE:{"confidence":N,"uncertainAreas":["area1","area2"]}-->
Donde N es un número 0-100 indicando tu confianza general en la respuesta.
```

El servidor extrae ese JSON con regex antes de enviar el texto al frontend, y lo pasa como campo `selfScore` en el evento `model:done`. Si el modelo no lo incluye o el JSON es inválido, `selfScore` queda como `null`.

**Peso en el score final:** 35% (con consenso) / 60% (sin consenso)

---

## Señal 2 — Análisis léxico heurístico (`analyzeResponseScore`)

Calculado en el frontend analizando el texto de la respuesta con tres listas de palabras:

| Lista | Palabras | Efecto |
|---|---|---|
| `HEDGE_WORDS` | might, could, possibly, may, perhaps, unclear, approximately, probablemente, parece… | Reduce confianza |
| `STRONG_WORDS` | definitively, clearly, confirmed, research shows, is proven, está demostrado… | Aumenta confianza |
| `DISCLAIMER_WORDS` | I don't know, may be incorrect, verify, fact-check, no estoy seguro, verifica… | Reduce confianza fuertemente |

**Fórmula:**
```
hedgeRatio  = nº de hedge words / nº total de palabras
confidence  = clamp(20..98,  85 - hedgeRatio×800 + min(strongs/words, 0.02)×500 - disclaimers×10)
hallucRisk  = hedgeRatio×1000 + disclaimers×5
hallucClass = hallucRisk < 15 → "low" | < 40 → "med" | ≥ 40 → "high"
```

**Peso en el score final:** 25% (con consenso) / 40% (sin consenso)

---

## Señal 3 — Acuerdo entre modelos (`agreementScore`)

Calculado en el **servidor** (`computeConsensus`) tras recibir todas las respuestas. Usa similitud Jaccard de palabras largas (>3 caracteres):

```
similarity(A, B) = |palabras(A) ∩ palabras(B)| / |palabras(A) ∪ palabras(B)|
```

Se calcula la matriz de similitud por pares, y el `agreementScore` de cada modelo es su similitud media con los demás modelos, expresada en %. Se envía al frontend como evento SSE `consensus`.

| agreementScore | Significado |
|---|---|
| ≥ 50% | El modelo está alineado con los demás |
| 25–49% | Divergencia moderada |
| < 25% | Outlier — diverge significativamente del resto |

**Peso en el score final:** 40% (solo disponible cuando hay ≥ 2 modelos activos)

---

## Score final combinado (`computeFinalScore`)

### Con ≥ 2 modelos activos (hay consenso disponible):
```
confidence = round( agreement×0.40 + selfConf×0.35 + heuristic×0.25 )
```

### Con 1 solo modelo activo (sin consenso):
```
confidence = round( selfConf×0.60 + heuristic×0.40 )
```

Siempre se aplica clamp final: `confidence = clamp(15..97, confidence)`

### Clasificación del resultado:

| Confidence | Badge |
|---|---|
| ≥ 70% | 🟢 High (verde) |
| 45–69% | 🟡 Med (naranja) |
| < 45% | 🔴 Low (rojo) |

---

## Hallucination final

Cuando hay consenso, el acuerdo entre modelos tiene prioridad sobre el análisis léxico:

| agreementScore | Hallucination |
|---|---|
| < 25% | High (outlier — el modelo dice algo muy diferente a los demás) |
| 25–49% | Med |
| ≥ 50% | Low (o Med si el análisis léxico indicaba High) |

Sin consenso (1 modelo): se usa directamente `hallucClass` del análisis léxico.

---

## Limitaciones conocidas

- El análisis léxico es superficial: mide palabras de cobertura, no razonamiento
- Un modelo muy seguro pero equivocado puede obtener Confidence alta
- La similitud Jaccard es sensible al idioma y al estilo de escritura, no a la veracidad
- `selfScore` es la autoevaluación del propio modelo — puede estar sesgada o simplemente ignorarse
- Con 1 solo modelo activo no hay consenso, por lo que la métrica es menos fiable
