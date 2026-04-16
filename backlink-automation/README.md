# Backlink Automation

Scripts para automatizar el registro en directorios y obtención de backlinks.

## Proyectos

### ReliableAI
Directorios completados ✅:
- aitoolsdirectory.com
- aitools.inc
- aivalley.ai
- toolify.ai

Pendiente:
- theresanaiforthat.com (requiere pago manual)

### Resistone (microcemento.org)
**Estado:** Script creado pero requiere mejoras

**Problema:** Los formularios tienen cookie banners y JS dinámico que bloquean el relleno automático.

**Directorios objetivo:**
- Habitissimo
- Houzz
- Certicalia
- Páginas Amarillas
- Yelp
- Europages
- Infobel
- Pinterest

**Datos para formularios manuales:**
```
Nombre: Resistone Microcemento
Web: https://www.microcemento.org
Email: info@resistone.es
Teléfono: 917528727
Dirección: C/ Carabaña, 32-3, Alcorcón, 28925 Madrid
CIF: B85123040
Descripción: Fabricantes de microcemento desde 2008. 
Especialistas en microcemento para suelos, paredes, baños y cocinas. 
Aplicadores propios en Madrid.
```

## Scripts principales

- `bot-engine.js` - Motor principal del bot
- `business-data.js` - Datos de los negocios
- `vision-analyzer.js` - Análisis de formularios con visión AI
- `test-vision.js` - Test del analizador de visión
- `email-verifier.js` - Verificación de emails
- `authorize-gmail.js` - Autorización Gmail API

## Herramientas

- **Playwright** - Instalado en VPS en `/root/scripts/`
- **Gmail API** - Para verificación de emails
- **Vision AI** - Para analizar formularios complejos

## Capturas

La carpeta `screenshots/` contiene capturas de inspección de formularios.

## Documentación

- `README.md` - Documentación general
- `SETUP-GMAIL-API.md` - Configuración de Gmail API
- `FINAL-STATUS.md` - Estado final de las inscripciones
- `METODO-FINAL.md` - Metodología utilizada
- `DATOS-PENDIENTES.md` - Datos que faltan por completar

## Próximos pasos

1. Mejorar script para aceptar cookies automáticamente
2. Manejar JS dinámico en formularios
3. Completar inscripciones de Resistone
4. Expandir a más directorios
