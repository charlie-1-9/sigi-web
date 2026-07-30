/**
 * Base de datos simulada para que el frontend funcione de forma completamente
 * autónoma, sin backend ni base de datos real. Los nombres de campo replican
 * dbotiunamba_v2.sql para que conectar el backend real más adelante sea solo
 * cuestión de sustituir mock-api.service.ts por el cliente HTTP generado.
 */

const STORE_KEY = 'sigi-web-mock-db';

const uid = () => (crypto as any)?.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();

export interface MockUser {
	idUser: string;
	email: string;
	password: string;
	fullName: string;
	role: 'Administrador OTI' | 'Técnico' | 'Solicitante';
	idOffice: string;
}

export interface MockIncident {
	idIncident: string;
	ticketCode: string;
	idUser: string;
	idTechnician: string | null;
	idCategory: string;
	idPriority: string;
	status: string;
	title: string;
	description: string;
	location: string;
	solution: string;
	createdAt: string;
	assignedAt: string | null;
	startedAt: string | null;
	resolvedAt: string | null;
	closedAt: string | null;
}

export interface MockComment {
	idIncidentComment: string;
	idIncident: string;
	idUser: string;
	description: string;
	internalComment: boolean;
	createdAt: string;
}

export interface MockFile {
	idIncidentFile: string;
	idIncident: string;
	fileName: string;
	mimeType: string;
	dataUrl: string;
	createdAt: string;
}

export interface MockHistory {
	idHistory: string;
	idIncident: string;
	idUser: string;
	action: string;
	previousValue: string | null;
	newValue: string;
	observation?: string;
	createdAt: string;
}

/** Mensaje directo Admin OTI <-> Técnico, sin incidencia asociada (ver
 *  página de Ayuda: "Contactar a un colega"). Se muestra junto con las
 *  notificaciones derivadas de incidencias, pero sin ticketCode. */
export interface MockDirectMessage {
	idDirectMessage: string;
	idSenderUser: string;
	idRecipientUser: string;
	senderFullName: string;
	message: string;
	createdAt: string;
}

export interface MockDb {
	users: MockUser[];
	categories: { idCategory: string; name: string; slaHours: number }[];
	priorities: { idPriority: string; name: string }[];
	incidents: MockIncident[];
	comments: MockComment[];
	history: MockHistory[];
	files: MockFile[];
	nextTicket: number;
	// Marcas de lectura de notificaciones: "idUser::idHistory" ya vistos.
	notificationReads: string[];
	directMessages: MockDirectMessage[];
}

function buildSeed(): MockDb {
	const users: MockUser[] = [
		{ idUser: 'u-rosa', email: 'rttito@unamba.edu.pe', password: '123456', fullName: 'Rosa Ttito', role: 'Administrador OTI', idOffice: 'off-oti' },
		{ idUser: 'u-carla', email: 'cmendoza@unamba.edu.pe', password: '123456', fullName: 'Carla Mendoza', role: 'Técnico', idOffice: 'off-oti' },
		{ idUser: 'u-jorge', email: 'jsalas@unamba.edu.pe', password: '123456', fullName: 'Jorge Salas', role: 'Técnico', idOffice: 'off-oti' },
		{ idUser: 'u-ana', email: 'aquispe@unamba.edu.pe', password: '123456', fullName: 'Ana Quispe', role: 'Solicitante', idOffice: 'off-acad' },
		{ idUser: 'u-luis', email: 'lhuaman@unamba.edu.pe', password: '123456', fullName: 'Luis Huamán', role: 'Solicitante', idOffice: 'off-facing' },
	];

	const categories = [
		{ idCategory: 'cat-hw', name: 'Hardware', slaHours: 8 },
		{ idCategory: 'cat-sw', name: 'Software', slaHours: 24 },
		{ idCategory: 'cat-net', name: 'Red', slaHours: 4 },
		{ idCategory: 'cat-mail', name: 'Correo', slaHours: 12 },
		{ idCategory: 'cat-sis', name: 'Sistema Académico', slaHours: 6 },
		{ idCategory: 'cat-imp', name: 'Impresoras', slaHours: 12 },
	];

	const priorities = [
		{ idPriority: 'pri-baja', name: 'Baja' },
		{ idPriority: 'pri-media', name: 'Media' },
		{ idPriority: 'pri-alta', name: 'Alta' },
		{ idPriority: 'pri-critica', name: 'Crítica' },
	];

	const incidents: MockIncident[] = [
		{
			idIncident: uid(), ticketCode: 'INC-2026-0001', idUser: 'u-ana', idTechnician: 'u-carla',
			idCategory: 'cat-net', idPriority: 'pri-alta', status: 'En Proceso',
			title: 'Sin acceso a internet en sala de docentes',
			description: 'Desde esta mañana ningún equipo de la sala de docentes logra conectarse a la red.',
			location: 'Sala de docentes - 2do piso', solution: '',
			createdAt: '2026-07-10T08:15:00', assignedAt: '2026-07-10T08:40:00', startedAt: '2026-07-10T09:00:00',
			resolvedAt: null, closedAt: null,
		},
		{
			idIncident: uid(), ticketCode: 'INC-2026-0002', idUser: 'u-luis', idTechnician: 'u-jorge',
			idCategory: 'cat-sis', idPriority: 'pri-critica', status: 'Resuelta',
			title: 'Sistema académico no carga notas del ciclo',
			description: 'Al intentar registrar notas el sistema muestra error 500 de forma intermitente.',
			location: 'Facultad de Ingeniería', solution: 'Se reinició el servicio de aplicación y se limpió caché de sesión.',
			createdAt: '2026-07-08T10:00:00', assignedAt: '2026-07-08T10:20:00', startedAt: '2026-07-08T10:30:00',
			resolvedAt: '2026-07-08T13:10:00', closedAt: null,
		},
		{
			idIncident: uid(), ticketCode: 'INC-2026-0003', idUser: 'u-ana', idTechnician: null,
			idCategory: 'cat-imp', idPriority: 'pri-media', status: 'Nueva',
			title: 'Impresora de secretaría académica no imprime',
			description: 'La impresora HP de secretaría muestra atasco de papel que no se puede retirar.',
			location: 'Secretaría Académica', solution: '',
			createdAt: '2026-07-12T09:05:00', assignedAt: null, startedAt: null, resolvedAt: null, closedAt: null,
		},
		{
			idIncident: uid(), ticketCode: 'INC-2026-0004', idUser: 'u-luis', idTechnician: 'u-carla',
			idCategory: 'cat-hw', idPriority: 'pri-baja', status: 'Cerrada',
			title: 'Monitor con parpadeo intermitente',
			description: 'El monitor del laboratorio 3 parpadea cada cierto tiempo, sospecha de cable VGA.',
			location: 'Laboratorio de Cómputo 3', solution: 'Se reemplazó el cable VGA por uno nuevo.',
			createdAt: '2026-07-05T11:00:00', assignedAt: '2026-07-05T11:30:00', startedAt: '2026-07-05T14:00:00',
			resolvedAt: '2026-07-05T14:45:00', closedAt: '2026-07-06T08:10:00',
		},
	];

	const history: MockHistory[] = [];
	for(const i of incidents) {
		history.push({ idHistory: uid(), idIncident: i.idIncident, idUser: i.idUser, action: 'Creación', previousValue: null, newValue: 'Nueva', createdAt: i.createdAt });
		if(i.assignedAt) history.push({ idHistory: uid(), idIncident: i.idIncident, idUser: 'u-rosa', action: 'Asignación', previousValue: 'Nueva', newValue: 'Asignada', createdAt: i.assignedAt });
		if(i.startedAt) history.push({ idHistory: uid(), idIncident: i.idIncident, idUser: i.idTechnician!, action: 'Inicio de atención', previousValue: 'Asignada', newValue: 'En Proceso', createdAt: i.startedAt });
		if(i.resolvedAt) history.push({ idHistory: uid(), idIncident: i.idIncident, idUser: i.idTechnician!, action: 'Resolución', previousValue: 'En Proceso', newValue: 'Resuelta', createdAt: i.resolvedAt });
		if(i.closedAt) history.push({ idHistory: uid(), idIncident: i.idIncident, idUser: i.idUser, action: 'Cierre', previousValue: 'Resuelta', newValue: 'Cerrada', createdAt: i.closedAt });
	}

	const comments: MockComment[] = [
		{ idIncidentComment: uid(), idIncident: incidents[0].idIncident, idUser: 'u-carla', description: 'Revisando el switch del piso, parece haber un puerto caído.', internalComment: false, createdAt: '2026-07-10T09:10:00' },
		{ idIncidentComment: uid(), idIncident: incidents[1].idIncident, idUser: 'u-jorge', description: 'Confirmado con base de datos: el timeout venía del pool de conexiones.', internalComment: true, createdAt: '2026-07-08T12:00:00' },
	];

	// Adjunto de ejemplo (evidencia) para demostrar la función sin necesidad
	// de que el usuario suba uno primero.
	const sampleEvidenceSvg = 'data:image/svg+xml;base64,' + btoa(`
		<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300">
			<rect width="480" height="300" fill="#0f172a"/>
			<rect x="16" y="16" width="448" height="32" rx="6" fill="#1e293b"/>
			<circle cx="34" cy="32" r="5" fill="#ef4444"/>
			<circle cx="52" cy="32" r="5" fill="#eab308"/>
			<circle cx="70" cy="32" r="5" fill="#22c55e"/>
			<text x="30" y="100" font-family="monospace" font-size="16" fill="#f87171">$ ping 10.20.0.1</text>
			<text x="30" y="130" font-family="monospace" font-size="16" fill="#f87171">Request timed out.</text>
			<text x="30" y="160" font-family="monospace" font-size="16" fill="#f87171">Request timed out.</text>
			<text x="30" y="190" font-family="monospace" font-size="16" fill="#f87171">Request timed out.</text>
			<text x="30" y="240" font-family="sans-serif" font-size="14" fill="#94a3b8">Captura adjuntada por el solicitante como evidencia</text>
		</svg>
	`);

	const files: MockFile[] = [
		{
			idIncidentFile: uid(), idIncident: incidents[0].idIncident,
			fileName: 'captura-sin-red.svg', mimeType: 'image/svg+xml',
			dataUrl: sampleEvidenceSvg, createdAt: '2026-07-10T08:16:00',
		},
	];

	return { users, categories, priorities, incidents, comments, history, files, nextTicket: 5, notificationReads: [], directMessages: [] };
}

export function loadMockDb(): MockDb {
	try {
		const raw = localStorage.getItem(STORE_KEY);
		if(raw) {
			const parsed = JSON.parse(raw);

			// Compatibilidad con datos guardados antes de agregar adjuntos
			if(!parsed.files) parsed.files = [];

			// Compatibilidad con datos guardados antes de agregar notificaciones
			if(!parsed.notificationReads) parsed.notificationReads = [];

			// Compatibilidad con datos guardados antes de agregar mensajes directos
			if(!parsed.directMessages) parsed.directMessages = [];

			return parsed;
		}
	} catch { /* localStorage no disponible */ }

	const seed = buildSeed();
	saveMockDb(seed);

	return seed;
}

export function saveMockDb(db: MockDb): void {
	try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* noop */ }
}

export function newId(): string {
	return uid();
}

export function nowIso(): string {
	return now();
}
