import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideApiConfiguration } from './api/api-configuration';
import { environment } from './environments/environments';
import { providePrimeNG } from 'primeng/config';
import { authInterceptor } from './auth/auth.interceptor';

import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideServiceWorker } from '@angular/service-worker';

// Preset institucional OTI: azul pizarra como primario (mismo tono usado
// en el resto de la documentación del proyecto), coherente con la marca.
// La escala completa (50-950) se deriva del mismo tono navy en vez de
// mezclar 'sky' (un azul distinto) con los tonos oscuros a mano — eso
// generaba un salto de matiz notorio entre botones/focus claros y oscuros.
const OtiPreset = definePreset(Aura, {
	semantic: {
		primary: {
			50: '#eef3f8',
			100: '#d6e2ed',
			200: '#adc5db',
			300: '#84a8c9',
			400: '#4c7398',
			500: '#1E3A5F',
			600: '#1a3454',
			700: '#152a45',
			800: '#112036',
			900: '#0d1827',
			950: '#080f19'
		}
	}
});

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes),
		provideHttpClient(withInterceptors([authInterceptor])),
		provideApiConfiguration(environment.urlBase),
		providePrimeNG({
			theme: {
				preset: OtiPreset,
				options: {
					darkModeSelector: '.my-app-dark'
				}
			}
		}),
		// Backend real: Api (src/app/api/api.ts) hace peticiones HTTP de
		// verdad contra environment.urlBase (sigi-oti-api, Spring Boot).
		// Antes de tener backend, esto se resolvía con `{ provide: Api,
		// useClass: MockApi }`; ver git history si hace falta volver al modo
		// simulado para una demo sin backend levantado.
		MessageService,
		ConfirmationService, provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          })
	]
};
