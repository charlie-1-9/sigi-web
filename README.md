# SIGI · OTI — Frontend (Angular 21 + PrimeNG 21 + Tailwind 4)

Sistema Integrado de Gestión de Incidencias de la Oficina de Tecnologías de la Información (OTI) — UNAMBA.

Este frontend sigue exactamente la misma arquitectura que tu proyecto de referencia
(`appcwds220261`): cliente API estilo `ng-openapi-gen` (`api/fn/operations/*.ts` +
`api/functions.ts` barrel), `AuthService` con JWT + refresh + cierre de sesión por
inactividad, `authGuard`/`roleGuard`, `authInterceptor` que renueva el token en cada
petición, `OptionMenuService` para resaltar el ítem activo del menú, componentes
standalone sin sufijo `.component.` en el nombre de archivo, y control de cambios
manual (`ChangeDetectorRef.markForCheck()` + `detectChanges()`) porque la app corre
**zoneless** (no se incluye `zone.js`).

## Avances de este entregable

| # | Punto | Dónde está |
|---|---|---|
| 1 | Integración con SonarQube | `sonar-project.properties` + `npm run sonar` ([detalle](#1-integración-con-sonarqube)) |
| 2 | Responsive Web Design consistente | Sidebar → drawer móvil, tablas con scroll horizontal, formularios que colapsan a 1 columna ([detalle](#2-responsive-web-design)) |
| 3 | Validación W3C sin errores propios | `docs/w3c-validation/` ([detalle](#3-validación-w3c)) |
| 4 | Compilar y desplegar en Nginx/Apache | `DEPLOY.md` + `deploy/` ([detalle](#4-despliegue-en-nginx--apache)) |
| 5 | Tests unitarios (Vitest) | `auth.service.spec.ts`, `auth.guard.spec.ts`, `role.guard.spec.ts`, `list.spec.ts` — `npm test` ([detalle](#5-tests-unitarios)) |
| 6 | Dashboard con gráficos en Inicio | `page/home/home.ts` (`p-chart`, doughnut + barras) ([detalle](#6-dashboard-con-gráficos)) |
| 7 | Notificaciones (campanita) | `App` (`app.ts`/`app.html`) + `apinotification*` ([detalle](#7-notificaciones)) |
| 8 | Modo oscuro | `App.toggleDarkMode()` + `darkModeSelector` en `app.config.ts` ([detalle](#8-modo-oscuro)) |
| 9 | Exportar incidencias a Excel/PDF | `page/incident/list/list.ts` (`exportExcel`, `exportPdf`) ([detalle](#9-exportar-a-excel--pdf)) |
| 10 | CI/CD (GitHub Actions) | `.github/workflows/ci.yml` ([detalle](#10-cicd-github-actions)) |
| 11 | Dockerización | `Dockerfile`, `docker-compose.yml`, `docker/nginx.conf` ([detalle](#4-servir-con-docker-recomendado) en `DEPLOY.md`) |
| 12 | Accesibilidad (axe-core) | `src/a11y.spec.ts` — `npm test` ([detalle](#12-accesibilidad-a11y)) |
| 13 | PWA instalable/offline | `ngsw-config.json`, `public/manifest.webmanifest` ([detalle](#13-pwa)) |
| 14 | Reportes/analítica para el Administrador | `page/home/home.ts` + `/report/summary` (backend) ([detalle](#14-reportesanalítica)) |

### 10. CI/CD (GitHub Actions)

`.github/workflows/ci.yml` corre en cada push/PR contra `main`/`master`/
`develop`:

- **`build-and-test`** — siempre: `npm ci`, `npm run build`, `npm run
  test:coverage`, y publica el build (`dist/`) y el reporte de cobertura
  como artefactos descargables del run.
- **`sonar`** — solo si el repo tiene configurados los secrets
  `SONAR_TOKEN` y `SONAR_HOST_URL` (Settings → Secrets and variables →
  Actions); si no están, el job se salta con un aviso en vez de romper el
  pipeline, para que el CI funcione igual sin depender de un servidor
  SonarQube ya levantado.

### 12. Accesibilidad (a11y)

Ver [`docs/a11y/README.md`](docs/a11y/README.md) para el detalle completo:
qué se corre (`axe-core` sobre las mismas 7 vistas reales de la validación
W3C), qué se encontró y corrigió (4 bugs reales: un `<label>` no asociado,
3 botones de solo-ícono sin nombre accesible, gráficos sin `aria-label`), y
cómo complementarlo con Lighthouse en un navegador real para contraste de
color y tamaños de foco (algo que `jsdom`, al no tener motor gráfico, no
puede evaluar).

### 13. PWA

```bash
ng add @angular/pwa
```

Agrega el Service Worker de Angular (`@angular/service-worker`,
registrado en `app.config.ts` vía `provideServiceWorker`) y:

- **`public/manifest.webmanifest`** — personalizado con el nombre, colores
  de marca (`#1E3A5F`, el mismo azul de la topbar) e íconos propios del
  proyecto (ver `public/icons/`, generados a partir de
  `public/icons/source-icon.svg` — un ticket blanco sobre fondo azul
  marino, coherente con el ícono `pi-ticket` que ya usa el logo de la
  topbar) en vez de dejar los genéricos de Angular.
- **`ngsw-config.json`** — configuración por defecto de Angular: cachea el
  shell de la app (JS/CSS/HTML) y assets estáticos, pero **no** define
  `dataGroups`, así que no cachea llamadas a un backend real cuando se
  conecte (nada de servir incidencias desactualizadas por un caché
  agresivo).
- **`favicon.ico`** — regenerado con la misma identidad, en vez del genérico.

Con esto, la app queda instalable desde el navegador ("Instalar app" /
"Agregar a pantalla de inicio") y sigue funcionando offline para
navegación entre páginas ya visitadas (el `MockApi` sigue respondiendo
igual, ya que no depende de red).

**Nota sobre Nginx:** por defecto, Nginx no reconoce la extensión
`.webmanifest` y la sirve como `application/octet-stream`, lo cual
Chrome/Lighthouse marca como advertencia de instalación de PWA (Apache sí
la reconoce out-of-the-box). Se agregó un bloque `location` explícito en
`docker/nginx.conf` y `deploy/nginx-sigi-web.conf` para servirla como
`application/manifest+json` — verificado con `curl -I` contra el build real.

### 14. Reportes/analítica

En "Inicio", el Administrador OTI ve una sección "Reportes" además del
dashboard de gráficos (visible para los tres roles): tiempo promedio de
resolución por categoría y por técnico, carga de trabajo actual por
técnico (abiertas vs. total histórico), e incidencias que superaron el
SLA de su categoría sin resolverse. Los cuatro bloques vienen de
`GET /report/summary` en el backend real (`ReportController` /
`BusinessReport` / `RepositoryReport`, con las 4 consultas de agregación
en SQL — `AVG(TIMESTAMPDIFF(...))`, `TIMESTAMPDIFF(HOUR, createdAt, NOW()) > slaHours`,
etc.), protegido para que solo el rol Administrador OTI pueda verlo (tanto
en el propio endpoint como en el frontend). El `MockApi` implementa el
mismo cálculo en JavaScript sobre los datos simulados
(`mockReportSummary`), así que la vista se ve igual con o sin backend
levantado.

### 5. Tests unitarios

```bash
npm test
```

Corre `ng test` (builder `@angular/build:unit-test`, basado en Vitest). Se agregaron
specs reales (21 tests en total, sumados a los 7 que ya existían para la
validación W3C):

- `auth/auth.service.spec.ts` — login válido/inválido, `isAuthenticated()`,
  `logout()` limpia la sesión y redirige.
- `auth/auth.guard.spec.ts` y `auth/role.guard.spec.ts` — acceso permitido/
  bloqueado según sesión y rol.
- `page/incident/list/list.spec.ts` — el listado solo trae lo que corresponde
  a cada rol, los filtros de búsqueda/estado funcionan, y el técnico puede
  modificar prioridad/estado de una incidencia asignada de punta a punta
  (contra el `MockApi` real, no con mocks manuales de `Api`).

### 6. Dashboard con gráficos

En `Inicio` (`Home`), además de las tarjetas de conteo por estado (solo
Administrador OTI), se agregó una sección "Panorama" visible para los tres
roles con dos gráficos (`p-chart` de PrimeNG sobre `chart.js`):

- **Dona** — incidencias por estado (usa exactamente los estados presentes en
  los datos que ese rol puede ver: un Solicitante ve solo sus incidencias, un
  Técnico solo las suyas).
- **Barras** — distribución por prioridad (Baja/Media/Alta/Crítica).

### 7. Notificaciones

Ícono de campana en la topbar (y en el drawer móvil) con contador de no
leídas. No se creó una tabla de notificaciones nueva: se derivan del mismo
`history` de cada incidencia que ya alimenta el timeline de Seguimiento
(asignación, inicio de atención, resolución, cierre, reapertura, cambios de
prioridad/estado), filtrado a lo que le interesa al usuario autenticado
(dueño de la incidencia, o técnico asignado). Lo único que se persiste aparte
es qué eventos ya se marcaron como leídos (`notificationReads` en
`mock-db.ts`). Endpoints: `apinotificationgetall`, `apinotificationmarkread`,
`apinotificationmarkallread`. Al hacer clic en una notificación, se marca
como leída y navega directo al ticket en Seguimiento.

### 8. Modo oscuro

Botón sol/luna en la topbar y en el drawer móvil. PrimeNG ya trae soporte de
theming oscuro vía `darkModeSelector: '.my-app-dark'` (configurado en
`app.config.ts`); `App.toggleDarkMode()` alterna esa clase en `<html>` y
guarda la preferencia en `localStorage` (si el usuario nunca eligió, se
respeta `prefers-color-scheme` del sistema). Los estilos propios del shell y
de `.page-card`/títulos/textos (que usan colores fijos, no variables de
PrimeNG) tienen sus overrides bajo `.my-app-dark` en `app.css` y `styles.css`.

### 9. Exportar a Excel / PDF

En "Incidencias" (`IncidentList`), dos botones junto al buscador exportan
exactamente lo que está filtrado en pantalla (respetando el filtro de estado
y el texto de búsqueda):

- **Excel** (`xlsx`/SheetJS) — hoja "Incidencias" con las mismas columnas de
  la tabla.
- **PDF** (`jsPDF` + `jspdf-autotable`) — tabla en horizontal con encabezado
  institucional y fecha de generación.

Ambas corren 100% en el navegador (no dependen del `MockApi` ni de un
backend), así que funcionan igual cuando se conecte el backend real.

### 1. Integración con SonarQube

```bash
npm run sonar
```

Lee `sonar-project.properties` (host, project key, exclusiones — se excluyó
`api/fn/**` y la infraestructura genérica del cliente API por ser código
repetitivo/boilerplate, siguiendo el mismo criterio que ya tenía tu proyecto
de referencia). Se probó que el scanner (`@sonar/scan`, el paquete npm oficial
actual de SonarSource) se conecta correctamente al host configurado — solo
falla la conexión porque este entorno no tiene un SonarQube corriendo en
`localhost:9000`. Para completarlo: levanta un SonarQube local

```bash
docker run -d --name sonarqube -p 9000:9000 sonarqube:community
```

entra a `http://localhost:9000` (usuario/clave inicial `admin`/`admin`),
genera un token, reemplázalo en `sonar-project.properties`, y corre
`npm run sonar` de nuevo.

### 2. Responsive Web Design

- Menú lateral fijo → botón hamburguesa + `p-drawer` por debajo de 992px.
- Tablas de incidencias envueltas en scroll horizontal con aviso visible en
  pantallas chicas, en vez de romper el layout.
- Formularios (`Registrar incidencia`, `Seguimiento`) con grillas de 2
  columnas que colapsan a 1 columna en móvil (`grid-cols-1 sm:grid-cols-2`).
- Padding del contenido principal reducido por debajo de 640px.

### 3. Validación W3C

Ver metodología completa y resultado en
[`docs/w3c-validation/README.md`](docs/w3c-validation/README.md). Resumen: se
renderizaron las 7 vistas reales de la app (con datos reales del `MockApi`,
no HTML de relleno) usando el propio Angular vía `TestBed`, y se validaron
con el mismo motor que usa validator.w3.org (`vnu.jar`). Cero errores de
marcado propios del proyecto; lo único que reporta el validador son
atributos internos que Angular (`_nghost-*`/`ng-version`) y PrimeNG
(`autofocus`, roles de tabla) inyectan automáticamente, ajenos a este código.

### 4. Despliegue en Nginx / Apache

Ver [`DEPLOY.md`](DEPLOY.md). Resumen: `npm run build` genera
`dist/sigi-web/browser/`, servido y probado end-to-end en un Nginx real
durante el desarrollo — navegación entre rutas profundas de Angular (con
fallback SPA correcto) y consumo real de un endpoint HTTP
(`/assets/status.json`, mostrado en pantalla como "Servidor web conectado" en
el Home). Config lista para Apache también, en `deploy/apache-sigi-web.conf`.

## Requisitos

- Node.js 20+
- npm 10+

## Instalación

```bash
npm install
```

## Ejecutar en desarrollo

```bash
npm start
```

Abre `http://localhost:4200`. Por defecto apunta a `http://localhost:8080` como
backend (ver `src/app/environments/environments.ts`).

## Compilar para producción

```bash
npm run build
```

## Estructura

```
src/app/
├── api/
│   ├── api.ts                      Helper Api.invoke(fn, params) — genérico
│   ├── api-configuration.ts        rootUrl del backend
│   ├── request-builder.ts          Genérico (igual al de tu proyecto base)
│   ├── strict-http-response.ts     Genérico
│   ├── functions.ts                Barrel export de todas las operaciones
│   └── fn/operations/              Un archivo por endpoint (mismo estilo ng-openapi-gen)
├── auth/
│   ├── auth.service.ts             Login, refresh, logout, timer de inactividad
│   ├── auth.guard.ts               Requiere sesión activa
│   ├── role.guard.ts               Restringe rutas por rol
│   └── auth.interceptor.ts         Renueva el accessToken en cada petición
├── observable/option-menu/         Estado del ítem de menú activo (Subject/Observable)
├── environments/environments.ts    urlBase del backend
└── page/
    ├── auth/login/                 Inicio de sesión
    ├── home/                       Landing con accesos rápidos + resumen (admin)
    └── incident/
        ├── insert/                 CU-01 Registrar incidencia (Solicitante)
        ├── list/                   CU-05 Consultar + CU-02 Asignar inline (Administrador)
        └── follow-up/              Detalle por código de ticket: CU-03 Atender,
                                     CU-04 Cerrar/Reabrir, comentarios (con polling
                                     cada 5s) e historial de estados
```

## Endpoints esperados en el backend

| Función                     | Método | Ruta                                  |
|------------------------------|--------|----------------------------------------|
| `apiauthlogin`               | POST   | `/auth/login`                          |
| `apiauthrefresh`              | POST   | `/auth/refresh`                        |
| `apiauthlogout`               | POST   | `/auth/logout`                         |
| `apiincidentinsert`           | POST   | `/incident/insert` (multipart)         |
| `apiincidentgetall`           | GET    | `/incident/getall`                     |
| `apiincidentgetbycode`        | GET    | `/incident/getbycode/{code}`           |
| `apiincidentassign`           | POST   | `/incident/assign`                     |
| `apiincidentupdate`           | POST   | `/incident/update`                     |
| `apiincidentstart`            | POST   | `/incident/start`                      |
| `apiincidentresolve`          | POST   | `/incident/resolve`                    |
| `apiincidentclose`            | POST   | `/incident/close`                      |
| `apiincidentreopen`           | POST   | `/incident/reopen`                     |
| `apiincidentcommentinsert`    | POST   | `/incidentcomment/insert`              |
| `apiincidentcommentgetall`    | GET    | `/incidentcomment/getall/{idIncident}` |
| `apicategorygetall`           | GET    | `/category/getall`                     |
| `apiprioritygetall`           | GET    | `/priority/getall`                     |
| `apitechniciangetall`         | GET    | `/technician/getall`                   |
| `apinotificationgetall`       | GET    | `/notification/getall`                 |
| `apinotificationmarkread`     | POST   | `/notification/markread`               |
| `apinotificationmarkallread`  | POST   | `/notification/markallread`            |
| `apireportsummary`            | GET    | `/report/summary`                      |

Los nombres de campo (`idIncident`, `idCategory`, `idPriority`, `idStatus`, `title`,
`description`, `solution`, etc.) coinciden con tu `dbotiunamba_v2.sql` real.

## Backend real

Ya conectado: `sigi-oti-api` (Spring Boot + MariaDB, repo aparte) implementa
todos los endpoints de la tabla anterior sobre la base de datos
`dbotiunamba`. `environment.urlBase` (`http://localhost:8080`) y
`app.config.ts` ya apuntan ahí — el provider de `MockApi` se quitó de la
app real y solo lo siguen usando los tests (`src/testing/test-providers.ts`),
que necesitan poder correr sin depender de un backend levantado. Ver el
`README.md` de `sigi-oti-api` para setup, contrato de cada endpoint, y los
gaps documentados entre el mock original y la base de datos real (p.ej.
`tcategory` sin columna `slaHours`).

## Nota sobre el cliente API

Los archivos de `api/fn/operations/` están escritos a mano **replicando exactamente**
el formato que genera `ng-openapi-gen`, incluyendo el detalle de que devuelven
`StrictHttpResponse<void>` (mismo comportamiento que ya tenías en `apicomplaintgetall`
y compañía). Cuando el backend real declare su spec OpenAPI, puedes:

1. Ejecutar `ng-openapi-gen` directamente contra el `openapi.json` del backend para
   regenerar `api/fn/operations/*.ts` con los tipos de respuesta reales, o
2. Mantener estos archivos a mano y solo ajustar el tipo de retorno donde haga falta.

En ambos casos, el resto del código (páginas, servicios) no cambia: sigue llamando
`this.api.invoke(apiIncidentGetAll)` igual que ahora.
