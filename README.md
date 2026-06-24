# Scraper OEFA / TFA (TypeScript)

Scraper en **TypeScript** que navega el buscador del Registro de Infracciones y Sanciones
del OEFA, extrae los datos de cada documento y descarga los PDFs asociados, manejando
correctamente el _rate limiting_ (errores **429**).

> **Sitio objetivo (desarrollo):** https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml
>
> El sitio está construido con **JSF / PrimeFaces**, por lo que la navegación no es HTML
> estático: requiere mantener una sesión (`JSESSIONID`), reenviar el `ViewState` en cada
> petición y parsear respuestas AJAX parciales (`<partial-response>`). El detalle del flujo
> está documentado en [`docs/recon.md`](docs/recon.md).

## Requisitos

- Node.js >= 18 (probado con v22)
- npm

## Instalación

```bash
npm install
```

## Uso

```bash
# Ejecutar el scraper completo
npm run scrape

# Reintentar solo las descargas que fallaron en una corrida anterior
npm run retry
```

> Los datos extraídos se guardan en `output/` y los PDFs en `pdfs/`
> (ambas carpetas están ignoradas por git).

## Estado del proyecto

Este repositorio se desarrolla por fases. Estado actual: **setup inicial**.

- [x] Reconocimiento del flujo HTTP del sitio (ver `docs/recon.md`)
- [x] Andamiaje del proyecto (TypeScript, scripts, estructura)
- [ ] Cliente HTTP con sesión + extracción de `ViewState`
- [ ] Búsqueda y parseo de resultados (`partial-response`)
- [ ] Paginación completa
- [ ] Persistencia de datos (JSON) con checkpoint reanudable
- [ ] Descarga de PDFs con backoff exponencial para 429
- [ ] Reintento de descargas fallidas

## Licencia

MIT
