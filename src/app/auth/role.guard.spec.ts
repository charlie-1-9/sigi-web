import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { roleGuard } from './role.guard';
import { ACCESS_TOKEN_KEY, ROLE_KEY } from './auth.service';
import { testProviders } from '../../testing/test-providers';

describe('roleGuard', () => {
	let router: Router;

	beforeEach(() => {
		localStorage.clear();

		TestBed.configureTestingModule({ providers: testProviders });

		router = TestBed.inject(Router);
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('permite el acceso cuando el rol del usuario está en la lista permitida', () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-token');
		localStorage.setItem(ROLE_KEY, 'Solicitante');

		const guard = roleGuard(['Solicitante']);
		const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

		expect(result).toBe(true);
	});

	it('bloquea el acceso y redirige a inicio cuando el rol no está permitido', () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-token');
		localStorage.setItem(ROLE_KEY, 'Técnico');

		const navigateSpy = vi.spyOn(router, 'navigate');
		const guard = roleGuard(['Solicitante']);
		const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

		expect(result).toBe(false);
		expect(navigateSpy).toHaveBeenCalledWith(['/']);
	});

	it('bloquea el acceso cuando no hay rol (usuario no autenticado)', () => {
		const guard = roleGuard(['Administrador OTI']);
		const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));

		expect(result).toBe(false);
	});
});
