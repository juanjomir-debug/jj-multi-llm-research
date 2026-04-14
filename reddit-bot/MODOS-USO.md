# Modos de Uso — Reddit Bot

El bot tiene 2 modos de operación:

## 🏗️ Modo KARMA (Construcción de reputación)

**Objetivo**: Construir karma y reputación sin mencionar tu producto.

**Configuración**:
```bash
# .env
REDDIT_MODE=karma
```

**Comportamiento**:
- ✅ Comenta en posts relevantes
- ✅ Aporta valor real y conocimiento
- ❌ NO menciona ReliableAI
- ❌ NO incluye links
- ✅ Respuestas técnicas y útiles

**Ejemplo de respuesta**:
```
When comparing different LLMs, I usually look at a few key factors:

1. Response quality and accuracy
2. Speed and latency
3. Context window size
4. Cost per token

For your use case, I'd recommend testing with both Claude and GPT-4 
to see which gives better results. Each has strengths in different areas.
```

**Duración recomendada**: 1-2 semanas (hasta alcanzar 50-100 karma)

---

## 🚀 Modo PROMOTE (Promoción sutil)

**Objetivo**: Mencionar tu producto de forma natural cuando es relevante.

**Configuración**:
```bash
# .env
REDDIT_MODE=promote
```

**Comportamiento**:
- ✅ Comenta en posts relevantes
- ✅ Aporta valor real
- ✅ Menciona ReliableAI si es relevante
- ✅ Incluye link de forma natural
- ⚠️ Solo en ~30% de comentarios

**Ejemplo de respuesta**:
```
When comparing different LLMs, I usually look at a few key factors:

1. Response quality and accuracy
2. Speed and latency
3. Context window size

I've been using ReliableAI to compare responses side by side, which 
makes it easier to see the differences. You can run the same prompt 
through Claude, GPT, and Gemini simultaneously.

For your specific use case, I'd test with both Claude and GPT-4.
```

**Duración**: Indefinida (después de construir karma)

---

## 📊 Estrategia recomendada

### Semana 1-2: Modo KARMA
```bash
REDDIT_MODE=karma
```
- Max 5 comentarios/día
- Solo aportar valor
- Construir reputación
- Objetivo: 50-100 karma

### Semana 3+: Modo PROMOTE
```bash
REDDIT_MODE=promote
```
- Max 5 comentarios/día
- Mencionar producto cuando sea relevante
- Mantener ratio 70% útil / 30% promocional
- Objetivo: 10-15 backlinks/mes

---

## 🔄 Cambiar de modo

Simplemente edita `.env`:

```bash
# Para construcción de karma
REDDIT_MODE=karma

# Para promoción
REDDIT_MODE=promote
```

Y vuelve a ejecutar:
```bash
node reddit-bot/reddit-playwright.js
```

---

## 📈 Métricas por modo

### Modo KARMA
| Métrica | Semana 1 | Semana 2 |
|---|---|---|
| Comentarios | 35 | 35 |
| Karma ganado | +30-50 | +50-80 |
| Backlinks | 0 | 0 |
| Riesgo de ban | Muy bajo | Muy bajo |

### Modo PROMOTE
| Métrica | Mes 1 | Mes 2 | Mes 3 |
|---|---|---|---|
| Comentarios | 150 | 150 | 150 |
| Karma ganado | +100 | +150 | +200 |
| Backlinks | 5-10 | 15-20 | 25-30 |
| Riesgo de ban | Bajo | Bajo | Bajo |

---

## ⚠️ Reglas importantes

### En modo KARMA:
- ✅ Responde preguntas técnicas
- ✅ Comparte experiencia personal
- ✅ Aporta valor real
- ❌ NO menciones productos
- ❌ NO incluyas links

### En modo PROMOTE:
- ✅ Menciona producto solo si es relevante
- ✅ Mantén tono conversacional
- ✅ Aporta valor primero, link después
- ❌ NO hagas spam
- ❌ NO repitas el mismo mensaje

---

## 🎯 Cuándo cambiar de modo

**Cambiar a PROMOTE cuando**:
- ✅ Tienes 50+ karma
- ✅ Cuenta tiene 2+ semanas
- ✅ Has comentado en 20+ posts
- ✅ No has recibido downvotes masivos

**Volver a KARMA si**:
- ❌ Recibes downvotes consistentes
- ❌ Moderadores te advierten
- ❌ Comentarios son eliminados
- ❌ Karma está bajando

---

## 💡 Tips

1. **Empieza siempre en modo KARMA** (1-2 semanas)
2. **Monitorea karma diariamente** (debe subir, no bajar)
3. **Lee las respuestas generadas** antes de publicar
4. **Ajusta keywords** si no encuentras posts relevantes
5. **Varía los subreddits** para diversificar

---

## ✅ Checklist de implementación

**Fase 1: Construcción (Semanas 1-2)**
- [ ] Configurar `REDDIT_MODE=karma`
- [ ] Ejecutar bot 1-2 veces/día
- [ ] Alcanzar 50+ karma
- [ ] Verificar que no hay downvotes

**Fase 2: Promoción (Semana 3+)**
- [ ] Cambiar a `REDDIT_MODE=promote`
- [ ] Ejecutar bot 2-3 veces/día
- [ ] Monitorear backlinks generados
- [ ] Ajustar frecuencia según resultados

---

## 🎉 Resultado esperado

**Después de 1 mes**:
- 150+ karma
- 10-15 backlinks DA 91
- 200-400 visitantes
- Cuenta establecida y confiable

**ROI**: Infinito (inversión $0, retorno alto)
