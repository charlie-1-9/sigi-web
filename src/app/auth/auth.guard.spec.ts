import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService, ACCESS_TOKEN_KEY } from './auth.service';
import { testProviders } from '../../testing/test-providers';

describe('authGuard', () => {
	let router: Router;

	beforeEach(() => {
		localStorage.clear();

		TestBed.configureTestingModule({ providers: testProviders });

		router = TestBed.inject(Router);
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('permite el acceso cuando hay una sesión activa', () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-token');

		const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

		expect(result).toBe(true);
	});

	it('bloquea el acceso y redirige a /login cuando no hay sesión', () => {
		const navigateSpy = vi.spyOn(router, 'navigate');

		const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

		expect(result).toBe(false);
		expect(navigateSpy).toHaveBeenCalledWith(['/login']);
	});

	it('bloquea el acceso si el token fue removido tras un logout', () => {
		localStorage.setItem(ACCESS_TOKEN_KEY, 'mock-token');

		const authService = TestBed.inject(AuthService);

		authService.logout();

		const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));

		expect(result).toBe(false);
	});
});
