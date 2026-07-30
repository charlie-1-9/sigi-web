import { loadMockDb, saveMockDb, newId, nowIso, MockDb } from './mock-db';
import { ID_USER_KEY } from '../../auth/auth.service';

function currentUser(db: MockDb) {
	const idUser = localStorage.getItem(ID_USER_KEY);
	return db.users.find(u => u.idUser === idUser) || null;
}

function fullName(db: MockDb, idUser: string | null): string {
	if(!idUser) return '';
	return db.users.find(u => u.idUser === idUser)?.fullName || '';
}

function toListItem(db: MockDb, i: MockDb['incidents'][number]) {
	return {
		idIncident: i.idIncident,
		ticketCode: i.ticketCode,
		title: i.title,
		description: i.description,
		location: i.location,
		solution: i.solution,
		category: db.categories.find(c => c.idCategory === i.idCategory)?.name || '',
		idCategory: i.idCategory,
		priority: db.priorities.find(p => p.idPriority === i.idPriority)?.name || '',
		idPriority: i.idPriority,
		status: i.status,
		idUser: i.idUser,
		idTechnician: i.idTechnician,
		requesterFullName: fullName(db, i.idUser),
		technicianFullName: i.idTechnician ? fullName(db, i.idTechnician) : '',
		createdAt: i.createdAt,
	};
}

function pushHistory(db: MockDb, idIncident: string, idUser: string, action: string, prev: string | null, next: string, observation?: string) {
	db.history.push({ idHistory: newId(), idIncident, idUser, action, previousValue: prev, newValue: next, observation, createdAt: nowIso() });
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export function mockAuthLogin(params: any): Promise<any> {
	const db = loadMockDb();
	const { email, password } = params?.body || {};
	const user = db.users.find(u => u.email === email && u.password === password);

	if(!user) {
		return Promise.resolve({ type: 'error', listMessage: ['Correo o contraseña incorrectos.'] });
	}

	return Promise.resolve({
		type: 'success',
		accessToken: 'mock-access-' + user.idUser,
		refreshToken: 'mock-refresh-' + user.idUser,
		expiresIn: 3600,
		idUser: user.idUser,
		fullName: user.fullName,
		role: user.role,
	});
}

export function mockAuthRefresh(params: any): Promise<any> {
	const db = loadMockDb();
	const refreshToken: string = params?.body?.refreshToken || '';
	const idUser = refreshToken.replace('mock-refresh-', '');
	const user = db.users.find(u => u.idUser === idUser);

	if(!user) {
		return Promise.resolve({ type: 'error', listMessage: ['Sesión expirada.'] });
	}

	return Promise.resolve({
		type: 'success',
		accessToken: 'mock-access-' + user.idUser,
		refreshToken: 'mock-refresh-' + user.idUser,
		expiresIn: 3600,
		idUser: user.idUser,
		fullName: user.fullName,
		role: user.role,
	});
}

// El mock no lleva estado de revocación de tokens (eso es exclusivo del
// backend real, ver trefreshtoken); acá basta con responder success
// siempre, igual que hace el backend cuando el token ya no existe o no
// se mandó ninguno — logout es idempotente por diseño.
export function mockAuthLogout(): Promise<any> {
	return Promise.resolve({ type: 'success' });
}

// ─── Incident ───────────────────────────────────────────────────────────────

export function mockIncidentInsert(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	const body = params?.body || {};
	const ticketCode = `INC-2026-${String(db.nextTicket).padStart(4, '0')}`;
	const idIncident = newId();

	db.incidents.unshift({
		idIncident, ticketCode, idUser: user.idUser, idTechnician: null,
		idCategory: body.idCategory, idPriority: body.idPriority,
		status: 'Nueva', title: body.title, description: body.description,
		location: body.location || '', solution: '', createdAt: nowIso(),
		assignedAt: null, startedAt: null, resolvedAt: null, closedAt: null,
	});

	pushHistory(db, idIncident, user.idUser, 'Creación', null, 'Nueva');

	const attachments: any[] = body.attachments || [];

	for(const a of attachments) {
		db.files.push({
			idIncidentFile: newId(), idIncident,
			fileName: a.fileName, mimeType: a.mimeType, dataUrl: a.dataUrl,
			createdAt: nowIso(),
		});
	}

	db.nextTicket++;
	saveMockDb(db);

	return Promise.resolve({ type: 'success', ticketCode, listMessage: [`Incidencia registrada con el código ${ticketCode}.`] });
}

export function mockIncidentGetAll(): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	let list = db.incidents;

	if(user.role === 'Solicitante') list = list.filter(i => i.idUser === user.idUser);
	if(user.role === 'Técnico') list = list.filter(i => i.idTechnician === user.idUser);

	list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

	return Promise.resolve({ type: 'success', listIncident: list.map(i => toListItem(db, i)) });
}

export function mockIncidentGetByCode(params: any): Promise<any> {
	const db = loadMockDb();
	const code = params?.code;
	const incident = db.incidents.find(i => i.ticketCode === code);

	if(!incident) {
		return Promise.resolve({ type: 'error', listMessage: ['No se encontró una incidencia con ese código.'] });
	}

	const listHistory = db.history
		.filter(h => h.idIncident === incident.idIncident)
		.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

	const listFile = db.files
		.filter(f => f.idIncident === incident.idIncident)
		.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

	return Promise.resolve({ type: 'success', ...toListItem(db, incident), listHistory, listFile });
}

export function mockIncidentAssign(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const { idIncident, idTechnician } = params?.body || {};
	const incident = db.incidents.find(i => i.idIncident === idIncident);

	if(!incident || !user) return Promise.resolve({ type: 'error', listMessage: ['No se pudo asignar la incidencia.'] });

	incident.idTechnician = idTechnician;
	incident.status = 'Asignada';
	incident.assignedAt = nowIso();

	pushHistory(db, idIncident, user.idUser, 'Asignación', 'Nueva', 'Asignada');
	saveMockDb(db);

	return Promise.resolve({ type: 'success', listMessage: ['Incidencia asignada correctamente.'] });
}

export function mockIncidentUpdate(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const { idIncident, idPriority, status } = params?.body || {};
	const incident = db.incidents.find(i => i.idIncident === idIncident);

	if(!incident || !user) return Promise.resolve({ type: 'error', listMessage: ['No se pudo actualizar la incidencia.'] });

	if(user.role === 'Técnico' && incident.idTechnician !== user.idUser) {
		return Promise.resolve({ type: 'error', listMessage: ['Solo el técnico asignado puede modificar esta incidencia.'] });
	}

	if(idPriority && idPriority !== incident.idPriority) {
		const prevPriorityName = db.priorities.find(p => p.idPriority === incident.idPriority)?.name || '';
		const nextPriorityName = db.priorities.find(p => p.idPriority === idPriority)?.name || '';

		incident.idPriority = idPriority;

		pushHistory(db, idIncident, user.idUser, 'Cambio de prioridad', prevPriorityName, nextPriorityName);
	}

	if(status && status !== incident.status) {
		pushHistory(db, idIncident, user.idUser, 'Cambio de estado', incident.status, status);

		incident.status = status;
	}

	saveMockDb(db);

	return Promise.resolve({ type: 'success', listMessage: ['Incidencia actualizada correctamente.'] });
}

export function mockIncidentStart(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const { idIncident } = params?.body || {};
	const incident = db.incidents.find(i => i.idIncident === idIncident);

	if(!incident || !user) return Promise.resolve({ type: 'error', listMessage: ['No se pudo iniciar la atención.'] });

	incident.status = 'En Proceso';
	incident.startedAt = nowIso();

	pushHistory(db, idIncident, user.idUser, 'Inicio de atención', 'Asignada', 'En Proceso');
	saveMockDb(db);

	return Promise.resolve({ type: 'success' });
}

export function mockIncidentResolve(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const { idIncident, solution } = params?.body || {};
	const incident = db.incidents.find(i => i.idIncident === idIncident);

	if(!incident || !user) return Promise.resolve({ type: 'error', listMessage: ['No se pudo registrar la solución.'] });

	incident.status = 'Resuelta';
	incident.resolvedAt = nowIso();
	incident.solution = solution;

	pushHistory(db, idIncident, user.idUser, 'Resolución', 'En Proceso', 'Resuelta');
	saveMockDb(db);

	return Promise.resolve({ type: 'success' });
}

export function mockIncidentClose(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const { idIncident } = params?.body || {};
	const incident = db.incidents.find(i => i.idIncident === idIncident);

	if(!incident || !user) return Promise.resolve({ type: 'error', listMessage: ['No se pudo cerrar la incidencia.'] });

	incident.status = 'Cerrada';
	incident.closedAt = nowIso();

	pushHistory(db, idIncident, user.idUser, 'Cierre', 'Resuelta', 'Cerrada');
	saveMockDb(db);

	return Promise.resolve({ type: 'success' });
}

export function mockIncidentReopen(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const { idIncident, observation } = params?.body || {};
	const incident = db.incidents.find(i => i.idIncident === idIncident);

	if(!incident || !user) return Promise.resolve({ type: 'error', listMessage: ['No se pudo reabrir la incidencia.'] });

	incident.status = 'Reabierta';

	pushHistory(db, idIncident, user.idUser, 'Reapertura', 'Resuelta', 'Reabierta', observation);
	saveMockDb(db);

	return Promise.resolve({ type: 'success' });
}

// ─── Comentarios ────────────────────────────────────────────────────────────

export function mockIncidentCommentInsert(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const { idIncident, description, internalComment } = params?.body || {};

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	db.comments.push({
		idIncidentComment: newId(), idIncident, idUser: user.idUser,
		description, internalComment: !!internalComment, createdAt: nowIso(),
	});

	saveMockDb(db);

	return Promise.resolve({ type: 'success' });
}

export function mockIncidentCommentGetAll(params: any): Promise<any> {
	const db = loadMockDb();
	const idIncident = params?.idIncident;

	const listComment = db.comments
		.filter(c => c.idIncident === idIncident)
		.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
		.map(c => ({ ...c, userFullName: fullName(db, c.idUser) }));

	return Promise.resolve({ type: 'success', listComment });
}

// ─── Catálogos ──────────────────────────────────────────────────────────────

export function mockCategoryGetAll(): Promise<any> {
	const db = loadMockDb();
	return Promise.resolve({ type: 'success', listCategory: db.categories });
}

export function mockPriorityGetAll(): Promise<any> {
	const db = loadMockDb();
	return Promise.resolve({ type: 'success', listPriority: db.priorities });
}

export function mockTechnicianGetAll(): Promise<any> {
	const db = loadMockDb();
	return Promise.resolve({
		type: 'success',
		listTechnician: db.users.filter(u => u.role === 'Técnico').map(u => ({ idUser: u.idUser, fullName: u.fullName })),
	});
}

// ─── Contacto interno (Admin OTI <-> Técnico) ────────────────────────────────
// "Contactar a un colega" en la página de Ayuda, para Admin/Técnico en vez
// del "Reportar" que ve el Solicitante. Se entrega como una notificación
// más (sin incidencia asociada) — ver buildNotifications().

function counterpartRoleFor(role: string | undefined): 'Administrador OTI' | 'Técnico' | null {
	if(role === 'Administrador OTI') return 'Técnico';
	if(role === 'Técnico') return 'Administrador OTI';

	return null;
}

export function mockContactGetAll(): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	const targetRole = counterpartRoleFor(user.role);

	if(!targetRole) {
		return Promise.resolve({ type: 'success', listContact: [] });
	}

	return Promise.resolve({
		type: 'success',
		listContact: db.users
			.filter(u => u.role === targetRole && u.idUser !== user.idUser)
			.map(u => ({ idUser: u.idUser, fullName: u.fullName })),
	});
}

export function mockContactSendMessage(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	const targetRole = counterpartRoleFor(user.role);

	if(!targetRole) {
		return Promise.resolve({ type: 'error', listMessage: ['No tienes permiso para enviar mensajes internos.'] });
	}

	const idRecipientUser: string = params?.body?.idRecipientUser || '';
	const message: string = (params?.body?.message || '').trim();
	const recipient = db.users.find(u => u.idUser === idRecipientUser && u.role === targetRole);

	if(!recipient) {
		return Promise.resolve({ type: 'error', listMessage: ['El destinatario seleccionado ya no está disponible.'] });
	}

	if(!message) {
		return Promise.resolve({ type: 'error', listMessage: ['Escribe un mensaje antes de enviarlo.'] });
	}

	db.directMessages.push({
		idDirectMessage: newId(),
		idSenderUser: user.idUser,
		idRecipientUser: recipient.idUser,
		senderFullName: user.fullName,
		message,
		createdAt: nowIso(),
	});

	saveMockDb(db);

	return Promise.resolve({ type: 'success' });
}

// ─── Notificaciones ─────────────────────────────────────────────────────────
// No hay una tabla de notificaciones propia: se derivan del historial de cada
// incidencia (mismo que ya alimenta el timeline de Seguimiento), filtrado a
// los eventos que le interesan al usuario autenticado. Lo único que se
// persiste aparte es qué eventos ya marcó como leídos.

const NOTIFIABLE_ACTIONS = ['Asignación', 'Inicio de atención', 'Resolución', 'Cierre', 'Reapertura', 'Cambio de prioridad', 'Cambio de estado'];

function notificationLabel(h: MockDb['history'][number]): string {
	switch(h.action) {
		case 'Asignación': return 'Se te asignó una nueva incidencia.';
		case 'Inicio de atención': return 'El técnico comenzó a atender tu incidencia.';
		case 'Resolución': return 'Tu incidencia fue marcada como resuelta.';
		case 'Cierre': return 'Tu incidencia fue cerrada.';
		case 'Reapertura': return 'La incidencia fue reabierta.';
		case 'Cambio de estado': return `El estado cambió a "${h.newValue}".`;
		case 'Cambio de prioridad': return `La prioridad cambió a "${h.newValue}".`;
		default: return h.action;
	}
}

function buildNotifications(db: MockDb, user: MockDb['users'][number]) {
	const fromIncidents = db.history
		.filter(h => NOTIFIABLE_ACTIONS.includes(h.action))
		.filter(h => h.idUser !== user.idUser) // no notificar al autor de su propia acción
		.map(h => {
			const incident = db.incidents.find(i => i.idIncident === h.idIncident);
			return { h, incident };
		})
		.filter(({ incident }) => !!incident)
		.filter(({ incident }) =>
			incident!.idUser === user.idUser || // dueño de la incidencia (solicitante)
			(user.role === 'Técnico' && incident!.idTechnician === user.idUser) // técnico asignado
		)
		.map(({ h, incident }) => ({
			idHistory: h.idHistory,
			idIncident: incident!.idIncident,
			ticketCode: incident!.ticketCode,
			title: incident!.title,
			message: notificationLabel(h),
			createdAt: h.createdAt,
			read: db.notificationReads.includes(`${user.idUser}::${h.idHistory}`),
		}));

	// Mensajes directos (Admin OTI <-> Técnico, ver "Contactar a un colega"
	// en Ayuda): sin incidencia asociada, ticketCode vacío a propósito —
	// App.openNotification() usa eso para no intentar navegar a un ticket.
	const fromDirectMessages = (db.directMessages || [])
		.filter(m => m.idRecipientUser === user.idUser)
		.map(m => ({
			idHistory: m.idDirectMessage,
			idIncident: null,
			ticketCode: '',
			title: 'Mensaje de ' + m.senderFullName,
			message: m.message,
			createdAt: m.createdAt,
			read: db.notificationReads.includes(`${user.idUser}::${m.idDirectMessage}`),
		}));

	return [...fromIncidents, ...fromDirectMessages]
		.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
		.slice(0, 20);
}

export function mockNotificationGetAll(): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	const listNotification = buildNotifications(db, user);

	return Promise.resolve({
		type: 'success',
		listNotification,
		unreadCount: listNotification.filter(n => !n.read).length,
	});
}

export function mockNotificationMarkRead(params: any): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);
	const idHistory = params?.body?.idHistory;

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	const marker = `${user.idUser}::${idHistory}`;

	if(!db.notificationReads.includes(marker)) {
		db.notificationReads.push(marker);
		saveMockDb(db);
	}

	return Promise.resolve({ type: 'success' });
}

export function mockNotificationMarkAllRead(): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);

	if(!user) return Promise.resolve({ type: 'error', listMessage: ['Sesión no válida.'] });

	const listNotification = buildNotifications(db, user);

	for(const n of listNotification) {
		const marker = `${user.idUser}::${n.idHistory}`;

		if(!db.notificationReads.includes(marker)) {
			db.notificationReads.push(marker);
		}
	}

	saveMockDb(db);

	return Promise.resolve({ type: 'success' });
}

// ─── Reportes (solo Administrador OTI) ─────────────────────────────────────
// Misma lógica que las 4 consultas SQL del backend real (RepositoryReport),
// reescrita en JS sobre los datos simulados: tiempo promedio de resolución
// por categoría/técnico, carga de trabajo por técnico, e incidencias con
// SLA vencido.

const OPEN_STATUSES_EXCLUDED = ['Resuelta', 'Cerrada', 'Cancelada'];

function hoursBetween(fromIso: string, toIso: string): number {
	const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();

	return Math.round((ms / 3_600_000) * 10) / 10;
}

export function mockReportSummary(): Promise<any> {
	const db = loadMockDb();
	const user = currentUser(db);

	if(!user || user.role !== 'Administrador OTI') {
		return Promise.resolve({ type: 'error', listMessage: ['No tiene permisos para ver los reportes.'] });
	}

	const resolved = db.incidents.filter(i => !!i.resolvedAt);

	// 1. Tiempo promedio de resolución por categoría
	const avgResolutionHoursByCategory = db.categories
		.map(cat => {
			const items = resolved.filter(i => i.idCategory === cat.idCategory);

			if(items.length === 0) return null;

			const avgHours = items.reduce((sum, i) => sum + hoursBetween(i.createdAt, i.resolvedAt as string), 0) / items.length;

			return { category: cat.name, avgHours: Math.round(avgHours * 10) / 10, total: items.length };
		})
		.filter((row): row is { category: string; avgHours: number; total: number } => row !== null)
		.sort((a, b) => b.avgHours - a.avgHours);

	// 2. Tiempo promedio de resolución por técnico
	const technicians = db.users.filter(u => u.role === 'Técnico');
	const avgResolutionHoursByTechnician = technicians
		.map(tech => {
			const items = resolved.filter(i => i.idTechnician === tech.idUser);

			if(items.length === 0) return null;

			const avgHours = items.reduce((sum, i) => sum + hoursBetween(i.createdAt, i.resolvedAt as string), 0) / items.length;

			return { technicianFullName: tech.fullName, avgHours: Math.round(avgHours * 10) / 10, total: items.length };
		})
		.filter((row): row is { technicianFullName: string; avgHours: number; total: number } => row !== null)
		.sort((a, b) => a.avgHours - b.avgHours);

	// 3. Carga de trabajo por técnico (incluye técnicos sin incidencias, con 0)
	const workloadByTechnician = technicians
		.map(tech => {
			const items = db.incidents.filter(i => i.idTechnician === tech.idUser);
			const openCount = items.filter(i => !OPEN_STATUSES_EXCLUDED.includes(i.status)).length;

			return { technicianFullName: tech.fullName, openCount, totalCount: items.length };
		})
		.sort((a, b) => b.openCount - a.openCount);

	// 4. Incidencias con SLA vencido
	const now = new Date().toISOString();
	const slaOverdue = db.incidents
		.filter(i => !OPEN_STATUSES_EXCLUDED.includes(i.status))
		.map(i => {
			const category = db.categories.find(c => c.idCategory === i.idCategory);
			const hoursElapsed = hoursBetween(i.createdAt, now);

			if(!category || hoursElapsed <= category.slaHours) return null;

			const technician = i.idTechnician ? db.users.find(u => u.idUser === i.idTechnician) : null;

			return {
				ticketCode: i.ticketCode,
				title: i.title,
				category: category.name,
				slaHours: category.slaHours,
				hoursElapsed,
				status: i.status,
				technicianFullName: technician ? technician.fullName : null,
			};
		})
		.filter((row): row is NonNullable<typeof row> => row !== null)
		.sort((a, b) => b.hoursElapsed - a.hoursElapsed);

	return Promise.resolve({
		type: 'success',
		avgResolutionHoursByCategory,
		avgResolutionHoursByTechnician,
		workloadByTechnician,
		slaOverdue,
	});
}
