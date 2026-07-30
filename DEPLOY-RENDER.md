# Desplegar el frontend de SIGI-OTI en Render

Este repo trae `render.yaml` en la raíz: un [Blueprint de Render](https://render.com/docs/infrastructure-as-code)
que despliega este frontend como sitio estático. Pensado para cuando el
frontend vive en su **propio repo**, separado del backend (`sigi-oti-api`)
— si en algún momento decides ver los dos juntos, mira el
`DEPLOY-RENDER.md` del repo de `sigi-oti-api` también.

## 0. Antes de empezar

Despliega primero el backend (repo `sigi-oti-api`, ver su propio
`DEPLOY-RENDER.md`) para tener su URL a mano. También conviene saber que,
en el plan gratis, un sitio estático como este no tiene "spin-down" (los
sitios estáticos de Render siempre están activos), a diferencia del
backend.

## 1. Subir este repo

Sube este proyecto (con `render.yaml` en la raíz) a GitHub o GitLab.

## 2. Crear el Blueprint

1. En el [dashboard de Render](https://dashboard.render.com): **New +** → **Blueprint**.
2. Conecta este repositorio.
3. Render lee `render.yaml` y te muestra el servicio `sigi-web` (sitio
   estático) que va a crear. Revísalo y confirma.

## 3. Verificar la URL del backend (API_URL)

`render.yaml` ya trae `API_URL=https://sigi-oti-api.onrender.com`, que es
la URL que tendría el backend por defecto **si lo desplegaste con el
nombre `sigi-oti-api`** (ver el repo de `sigi-oti-api`). Si Render le
asignó una URL distinta (por ejemplo porque ese nombre ya estaba tomado
en tu cuenta), o si usás un dominio propio para el backend:

- Dashboard → servicio **sigi-web** → Environment → `API_URL` → pon la
  URL real del backend (sin `/` al final) → guardar. Esto dispara un
  rebuild automático, que vuelve a generar `environment.production.ts`
  (ver `scripts/render-set-api-url.mjs`) con la URL correcta.

Después de eso, vuelve al repo del backend y actualiza ahí
`APP_CORS_ALLOWED_ORIGINS` con la URL real de este frontend (dashboard →
servicio `sigi-oti-api` → Environment), o el navegador va a bloquear las
peticiones por CORS aunque el frontend cargue bien.

## 4. (Opcional) Dominio propio

Si quieres seguir usando `sigioti.innovationunamba.tech` en vez del
`*.onrender.com`: Settings → Custom Domain (Render te da el registro DNS
que hay que crear). Si cambias el dominio, actualiza también
`APP_CORS_ALLOWED_ORIGINS` en el backend con ese nuevo dominio.

## Notas técnicas de esta adaptación

- `scripts/render-set-api-url.mjs`: genera
  `src/app/environments/environment.production.ts` a partir de la
  variable de entorno `API_URL` antes del build en Render (Angular
  compila la URL del backend directamente en el bundle — no hay
  "variables de entorno" en tiempo de ejecución en una SPA estática). No
  se usa fuera de Render (ni en `ng build` local ni en el
  Dockerfile/nginx de `docker-compose.yml`).
- Nada de esto afecta al despliegue existente por Docker Compose
  (`docker-compose.yml`, `.env.example`, `docker/nginx.conf`) — quedan
  intactos como alternativa si prefieres tu propio servidor en vez de
  Render.
