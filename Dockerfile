# ─── Etapa 1: build ──────────────────────────────────────────────────────
# Compila el proyecto Angular. Esta etapa no forma parte de la imagen final:
# solo se usa para producir dist/sigi-web/browser.
FROM node:22-alpine AS build

WORKDIR /app

# Copiar solo los manifiestos primero para aprovechar el cache de capas de
# Docker: si package*.json no cambian, "npm ci" no se vuelve a ejecutar en
# builds sucesivos aunque cambie el código fuente.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Etapa 2: runtime ────────────────────────────────────────────────────
# Imagen final: solo Nginx + los archivos estáticos ya compilados.
# No incluye Node, node_modules ni código fuente (~30MB vs +1GB de la
# etapa de build).
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/sigi-web/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/assets/status.json > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
