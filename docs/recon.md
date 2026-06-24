# Reconocimiento del flujo HTTP — OEFA / TFA

> Notas de la fase de exploración (DevTools → Network). El objetivo es entender
> cómo navega el sitio **antes** de escribir el scraper, y dejar registradas las
> peticiones clave para poder reproducirlas con `axios`.
>
> Sitio: https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml

## Resumen del flujo

```
GET inicial  ──►  extraer JSESSIONID + ViewState
     │
     ▼
POST búsqueda (PrimeFaces AJAX)  ──►  respuesta <partial-response> (XML)
     │                                   ├─ <update> con el HTML de la tabla
     │                                   └─ <update> con el ViewState NUEVO
     ▼
POST paginación (loop por páginas)  ──►  mismo formato partial-response
     │
     ▼
Descarga del PDF de cada fila  ──►  manejar 429 (backoff exponencial)
```

## 1. Tecnología del sitio

- [x] Construido con **JSF / PrimeFaces** (confirmado: el HTML referencia `PrimeFaces.ab(...)`).
- [x] La sesión se mantiene con cookie **`JSESSIONID`** (`Path=/repdig/`, `Secure`, `HttpOnly`).
- [x] El formulario es `listarDetalleInfraccionRAAForm` (POST a `consultaTfa.xhtml`).

## 2. GET inicial

- URL: `https://publico.oefa.gob.pe/repdig/consulta/consultaTfa.xhtml`
- Respuesta entrega `Set-Cookie: JSESSIONID=...` → **conservar en todas las peticiones**.
- El `ViewState` viene en un input hidden:
  `<input ... name="javax.faces.ViewState" id="j_id1:javax.faces.ViewState:0" value="...">`
  → cambia en cada respuesta; hay que extraerlo siempre.

**Campos del formulario detectados:**

| id / name | tipo | significado (a confirmar) |
|-----------|------|---------------------------|
| `listarDetalleInfraccionRAAForm:txtNroexp` | text | N° de expediente |
| `listarDetalleInfraccionRAAForm:idsector` | select | sector |
| `listarDetalleInfraccionRAAForm:btnBuscar` | button | dispara la búsqueda (AJAX) |
| `listarDetalleInfraccionRAAForm:dt` | datatable | tabla de resultados |
| `listarDetalleInfraccionRAAForm:dt_paginator_bottom` | — | paginador |

## 3. POST de búsqueda  ⬅️ PENDIENTE (pegar cURL real)

> Hacer una búsqueda en el navegador, clic en la petición POST en Network → "Copy as cURL".

```bash
# TODO: pegar aquí el "Copy as cURL" del POST de búsqueda
```

**Parámetros del payload (anotar todos):**

```
javax.faces.partial.ajax: true
javax.faces.source: listarDetalleInfraccionRAAForm:btnBuscar
javax.faces.partial.execute: ...
javax.faces.partial.render: ...
listarDetalleInfraccionRAAForm: listarDetalleInfraccionRAAForm
listarDetalleInfraccionRAAForm:txtNroexp: ...
listarDetalleInfraccionRAAForm:idsector: ...
javax.faces.ViewState: ...
```

**Formato de la respuesta:** `<partial-response>` (XML). La tabla viene dentro de un
`<update>` envuelto en `<![CDATA[ ... ]]>`, y el ViewState nuevo en otro `<update>`.

## 4. POST de paginación  ⬅️ PENDIENTE (pegar cURL real)

> Clic en "página 2" del paginador, capturar el POST. Anotar qué cambia respecto a la búsqueda.

```bash
# TODO: pegar aquí el cURL del POST de paginación
```

- ¿Parámetro que controla la página? (ej. `..._first`, `..._rows`) → __________
- Total de resultados / páginas observados: __________

## 5. Descarga del PDF  ⬅️ PENDIENTE (pegar cURL real)

> Clic en el enlace de descarga de una fila. Capturar la petición.

```bash
# TODO: pegar aquí el cURL de la descarga del PDF
```

- Método: `GET` / `POST` → __________
- ¿URL directa o requiere ViewState/sesión? → __________
- `Content-Type` de la respuesta: __________
- `Content-Disposition` (nombre de archivo): __________

## 6. Rate limiting (429)

> Descargar varios PDFs seguidos y observar si aparece status 429.

- ¿Se reproduce el 429? → __________
- ¿Cada cuántas descargas aprox.? → __________
- ¿La respuesta trae header `Retry-After`? → __________

## Capturas

> Pegar aquí 2-3 capturas de DevTools (payload del POST, respuesta partial-response, el 429).
