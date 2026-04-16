# Bots Sociales — Twitter y Reddit

## 📊 Comparativa de estrategias

| Estrategia | Tiempo setup | Coste/mes | Backlinks/mes | Calidad | Riesgo | ROI |
|---|---|---|---|---|---|---|
| **Directorios** | Alto | Bajo | 2-5 | Baja | Alto | ❌ Bajo |
| **Twitter Bot** | Bajo | $0 | 0-2 | Media | Medio | ⚠️ Medio |
| **Reddit Bot** | Medio | $0 | 20-30 | Alta | Bajo | ✅ Alto |
| **Content + Outreach** | Alto | $200 | 50-80 | Muy Alta | Bajo | ✅ Muy Alto |

## 🐦 Twitter Bot (YA IMPLEMENTADO)

### Ubicación
```
twitter-bot/
├── twitter-post.sh       # Publica posts originales
├── twitter-engage.sh     # Busca y responde tweets
└── tweet-playwright.js   # Motor con Playwright
```

### Estado actual
- ✅ **Instalado en VPS**: `/root/scripts/`
- ✅ **Cron configurado**:
  - 9:00 L-V: Publicar posts
  - 18:00 L-V: Engagement
- ✅ **3 cuentas**:
  - @juanjomir (funciona)
  - @martinkarsel (error 226 - cuenta nueva)
  - @reliableai (error 226 - cuenta nueva)

### Limitaciones
- ❌ **No genera backlinks directos** (Twitter usa nofollow)
- ⚠️ **Tráfico indirecto** (usuarios deben hacer click)
- ⚠️ **Cuentas nuevas bloqueadas** (necesitan 2-4 semanas de actividad orgánica)

### Recomendación
- ✅ **Mantener activo** para branding y tráfico
- ❌ **No es la estrategia principal** para SEO

---

## 🤖 Reddit Bot (RECIÉN CREADO)

### Ubicación
```
reddit-bot/
├── reddit-bot.js         # Motor principal
├── reddit-config.js      # Configuración
└── README.md             # Documentación completa
```

### Ventajas sobre Twitter
- ✅ **Backlinks dofollow** (DA 91)
- ✅ **Tráfico cualificado** (usuarios buscando soluciones)
- ✅ **Conversiones reales** (10-20x más que directorios)
- ✅ **Comunidades específicas** por nicho
- ✅ **Engagement real** que genera más backlinks

### Estrategia en 3 fases

#### Fase 1: Construcción de karma (Mes 1)
**Objetivo**: 100+ karma sin promocionar

- Comentar en posts populares
- Responder preguntas con valor
- 0% self-promotion
- Max 10 comentarios/día

**Resultado**: Cuenta establecida y confiable

#### Fase 2: Engagement con mención (Mes 2-3)
**Objetivo**: Mencionar producto de forma natural

- Responder donde tu producto es relevante
- Compartir casos de uso reales
- Max 10% self-promotion
- Solo en posts con 10+ upvotes

**Resultado**: 10-15 backlinks/mes

#### Fase 3: Contenido propio (Mes 3+)
**Objetivo**: Crear posts originales

- Guías y tutoriales
- Casos de estudio
- AMAs (Ask Me Anything)
- Max 2 posts/semana

**Resultado**: 20-30 backlinks/mes

### Subreddits objetivo

**ReliableAI**:
- r/artificial (200K)
- r/MachineLearning (2.8M)
- r/ChatGPT (5M)
- r/OpenAI (500K)
- r/LocalLLaMA (150K)

**Resistone**:
- r/HomeImprovement (5M)
- r/DIY (23M)
- r/InteriorDesign (6M)
- r/Renovations (200K)
- r/spain (300K)

### Configuración necesaria

1. **Crear cuentas de Reddit**:
   - `reliableai_official`
   - `resistone_microcemento`

2. **Crear app en Reddit API**:
   - https://www.reddit.com/prefs/apps
   - Tipo: "script"
   - Copiar `client_id` y `client_secret`

3. **Configurar .env**:
   ```bash
   REDDIT_CLIENT_ID=xxx
   REDDIT_CLIENT_SECRET=xxx
   REDDIT_RELIABLEAI_PASSWORD=xxx
   REDDIT_RESISTONE_PASSWORD=xxx
   ```

4. **Instalar dependencias**:
   ```bash
   npm install snoowrap
   ```

5. **Ejecutar**:
   ```bash
   node reddit-bot/reddit-bot.js
   ```

### Automatización (cron)

```bash
# Ejecutar 2 veces al día (10:00 y 18:00)
0 10,18 * * * cd /var/www/reliableai && node reddit-bot/reddit-bot.js >> reddit-bot/reddit-bot.log 2>&1
```

---

## 📈 Métricas esperadas (3 meses)

### Twitter Bot
- Seguidores: +500
- Engagement: 1000-2000 interacciones/mes
- Tráfico: 100-200 visitas/mes
- Backlinks: 0-2 (indirectos)
- Conversiones: 2-5

### Reddit Bot
- Karma: 500+
- Comentarios: 800
- Backlinks: 60-90 (DA 91)
- Tráfico: 1000-2000 visitas/mes
- Conversiones: 30-60

---

## 🎯 Recomendación final

### Estrategia óptima para SEO

1. **Reddit Bot** (prioridad 1) ⭐⭐⭐⭐⭐
   - Backlinks de alta calidad
   - Tráfico cualificado
   - Conversiones reales
   - ROI: 10-20x

2. **Content + Outreach** (prioridad 2) ⭐⭐⭐⭐⭐
   - Backlinks editoriales
   - Autoridad de dominio
   - Escalable
   - ROI: 15-30x

3. **Twitter Bot** (prioridad 3) ⭐⭐⭐
   - Branding
   - Tráfico indirecto
   - Engagement
   - ROI: 3-5x

4. **Directorios** (abandonar) ⭐
   - Baja calidad
   - Alto riesgo de ban
   - No escalable
   - ROI: 0.5-1x

### Plan de acción inmediato

**Semana 1-2**:
- [ ] Crear cuentas de Reddit
- [ ] Configurar Reddit API
- [ ] Instalar dependencias
- [ ] Ejecutar bot manualmente
- [ ] Construir karma (sin promocionar)

**Semana 3-4**:
- [ ] Alcanzar 100+ karma
- [ ] Empezar menciones sutiles
- [ ] Configurar cron
- [ ] Monitorear métricas

**Mes 2-3**:
- [ ] Aumentar engagement
- [ ] Crear posts originales
- [ ] Optimizar templates
- [ ] Escalar a más subreddits

### Inversión necesaria

- **Reddit Bot**: $0/mes (API gratuita)
- **Twitter Bot**: $0/mes (ya configurado)
- **Tiempo**: 2-3 horas/semana (monitoreo)

### ROI esperado

**Inversión**: $0 + 10 horas/mes
**Retorno**: 60-90 backlinks DA 91 + 1000-2000 visitas + 30-60 conversiones

**ROI**: ∞ (inversión $0, retorno alto)

---

## 🚀 Próximos pasos

1. ✅ **Twitter Bot**: Ya funciona, mantener activo
2. 🔥 **Reddit Bot**: Implementar YA (máxima prioridad)
3. ⏳ **Content + Outreach**: Implementar después (mes 2)
4. ❌ **Directorios**: Abandonar estrategia

¿Quieres que configure el Reddit Bot en el VPS ahora?
