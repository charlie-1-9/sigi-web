import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { Api } from '../../../api/api';
import { apiincidentgetall, apitechniciangetall, apiincidentassign, apiincidentupdate, apiprioritygetall, apicategorygetall } from '../../../api/functions';
import { AuthService } from '../../../auth/auth.service';
import { OptionMenuService } from '../../../observable/option-menu/option-menu.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STATUS_COLORS: Record<string, string> = {
	'Nueva': '#3b82f6', 'Pendiente': '#94a3b8', 'Asignada': '#06b6d4',
	'En Proceso': '#f97316', 'Resuelta': '#22c55e', 'Cerrada': '#15803d',
	'Cancelada': '#ef4444', 'Reabierta': '#a855f7'
};

const PRIORITY_COLORS: Record<string, string> = {
	'Baja': '#22c55e', 'Media': '#eab308', 'Alta': '#f97316', 'Crítica': '#ef4444'
};

@Component({
	selector: 'app-incident-list',
	imports: [CommonModule, FormsModule, ButtonModule, TableModule, TagModule, SelectModule, InputTextModule, TooltipModule],
	templateUrl: './list.html',
	styleUrl: './list.css',
})

export class IncidentList implements OnInit {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private messageService = inject(MessageService);
	private optionMenuService = inject(OptionMenuService);
	private authService = inject(AuthService);
	private router = inject(Router);

	role: string | null = null;

	listIncident: any[] = [];
	listTechnician: any[] = [];
	statusOptions: any[] = [
		{ name: 'Todos' },
		{ name: 'Nueva' }, { name: 'Asignada' }, { name: 'En Proceso' },
		{ name: 'Resuelta' }, { name: 'Cerrada' }, { name: 'Reabierta' }
	];

	filterStatus: string = 'Todos';
	filterPriority: string = 'Todos';
	search: string = '';

	assigningRow: string | null = null;
	assignSelection: Record<string, string> = {};

	updatingRow: string | null = null;
	listPriority: any[] = [];
	technicianStatusOptions: any[] = [
		{ name: 'Asignada' }, { name: 'En Proceso' }, { name: 'Resuelta' },
		{ name: 'Cerrada' }, { name: 'Cancelada' }, { name: 'Reabierta' }
	];

	loading: boolean = false;

	STATUS_COLORS = STATUS_COLORS;
	PRIORITY_COLORS = PRIORITY_COLORS;

	constructor(
		private api: Api
	) {}

	ngOnInit(): void {
		this.optionMenuService.sendData('incidentlist');

		this.role = this.authService.getRole();

		this.loadData();
		this.loadCategories();

		if(this.role == 'Administrador OTI') {
			this.loadTechnicians();
		}

		if(this.role == 'Técnico') {
			this.loadPriorities();
		}
	}

	loadData(): void {
		this.loading = true;

		this.api.invoke(apiincidentgetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.listIncident = apiResponseData.listIncident || [];
			}

			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loading = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	private loadTechnicians(): void {
		this.api.invoke(apitechniciangetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listTechnician = apiResponseData.listTechnician || [];

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	private loadPriorities(): void {
		this.api.invoke(apiprioritygetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listPriority = apiResponseData.listPriority || [];

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	// El endpoint de incidencias solo devuelve el NOMBRE de la categoría
	// (texto plano), no su ícono/color — esos viven en el catálogo. Se
	// arma un mapa nombre→{icon,color} para pintar un ícono junto al
	// nombre en la tabla, en vez de solo texto gris sobre texto gris.
	categoryMeta: Record<string, { icon: string; color: string; slaHours?: number }> = {};

	private loadCategories(): void {
		this.api.invoke(apicategorygetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;
			const listCategory = apiResponseData.listCategory || [];

			this.categoryMeta = {};

			listCategory.forEach((c: any) => {
				this.categoryMeta[c.name] = { icon: c.icon, color: c.color, slaHours: c.slaHours };
			});

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	// ── SLA en la bandeja de atención ────────────────────────────────────
	// Solo tiene sentido para incidencias todavía abiertas — una vez
	// resuelta/cerrada, el SLA ya se cumplió o no, y follow-up es donde se
	// ve ese detalle histórico, no el listado.
	private readonly OPEN_STATUSES = ['Nueva', 'Pendiente', 'Asignada', 'En Proceso', 'Reabierta'];

	slaInfo(item: any): { hoursLeft: number; overdue: boolean } | null {
		if(!this.OPEN_STATUSES.includes(item.status)) return null;

		const slaHours = this.categoryMeta[item.category]?.slaHours;

		if(!slaHours) return null;

		const createdAt = new Date(item.createdAt);

		if(isNaN(createdAt.getTime())) return null;

		const hoursElapsed = (Date.now() - createdAt.getTime()) / 3_600_000;
		const hoursLeft = Math.round((slaHours - hoursElapsed) * 10) / 10;

		return { hoursLeft, overdue: hoursLeft < 0 };
	}

	updatePriority(row: any, idPriority: string): void {
		if(!idPriority || idPriority === row.idPriority) return;

		this.saveIncidentUpdate(row, { idPriority });
	}

	updateStatus(row: any, status: string): void {
		if(!status || status === row.status) return;

		this.saveIncidentUpdate(row, { status });
	}

	private saveIncidentUpdate(row: any, changes: { idPriority?: string; status?: string }): void {
		this.updatingRow = row.idIncident;

		this.api.invoke(apiincidentupdate, { body: { idIncident: row.idIncident, ...changes } }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: 'Incidencia actualizada correctamente.' });

				this.loadData();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo actualizar la incidencia.' });
			}

			this.updatingRow = null;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.updatingRow = null;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	get filteredList(): any[] {
		const q = this.search.trim().toLowerCase();

		return this.listIncident
			.filter(i => this.filterStatus == 'Todos' || i.status == this.filterStatus)
			.filter(i => this.filterPriority == 'Todos' || i.priority == this.filterPriority)
			.filter(i => !q || i.title?.toLowerCase().includes(q) || i.ticketCode?.toLowerCase().includes(q));
	}

	private exportRows(): any[] {
		return this.filteredList.map(i => ({
			'Ticket': i.ticketCode,
			'Título': i.title,
			'Categoría': i.category,
			'Prioridad': i.priority,
			'Estado': i.status,
			...(this.role !== 'Solicitante' ? { 'Solicitante': i.requesterFullName } : {}),
			...(this.role !== 'Técnico' ? { 'Técnico': i.technicianFullName || 'Sin asignar' } : {}),
			'Fecha': i.createdAt,
		}));
	}

	private exportFileName(extension: string): string {
		const date = new Date().toISOString().slice(0, 10);
		return `incidencias-${date}.${extension}`;
	}

	exportExcel(): void {
		if(this.filteredList.length === 0) {
			this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'No hay incidencias para exportar.' });

			return;
		}

		const worksheet = XLSX.utils.json_to_sheet(this.exportRows());
		const workbook = XLSX.utils.book_new();

		XLSX.utils.book_append_sheet(workbook, worksheet, 'Incidencias');
		XLSX.writeFile(workbook, this.exportFileName('xlsx'));
	}

	exportPdf(): void {
		if(this.filteredList.length === 0) {
			this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'No hay incidencias para exportar.' });

			return;
		}

		const rows = this.exportRows();
		const headers = Object.keys(rows[0]);
		const doc = new jsPDF({ orientation: 'landscape' });

		doc.setFontSize(13);
		doc.text('SIGI · OTI — Incidencias', 14, 15);

		doc.setFontSize(9);
		doc.setTextColor(100);
		doc.text(`Generado: ${new Date().toLocaleString('es-PE')} — ${rows.length} incidencia(s)`, 14, 21);

		autoTable(doc, {
			startY: 26,
			head: [headers],
			body: rows.map(r => headers.map(h => (r as any)[h])),
			styles: { fontSize: 8 },
			headStyles: { fillColor: [30, 58, 95] },
		});

		doc.save(this.exportFileName('pdf'));
	}

	openFollowUp(ticketCode: string): void {
		this.router.navigate(['/incident/follow-up'], { queryParams: { code: ticketCode } });
	}

	assignIncident(row: any): void {
		const idTechnician = this.assignSelection[row.idIncident];

		if(!idTechnician) {
			this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Selecciona un técnico.' });

			return;
		}

		this.assigningRow = row.idIncident;

		this.api.invoke(apiincidentassign, { body: { idIncident: row.idIncident, idTechnician } }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: 'Incidencia asignada correctamente.' });

				this.loadData();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo asignar.' });
			}

			this.assigningRow = null;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.assigningRow = null;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}
}
