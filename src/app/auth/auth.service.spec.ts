import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { testProviders } from '../../testing/test-providers';

// Credenciales de la "base de datos" simulada (mock-db.ts)
const VALID_EMAIL = 'rttito@unamba.edu.pe';
const VALID_PASSWORD = '123456';

describe('AuthService', () => {
	let service: AuthService;
	let router: Router;

	beforeEach(() => {
		localStorage.clear();

		TestBed.configureTestingModule({ providers: testProviders });

		service = TestBed.inject(AuthService);
		router = TestBed.inject(Router);
	});

	afterEach(() => {
		service.logout();
		localStorage.clear();
	});

	it('no debe estar autenticado antes de iniciar sesión', () => {
		expect(service.isAuthenticated()).toBe(false);
		expect(service.getFullName()).toBeNull();
		expect(service.getRole()).toBeNull();
	});

	it('debe autenticar con credenciales válidas y guardar la sesión', async () => {
		const response = await service.login(VALID_EMAIL, VALID_PASSWORD);

		expect(response.type).toBe('success');
		expect(service.isAuthenticated()).toBe(true);
		expect(service.getRole()).toBe('Administrador OTI');
		expect(service.getFullName()).toBe('Rosa Ttito');
		expect(service.getAccessToken()).toBeTruthy();
	});

	it('debe rechazar credenciales inválidas y no guardar sesión', async () => {
		const response = await service.login(VALID_EMAIL, 'clave-incorrecta');

		expect(response.type).toBe('error');
		expect(service.isAuthenticated()).toBe(false);
		expect(service.getAccessToken()).toBeNull();
	});

	it('logout debe limpiar la sesión y redirigir a /login', async () => {
		await service.login(VALID_EMAIL, VALID_PASSWORD);

		expect(service.isAuthenticated()).toBe(true);

		const navigateSpy = vi.spyOn(router, 'navigate');

		service.logout();

		expect(service.isAuthenticated()).toBe(false);
		expect(service.getAccessToken()).toBeNull();
		expect(service.getFullName()).toBeNull();
		expect(navigateSpy).toHaveBeenCalledWith(['/login']);
	});
});
