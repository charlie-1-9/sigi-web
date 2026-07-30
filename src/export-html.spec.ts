import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { setSession, clearSession, renderView } from './testing/render-view';
import { testProviders } from './testing/test-providers';

const OUT_DIR = path.resolve(__dirname, '../w3c-snapshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function snapshot(name: string, url: string) {
	const fixture = await renderView(url);

	// El documento ya tiene su propio <head> (con los <style> que Angular
	// inyecta por componente); solo completamos metadatos básicos ahí en
	// vez de anteponer un segundo <head> por fuera.
	document.title = 'SIGI OTI';

	if(!document.querySelector('meta[charset]')) {
		document.head.insertAdjacentHTML('afterbegin', '<meta charset="utf-8">');
	}

	if(!document.querySelector('meta[name="viewport"]')) {
		document.head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width, initial-scale=1">');
	}

	const fullDocument = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

	fs.writeFileSync(path.join(OUT_DIR, name + '.html'), fullDocument, 'utf-8');

	// destruye el fixture (dispara ngOnDestroy, p.ej. detiene el polling de
	// comentarios en follow-up) para no contaminar el documento compartido
	// de cara al siguiente snapshot.
	fixture.destroy();

	return fullDocument;
}

describe('export de vistas reales para validación W3C', () => {
	beforeEach(() => {
		clearSession();

		// jsdom reutiliza el mismo `document` entre pruebas de este archivo;
		// sin esto, el HTML de una vista quedaba pegado antes del de la
		// siguiente y el validador veía un documento duplicado/mal formado.
		document.head.innerHTML = '';
		document.body.innerHTML = '';
		document.body.removeAttribute('style');

		TestBed.configureTestingModule({
			providers: testProviders
		});
	});

	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('login', async () => {
		const html = await snapshot('login', '/login');
		expect(html).toContain('SIGI');
	});

	it('home (solicitante)', async () => {
		setSession('u-ana', 'Ana Quispe', 'Solicitante');

		const html = await snapshot('home-solicitante', '/');
		expect(html).toContain('Hola');
	});

	it('home (administrador)', async () => {
		setSession('u-rosa', 'Rosa Ttito', 'Administrador OTI');

		const html = await snapshot('home-administrador', '/');
		expect(html).toContain('Hola');
	});

	it('incident insert (solicitante)', async () => {
		setSession('u-ana', 'Ana Quispe', 'Solicitante');

		const html = await snapshot('incident-insert', '/incident/insert');
		expect(html).toContain('Registrar Incidencia');
	});

	it('incident list (solicitante)', async () => {
		setSession('u-ana', 'Ana Quispe', 'Solicitante');

		const html = await snapshot('incident-list-solicitante', '/incident/list');
		expect(html).toContain('Mis Incidencias');
	});

	it('incident list (administrador)', async () => {
		setSession('u-rosa', 'Rosa Ttito', 'Administrador OTI');

		const html = await snapshot('incident-list-administrador', '/incident/list');
		expect(html).toContain('Todas las Incidencias');
	});

	it('incident follow-up con detalle y evidencia (solicitante)', async () => {
		setSession('u-ana', 'Ana Quispe', 'Solicitante');

		const html = await snapshot('incident-follow-up', '/incident/follow-up?code=INC-2026-0001');
		expect(html).toContain('Seguimiento de Incidencia');
		expect(html).toContain('captura-sin-red.svg');
	});
});
