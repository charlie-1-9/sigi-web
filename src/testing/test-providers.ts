import { appConfig } from '../app/app.config';
import { Api } from '../app/api/api';
import { MockApi } from '../app/api/mock/mock-api.service';

/**
 * Los mismos providers que usa la app en producción (app.config.ts), pero
 * sobrescribiendo `Api` con `MockApi`: los tests deben poder correr en CI
 * sin depender de un backend real levantado en localhost:8080. La app en
 * sí ya NO usa este override (ver app.config.ts) — solo los tests.
 */
export const testProviders = [
	...appConfig.providers,
	{ provide: Api, useClass: MockApi },
];
