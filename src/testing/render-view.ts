import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';

import { App } from '../app/app';
import { ID_USER_KEY, FULL_NAME_KEY, ROLE_KEY, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRES_AT_KEY } from '../app/auth/auth.service';

export function setSession(idUser: string, fullName: string, role: string): void {
	localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-access-' + idUser);
	localStorage.setItem(REFRESH_TOKEN_KEY, 'mock-refresh-' + idUser);
	localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + 3600000));
	localStorage.setItem(ID_USER_KEY, idUser);
	localStorage.setItem(FULL_NAME_KEY, fullName);
	localStorage.setItem(ROLE_KEY, role);
}

export function clearSession(): void {
	localStorage.clear();
}

/**
 * Monta la app real (mismas rutas, mismos providers de app.config.ts,
 * incluido el MockApi) y navega a `url` con una sesión ya simulada (o
 * anónima, para /login). Espera a que se resuelvan las llamadas
 * simuladas del MockApi (~300ms de latencia) antes de devolver el
 * fixture, para que el DOM refleje los datos ya cargados.
 */
export async function renderView(url: string): Promise<ComponentFixture<App>> {
	const fixture = TestBed.createComponent(App);
	const router = TestBed.inject(Router);

	// TestBed monta el componente directo, sin pasar por src/index.html real
	// (que sí trae lang="es" y <title>SIGI OTI</title>). Se replican aquí
	// para que las vistas renderizadas en tests reflejen el documento real.
	document.documentElement.setAttribute('lang', 'es');
	document.title = 'SIGI OTI';

	fixture.detectChanges();

	await router.navigateByUrl(url);

	fixture.detectChanges();

	await new Promise((resolve) => setTimeout(resolve, 600));

	return fixture;
}
