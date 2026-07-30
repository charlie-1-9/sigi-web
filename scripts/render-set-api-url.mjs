#!/usr/bin/env node
// Genera src/app/environments/environment.production.ts a partir de la
// variable de entorno API_URL antes del build de producción.
//
// Por qué existe: Angular compila la URL del backend directamente en el
// bundle (no hay "variables de entorno" en tiempo de ejecución en una SPA
// estática) — ver src/app/environments/environment.production.ts y el
// fileReplacements de la configuración "production" en angular.json.
// Sin este script, cambiar de backend implicaría editar código fuente.
// Con esto, alcanza con ajustar API_URL en el dashboard de Render
// (Environment del servicio sigi-web) y volver a desplegar.
//
// Se usa solo desde el buildCommand de render.yaml; no afecta `ng build`
// ni al Dockerfile/nginx (docker-compose.yml) usados fuera de Render.
import { writeFileSync } from 'node:fs';

const apiUrl = process.env.API_URL;

if (!apiUrl) {
	console.error(
		'[render-set-api-url] Falta la variable de entorno API_URL (URL pública ' +
		'del backend en Render, sin "/" al final, ej. https://sigi-oti-api.onrender.com). ' +
		'Configúrala en el dashboard de Render → servicio sigi-web → Environment.'
	);
	process.exit(1);
}

const urlBase = apiUrl.replace(/\/+$/, '');

const content = `// Generado automáticamente por scripts/render-set-api-url.mjs a partir de
// la variable de entorno API_URL — no editar a mano en Render (se
// sobrescribe en cada build). Para desarrollo local, este archivo no se
// usa (ver environments.ts).
export const environment = {
	production: true,
	urlBase: '${urlBase}'
};
`;

writeFileSync('src/app/environments/environment.production.ts', content);

console.log(`[render-set-api-url] environment.production.ts generado con urlBase = ${urlBase}`);
