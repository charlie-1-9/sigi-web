import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from '../api/api';
import { apiauthlogin, apiauthrefresh, apiauthlogout } from '../api/functions';

export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const EXPIRES_AT_KEY = 'expiresAt';
export const FULL_NAME_KEY = 'fullName';
export const ROLE_KEY = 'role';
export const ID_USER_KEY = 'idUser';

// 15 minutos sin actividad → logout automático
const INACTIVITY_LIMIT_MS = 900000;

@Injectable({ providedIn: 'root' })
export class AuthService {
	private router = inject(Router);
	private inactivityTimer: any = null;
	private boundReset = () => this.resetInactivityTimer();

	constructor(
		private api: Api
	) {}

	async login(email: string, password: string): Promise<any> {
		const response: any = await this.api.invoke(apiauthlogin, { body: { email, password } });
		const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

		if(apiResponseData.type == 'success') {
			this.setSession(apiResponseData);
			this.startSessionTimer();
		}

		return apiResponseData;
	}

	/**
	 * Inicia el timer de inactividad. Llamar al login y al recargar
	 * la app si ya había sesión activa.
	 */
	startSessionTimer(): void {
		['click', 'keydown', 'mousemove', 'touchstart'].forEach(event => {
			window.removeEventListener(event, this.boundReset);
			window.addEventListener(event, this.boundReset, { passive: true });
		});

		this.resetInactivityTimer();
	}

	private resetInactivityTimer(): void {
		if(this.inactivityTimer) {
			clearTimeout(this.inactivityTimer);
		}

		if(this.router.url.startsWith('/login')) return;

		this.inactivityTimer = setTimeout(() => {
			this.logout();
		}, INACTIVITY_LIMIT_MS);
	}

	async refreshSession(): Promise<boolean> {
		const refreshToken = this.getRefreshToken();

		if(!refreshToken) {
			return false;
		}

		try {
			const response: any = await this.api.invoke(apiauthrefresh, { body: { refreshToken } });
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.setSession(apiResponseData);

				return true;
			}

			return false;
		} catch(error) {
			return false;
		}
	}

	setSession(data: any): void {
		localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
		localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
		localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + (data.expiresIn * 1000)));

		if(data.idUser) {
			localStorage.setItem(ID_USER_KEY, data.idUser);
		}

		if(data.fullName) {
			localStorage.setItem(FULL_NAME_KEY, data.fullName);
		}

		if(data.role) {
			localStorage.setItem(ROLE_KEY, data.role);
		}
	}

	logout(): void {
		if(this.inactivityTimer) {
			clearTimeout(this.inactivityTimer);
		}

		['click', 'keydown', 'mousemove', 'touchstart'].forEach(event => {
			window.removeEventListener(event, this.boundReset);
		});

		const refreshToken = this.getRefreshToken();

		// Revoca el refresh token en el backend (trefreshtoken.revoked = true)
		// para que ya no sirva para renovar sesión aunque alguien lo capture.
		// "Best-effort": no se espera la respuesta ni se bloquea el logout si
		// la red falla — limpiar la sesión local y navegar a /login debe
		// pasar siempre, tenga o no éxito la llamada al backend.
		if(refreshToken) {
			this.api.invoke(apiauthlogout, { body: { refreshToken } }).catch(() => { /* best-effort */ });
		}

		localStorage.removeItem(ACCESS_TOKEN_KEY);
		localStorage.removeItem(REFRESH_TOKEN_KEY);
		localStorage.removeItem(EXPIRES_AT_KEY);
		localStorage.removeItem(ID_USER_KEY);
		localStorage.removeItem(FULL_NAME_KEY);
		localStorage.removeItem(ROLE_KEY);

		this.router.navigate(['/login']);
	}

	getAccessToken(): string | null {
		return localStorage.getItem(ACCESS_TOKEN_KEY);
	}

	getRefreshToken(): string | null {
		return localStorage.getItem(REFRESH_TOKEN_KEY);
	}

	getIdUser(): string | null {
		return localStorage.getItem(ID_USER_KEY);
	}

	getFullName(): string | null {
		return localStorage.getItem(FULL_NAME_KEY);
	}

	/**
	 * Rol del usuario autenticado: 'Administrador OTI' | 'Técnico' | 'Solicitante'
	 */
	getRole(): string | null {
		return localStorage.getItem(ROLE_KEY);
	}

	isAuthenticated(): boolean {
		return !!this.getAccessToken();
	}
}
