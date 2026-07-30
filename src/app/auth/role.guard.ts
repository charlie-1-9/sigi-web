import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Restringe el acceso a una ruta según el rol del usuario autenticado.
 * Uso: canActivate: [roleGuard(['Solicitante'])]
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
	return () => {
		const authService = inject(AuthService);
		const router = inject(Router);

		if(allowedRoles.includes(authService.getRole() || '')) {
			return true;
		}

		router.navigate(['/']);

		return false;
	};
}
