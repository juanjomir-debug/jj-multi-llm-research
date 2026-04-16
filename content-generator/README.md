# Content Generator - ReliableAI

Generación de contenido para blog y redes sociales usando ReliableAI.

## Archivos

- `article-full.json` - Último artículo generado (formato completo con metadata)
- `twitter-thread-*.json` - Thread de Twitter generado del artículo
- `twitter-thread-*.txt` - Thread en formato texto plano
- `generate-og-image.js` - Genera Open Graph images con DALL-E
- `create-og-image.html` - Herramienta visual para crear OG images

## Flujo de trabajo

### 1. Generar artículo
Usar ReliableAI con el prompt de investigación:
```
What is going to be the net effect of AI in employment, taking in account the latest data, insights and trends.
```

Configuración recomendada:
- Modelos: Claude Opus, GPT-5, Gemini Pro, Grok, Qwen Max
- Web Search: Activado
- Integrador: Claude Opus
- Debate: Opcional

### 2. Exportar artículo
El artículo se guarda automáticamente en `article-full.json` con:
- Contenido markdown
- Metadata (modelos usados, tokens, coste)
- Prompt original
- Fecha de creación

### 3. Generar imagen hero
```bash
node generate-og-image.js
```

Esto extrae el prompt de `[HERO_IMAGE: ...]` del artículo y genera la imagen con DALL-E.

### 4. Generar thread de Twitter
El thread se genera automáticamente del artículo y se guarda en formato JSON y TXT.

### 5. Publicar
- Blog: Ver `../blog-automation/`
- Twitter: Ver `../social-bots/twitter-bot/`

## Formato del artículo

```markdown
[HERO_IMAGE: descripción de la imagen para DALL-E]

# Título del artículo

*Subtítulo o descripción corta*

Contenido del artículo en markdown...

## Sección 1
...

[CONSENSUS_CHART] - placeholder para gráfico de consenso

---

**Methodology**: ...
**Models consulted**: ...
**Date**: ...
```
