import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../environments/environments';

/**
 * Cada vez que se hace una petición al backend, primero se renueva el
 * accessToken vía /auth/refresh, reemplazándolo en localStorage. Así la
 * sesión se prolonga 1 minuto más en cada request.
 *
 * Si la renovación falla (el refreshToken también expiró por inactividad),
 * se cierra la sesión y se redirige al login.
 *
 * El backend rota el refreshToken en cada uso (el usado queda inservible).
 * Por eso, cuando una misma pantalla dispara varias peticiones en paralelo
 * (ej. lista de incidencias + catálogos de filtros), todas deben compartir
 * UNA sola renovación en vuelo — si cada petición renovara por su cuenta,
 * solo la primera en llegar al backend canjearía el token válido y las
 * demás usarían un refreshToken ya invalidado, forzando un logout.
 */
let refreshInFlight: Promise<boolean> | null = null;

function getSharedRefresh(authService: AuthService): Promise<boolean> {
	if(!refreshInFlight) {
		refreshInFlight = authService.refreshSession().finally(() => {
			refreshInFlight = null;
		});
	}

	return refreshInFlight;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
	const authService = inject(AuthService);

	const isBackendRequest = req.url.startsWith(environment.urlBase);
	const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');

	if(!isBackendRequest || isAuthEndpoint) {
		return next(req);
	}

	return from(getSharedRefresh(authService)).pipe(
		switchMap((success) => {
			if(!success) {
				authService.logout();

				return throwError(() => new Error('La sesión expiró. Inicie sesión nuevamente.'));
			}

			const token = authService.getAccessToken();

			const authReq = req.clone({
				setHeaders: {
					Authorization: `Bearer ${token}`
				}
			});

			return next(authReq);
		})
	);
};

