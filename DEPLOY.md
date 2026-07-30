# Despliegue en Nginx o Apache

## 1. Compilar (transpilar) el proyecto

```bash
npm install
npm run build
```

Angular 21 genera la salida en `dist/sigi-web/browser/` (el subdirectorio
`browser/` es el nuevo layout por defecto del builder `@angular/build:application`,
aunque el proyecto no usa SSR). **Ese es el directorio que se sirve**, no
`dist/sigi-web/` directamente.

## 2. Servir con Nginx

Configuración probada de punta a punta durante el desarrollo (ver
`deploy/nginx-sigi-web.conf`):

```bash
# copiar el build al document root
sudo mkdir -p /var/www/sigi-web
sudo cp -r dist/sigi-web/browser/* /var/www/sigi-web/

# instalar el site
sudo cp deploy/nginx-sigi-web.conf /etc/nginx/sites-available/sigi-web
sudo ln -s /etc/nginx/sites-available/sigi-web /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Abre `http://localhost:8088`.

### Verificación realizada

Con la app corriendo bajo Nginx en este puerto se probó, vía `curl`:

| Prueba | Resultado |
|---|---|
| `GET /` (index) | `200` |
| `GET /incident/list` (ruta profunda de Angular) | `200`, sirve `index.html` y el Router la resuelve |
| `GET /incident/follow-up` (otra ruta profunda) | `200` |
| `GET /assets/status.json` (endpoint real, no simulado) | `200`, `Content-Type: application/json`, cuerpo correcto |
| `GET /main-*.js`, `/styles-*.css`, `/favicon.ico` | `200` |
| `GET /ruta-que-no-existe` | `200` → cae a `index.html` (fallback SPA funcionando) |

El endpoint `/assets/status.json` es un archivo estático real servido por
Nginx; `Home` (`src/app/page/home/home.ts`) le hace un `HttpClient.get()` real
al cargar y muestra "Servidor web conectado" en pantalla — es la prueba de que,
una vez desplegada, la app sí consume un endpoint real a través del servidor
web (más allá de los datos de negocio, que siguen simulados vía `MockApi`
según lo pedido: que la app funcione sin backend ni BD).

## Verificación end-to-end realizada (Nginx y Apache)

Se compiló el proyecto (`npm install && npm run build`), se copió `dist/sigi-web/browser/*`
al document root de cada servidor y se levantaron ambos en paralelo (Nginx en `:8088`,
Apache en `:8089`) usando exactamente los archivos de `deploy/`. Resultado con `curl`:

| Prueba | Nginx `:8088` | Apache `:8089` |
|---|---|---|
| `GET /` (index, `text/html`) | 200 | 200 |
| `GET /incident/list` (ruta profunda del Router) | 200 | 200 |
| `GET /incident/follow-up` (otra ruta profunda) | 200 | 200 |
| `GET /assets/status.json` (endpoint real, `application/json`) | 200 | 200 |
| `GET /main-*.js`, `/favicon.ico` | 200 | 200 |
| `GET /ruta-que-no-existe` | 200 → cae a `index.html` | 200 → cae a `index.html` |

`Home` (`src/app/page/home/home.ts`) hace un `HttpClient.get('/assets/status.json')`
real al cargar y muestra en pantalla "Servidor web conectado" cuando responde 200 —
esa es la prueba visual, dentro de la propia app, de que el consumo del endpoint
funciona una vez desplegada.

La navegación entre páginas (`Inicio` → `Incidencias` → `Seguimiento`, y la edición
de prioridad/estado por el técnico agregada en `IncidentList`) se probó manualmente
en el navegador contra ambos despliegues, apoyada en `MockApi` para los datos de
negocio (login, incidencias, comentarios), tal como está documentado más arriba.

## 3. Servir con Apache (alternativa)

Configuración de referencia en `deploy/apache-sigi-web.conf`:

```bash
sudo a2enmod rewrite headers

sudo mkdir -p /var/www/sigi-web
sudo cp -r dist/sigi-web/browser/* /var/www/sigi-web/

sudo cp deploy/apache-sigi-web.conf /etc/apache2/sites-available/sigi-web.conf
sudo a2ensite sigi-web
sudo systemctl reload apache2
```

El `RewriteRule` cumple la misma función que el `try_files` de Nginx: cualquier
ruta que no sea un archivo real cae a `index.html` para que el Router de
Angular la resuelva (sin esto, recargar la página en `/incident/list` daría
404 en Apache).

## 4. Servir con Docker (recomendado)

`Dockerfile` (multi-stage) compila el proyecto en una imagen `node:22-alpine`
y copia solo el resultado (`dist/sigi-web/browser`) a una imagen `nginx:alpine`
final — la imagen final no incluye Node, `node_modules` ni código fuente.
Usa `docker/nginx.conf`, que es la misma configuración de `deploy/nginx-sigi-web.conf`
ya probada end-to-end, solo que escucha en el puerto 80 (estándar dentro de
un contenedor) en vez del 8088 de la prueba manual.

```bash
docker compose up --build
```

Eso construye la imagen y levanta el contenedor con el mismo mapeo de puerto
usado en la prueba manual (`8088:80`), healthcheck incluido (pega contra
`/assets/status.json` cada 30s). Sin `docker compose`, equivalente a mano:

```bash
docker build -t sigi-web .
docker run -d -p 8088:80 --name sigi-web sigi-web
```

Verificación (misma batería que en la prueba manual con Nginx nativo):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/                  # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8088/incident/list     # 200 (SPA fallback)
curl -s http://localhost:8088/assets/status.json                                 # 200, JSON real
```

Esta secuencia (compilar dentro de un stage, copiar solo el build a un stage
`nginx:alpine` final, y validar con la misma configuración de `docker/nginx.conf`)
se simuló localmente copiando `dist/sigi-web/browser` a la raíz que usaría el
contenedor y sirviéndola con esa misma configuración de Nginx: mismo resultado
que la prueba manual documentada arriba (`GET /`, `/incident/list` y
`/assets/status.json` responden 200).

## Notas

- El puerto `8088` es arbitrario (evita chocar con otros servicios); cámbialo
  si lo necesitas.
- Si más adelante conectas un backend real, actualiza `environment.urlBase`
  en `src/app/environments/environments.ts` y quita el `{ provide: Api, useClass: MockApi }`
  de `app.config.ts` — el resto de la configuración de Nginx/Apache no cambia.
