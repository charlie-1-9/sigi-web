import { Injectable } from '@angular/core';
import {
	apiauthlogin, apiauthrefresh, apiauthlogout,
	apiincidentinsert, apiincidentgetall, apiincidentgetbycode,
	apiincidentassign, apiincidentupdate, apiincidentstart, apiincidentresolve, apiincidentclose, apiincidentreopen,
	apiincidentcommentinsert, apiincidentcommentgetall,
	apicategorygetall, apiprioritygetall, apitechniciangetall,
	apinotificationgetall, apinotificationmarkread, apinotificationmarkallread,
	apicontactgetall, apicontactsendmessage,
	apireportsummary,
} from '../functions';
import {
	mockAuthLogin, mockAuthRefresh, mockAuthLogout,
	mockIncidentInsert, mockIncidentGetAll, mockIncidentGetByCode,
	mockIncidentAssign, mockIncidentUpdate, mockIncidentStart, mockIncidentResolve, mockIncidentClose, mockIncidentReopen,
	mockIncidentCommentInsert, mockIncidentCommentGetAll,
	mockCategoryGetAll, mockPriorityGetAll, mockTechnicianGetAll,
	mockNotificationGetAll, mockNotificationMarkRead, mockNotificationMarkAllRead,
	mockContactGetAll, mockContactSendMessage,
	mockReportSummary,
} from './mock-handlers';

// Pequeña latencia simulada para que los indicadores de carga (spinners,
// botones en loading) se noten, como con un backend real.
const LATENCY_MS = 300;

const HANDLERS = new Map<Function, (params?: any) => Promise<any>>([
	[apiauthlogin, mockAuthLogin],
	[apiauthrefresh, mockAuthRefresh],
	[apiauthlogout, mockAuthLogout],
	[apiincidentinsert, mockIncidentInsert],
	[apiincidentgetall, mockIncidentGetAll],
	[apiincidentgetbycode, mockIncidentGetByCode],
	[apiincidentassign, mockIncidentAssign],
	[apiincidentupdate, mockIncidentUpdate],
	[apiincidentstart, mockIncidentStart],
	[apiincidentresolve, mockIncidentResolve],
	[apiincidentclose, mockIncidentClose],
	[apiincidentreopen, mockIncidentReopen],
	[apiincidentcommentinsert, mockIncidentCommentInsert],
	[apiincidentcommentgetall, mockIncidentCommentGetAll],
	[apicategorygetall, mockCategoryGetAll],
	[apiprioritygetall, mockPriorityGetAll],
	[apitechniciangetall, mockTechnicianGetAll],
	[apinotificationgetall, mockNotificationGetAll],
	[apinotificationmarkread, mockNotificationMarkRead],
	[apinotificationmarkallread, mockNotificationMarkAllRead],
	[apicontactgetall, mockContactGetAll],
	[apicontactsendmessage, mockContactSendMessage],
	[apireportsummary, mockReportSummary],
]);

/**
 * Reemplaza a `Api` (src/app/api/api.ts) mientras no exista un backend real.
 * Expone el mismo método `invoke(fn, params)` que usan todas las páginas, pero
 * en vez de hacer una petición HTTP, resuelve contra `mock-handlers.ts` y una
 * "base de datos" en localStorage (`mock-db.ts`).
 *
 * Para conectar el backend real más adelante: quitar el `useClass: MockApi`
 * de `app.config.ts` y la app volverá a usar `Api` (HttpClient real) sin
 * tocar ninguna página.
 */
@Injectable({ providedIn: 'root' })
export class MockApi {
	rootUrl = '';

	invoke<P, R>(fn: (...args: any[]) => any, params?: P, context?: any): Promise<R> {
		const handler = HANDLERS.get(fn);

		if(!handler) {
			return Promise.reject(new Error('Endpoint no simulado: ' + (fn as any)?.PATH));
		}

		return new Promise((resolve) => {
			setTimeout(() => resolve(handler(params)), LATENCY_MS);
		}) as Promise<R>;
	}

	invoke$Response<P, R>(fn: (...args: any[]) => any, params?: P, context?: any): Promise<{ body: R }> {
		return this.invoke<P, R>(fn, params, context).then((body) => ({ body }));
	}
}
