// Traduce los estados técnicos (tstatus.name, lenguaje ITIL) al lenguaje
// que un Solicitante sin conocimiento técnico entiende de un vistazo.
// Técnicos y administradores siguen viendo el término original — esto
// solo se usa donde el rol actual es 'Solicitante'.
//
// Cada estado tiene texto + explicación breve, nunca solo un color (ver
// punto de accesibilidad: no depender del color para transmitir estado).
export interface FriendlyStatus {
	label: string;
	explanation: string;
	icon: string;
}

export const FRIENDLY_STATUS: Record<string, FriendlyStatus> = {
	'Nueva': { label: 'Recibimos tu solicitud', explanation: 'Está en la fila para ser asignada a un técnico.', icon: 'pi-inbox' },
	'Pendiente': { label: 'Esperando información', explanation: 'Necesitamos algún dato más para continuar.', icon: 'pi-clock' },
	'Asignada': { label: 'Técnico asignado', explanation: 'Un técnico fue asignado y pronto comenzará.', icon: 'pi-user' },
	'En Proceso': { label: 'El técnico está trabajando', explanation: 'Tu problema se está atendiendo ahora mismo.', icon: 'pi-wrench' },
	'Resuelta': { label: 'Solución propuesta', explanation: 'Confírmanos si el problema realmente quedó resuelto.', icon: 'pi-check-circle' },
	'Cerrada': { label: 'Confirmaste la solución', explanation: 'Diste por resuelto este problema.', icon: 'pi-verified' },
	'Cancelada': { label: 'Cancelada', explanation: 'Esta solicitud fue cancelada.', icon: 'pi-times-circle' },
	'Reabierta': { label: 'El problema continúa', explanation: 'Volvimos a abrirla porque persistía.', icon: 'pi-refresh' }
};

export function friendlyStatus(rawStatus: string): FriendlyStatus {
	return FRIENDLY_STATUS[rawStatus] || { label: rawStatus, explanation: '', icon: 'pi-circle-fill' };
}
