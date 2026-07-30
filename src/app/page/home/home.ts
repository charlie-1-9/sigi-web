import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Api } from '../../api/api';
import { apiincidentgetall, apireportsummary, apicategorygetall, apiservicestatusgetall, apiannouncementgetactive } from '../../api/functions';
import { AuthService } from '../../auth/auth.service';
import { OptionMenuService } from '../../observable/option-menu/option-menu.service';

const STATUS_COLORS: Record<string, string> = {
	'Nueva': '#3b82f6', 'Pendiente': '#94a3b8', 'Asignada': '#06b6d4',
	'En Proceso': '#f97316', 'Resuelta': '#22c55e', 'Cerrada': '#15803d',
	'Cancelada': '#ef4444', 'Reabierta': '#a855f7'
};

const PRIORITY_COLORS: Record<string, string> = {
	'Baja': '#22c55e', 'Media': '#eab308', 'Alta': '#f97316', 'Crítica': '#ef4444'
};

@Component({
	selector: 'app-home',
	imports: [CommonModule, RouterModule, CardModule, ButtonModule, TagModule, ChartModule, TableModule, TooltipModule],
	templateUrl: './home.html',
	styleUrl: './home.css',
})

export class Home implements OnInit {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private optionMenuService = inject(OptionMenuService);
	private authService = inject(AuthService);

	STATUS_COLORS = STATUS_COLORS;

	constructor(
		private api: Api,
		private http: HttpClient
	) {}

	fullName: string | null = null;
	role: string | null = null;

	get firstName(): string {
		return (this.fullName || 'usuario').trim().split(' ')[0];
	}

	// Saludo según la hora del día, en vez de un genérico fijo — pequeño
	// detalle que hace que la pantalla se sienta viva, no una plantilla.
	get timeGreeting(): string {
		const hour = new Date().getHours();

		if(hour < 12) return 'Buenos días';
		if(hour < 19) return 'Buenas tardes';

		return 'Buenas noches';
	}

	listIncident: any[] = [];
	loading: boolean = false;

	statusCounts: { name: string; count: number; color: string }[] = [];

	statusChartData: any = null;
	statusChartOptions: any = null;
	priorityChartData: any = null;
	priorityChartOptions: any = null;

	// Verificación real de conectividad HTTP contra el servidor donde se
	// despliega la app (Nginx/Apache), independiente de los datos simulados.
	serverStatus: 'checking' | 'ok' | 'error' = 'checking';

	// Reportes (solo Administrador OTI) — ver /report/summary
	reportLoading: boolean = false;
	avgResolutionHoursByCategory: any[] = [];
	avgResolutionHoursByTechnician: any[] = [];
	workloadByTechnician: any[] = [];
	slaOverdue: any[] = [];

	ngOnInit(): void {
		this.optionMenuService.sendData('');

		this.fullName = this.authService.getFullName();
		this.role = this.authService.getRole();

		this.loadData();
		this.checkServerStatus();
		this.loadServiceStatus();
		this.loadAnnouncements();

		if(this.role === 'Administrador OTI') {
			this.loadReportSummary();
		}

		if(this.role === 'Solicitante') {
			this.loadServiceCategories();
		}
	}

	// ── Estado de servicios y avisos (portal de inicio) ────────────────────
	// Visibles para cualquier rol — antes de reportar un problema, el
	// usuario ve si ya se sabe de una caída, para no duplicar tickets.
	serviceStatusList: any[] = [];
	announcementList: any[] = [];

	readonly SEVERITY_META: Record<string, { icon: string; bg: string; fg: string }> = {
		info: { icon: 'pi-info-circle', bg: '#eef3f8', fg: '#1E3A5F' },
		warning: { icon: 'pi-exclamation-triangle', bg: '#fef3c7', fg: '#92400e' },
		critical: { icon: 'pi-times-circle', bg: '#fee2e2', fg: '#b91c1c' }
	};

	readonly SERVICE_STATUS_META: Record<string, { color: string; icon: string }> = {
		'Operativo': { color: '#22c55e', icon: 'pi-check-circle' },
		'Degradado': { color: '#eab308', icon: 'pi-exclamation-triangle' },
		'Interrumpido': { color: '#ef4444', icon: 'pi-times-circle' }
	};

	private loadServiceStatus(): void {
		this.api.invoke(apiservicestatusgetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.serviceStatusList = apiResponseData.listServiceStatus || [];

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	private loadAnnouncements(): void {
		this.api.invoke(apiannouncementgetactive).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.announcementList = apiResponseData.listAnnouncement || [];

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	// "Servicios frecuentes": usa el catálogo REAL de categorías (con su
	// ícono y color propios, ya definidos en la BD) como accesos directos
	// para reportar un problema con esa categoría ya preseleccionada — en
	// vez de inventar un catálogo de servicios aparte que no existe todavía.
	serviceCategories: any[] = [];

	private loadServiceCategories(): void {
		this.api.invoke(apicategorygetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.serviceCategories = apiResponseData.listCategory || [];

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	private checkServerStatus(): void {
		this.http.get('assets/status.json').subscribe({
			next: () => {
				this.serverStatus = 'ok';

				this.changeDetectorRef.markForCheck();
				this.changeDetectorRef.detectChanges();
			},
			error: () => {
				this.serverStatus = 'error';

				this.changeDetectorRef.markForCheck();
				this.changeDetectorRef.detectChanges();
			}
		});
	}

	loadData(): void {
		this.loading = true;

		this.api.invoke(apiincidentgetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.listIncident = apiResponseData.listIncident || [];
				this.computeCounts();
			}

			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	// ── KPIs del Técnico ─────────────────────────────────────────────────
	// Se calculan de listIncident, que el backend ya limita a las
	// incidencias asignadas a este técnico — no hace falta otra llamada.
	// Mapeo elegido: "Nuevas" = recién asignadas (Asignada, sin iniciar
	// todavía); "Esperando usuario" = ya resueltas por el técnico, en
	// espera de que el solicitante confirme o reabra.
	get technicianKpis() {
		const count = (status: string) => this.listIncident.filter(i => i.status === status).length;

		return [
			{ label: 'Nuevas', count: count('Asignada'), color: '#06b6d4', icon: 'pi-inbox' },
			{ label: 'En progreso', count: count('En Proceso'), color: '#f97316', icon: 'pi-spinner' },
			{ label: 'Esperando usuario', count: count('Resuelta'), color: '#94a3b8', icon: 'pi-clock' },
			{ label: 'Resueltas', count: count('Cerrada'), color: '#22c55e', icon: 'pi-check-circle' }
		];
	}

	// ── KPIs del Administrador ───────────────────────────────────────────
	// Derivados de datos que YA se cargan para los cuadros de reportes de
	// más abajo (workloadByTechnician, avgResolutionHoursByCategory) —
	// esto solo los resume arriba, sin pedirle nada nuevo al backend.
	get adminOpenIncidentsCount(): number {
		return this.listIncident.filter(i => i.status !== 'Cerrada' && i.status !== 'Cancelada').length;
	}

	get adminAvgResolutionHours(): number | null {
		if(this.avgResolutionHoursByCategory.length === 0) return null;

		const totalResolved = this.avgResolutionHoursByCategory.reduce((sum, c) => sum + c.total, 0);

		if(totalResolved === 0) return null;

		const weightedSum = this.avgResolutionHoursByCategory.reduce((sum, c) => sum + (c.avgHours * c.total), 0);

		return Math.round((weightedSum / totalResolved) * 10) / 10;
	}

	// "Disponible" no se rastrea literalmente en el sistema (no hay un
	// estado de turno/disponibilidad) — se infiere de la carga: un técnico
	// sin incidencias abiertas asignadas ahora mismo cuenta como
	// disponible. Es una aproximación razonable, no un dato exacto.
	get adminAvailableTechniciansCount(): number {
		return this.workloadByTechnician.filter(t => t.openCount === 0).length;
	}

	get adminTopFailingService(): { category: string; total: number } | null {
		if(this.avgResolutionHoursByCategory.length === 0) return null;

		return this.avgResolutionHoursByCategory.reduce((top, c) => c.total > (top?.total || 0) ? c : top, null as any);
	}

	private computeCounts(): void {
		const order = ['Nueva', 'Asignada', 'En Proceso', 'Resuelta', 'Cerrada'];

		this.statusCounts = order.map(name => ({
			name,
			count: this.listIncident.filter(i => i.status == name).length,
			color: STATUS_COLORS[name]
		}));

		this.buildStatusChart();
		this.buildPriorityChart();
	}

	private buildStatusChart(): void {
		// A diferencia de statusCounts (fijo a 5 estados para las tarjetas del
		// Administrador), el gráfico muestra cualquier estado presente en los
		// datos, para no perder información con roles que ven un subconjunto
		// distinto de incidencias (Técnico, Solicitante).
		const present = Array.from(new Set(this.listIncident.map(i => i.status))) as string[];
		const labels = Object.keys(STATUS_COLORS).filter(s => present.includes(s));
		const data = labels.map(name => this.listIncident.filter(i => i.status == name).length);

		if(labels.length === 0) {
			this.statusChartData = null;
			return;
		}

		this.statusChartData = {
			labels,
			datasets: [{
				data,
				backgroundColor: labels.map(l => STATUS_COLORS[l]),
				borderWidth: 0,
			}]
		};

		this.statusChartOptions = {
			plugins: {
				legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16, font: { size: 12 } } }
			},
			cutout: '60%',
			responsive: true,
			maintainAspectRatio: false,
		};
	}

	private buildPriorityChart(): void {
		const labels = Object.keys(PRIORITY_COLORS);
		const data = labels.map(name => this.listIncident.filter(i => i.priority == name).length);

		if(this.listIncident.length === 0) {
			this.priorityChartData = null;
			return;
		}

		this.priorityChartData = {
			labels,
			datasets: [{
				label: 'Incidencias',
				data,
				backgroundColor: labels.map(l => PRIORITY_COLORS[l]),
				borderRadius: 6,
				// Sin barThickness fijo: así las barras se reparten para llenar
				// el ancho disponible de la tarjeta en vez de quedar angostas y
				// pegadas a la izquierda. maxBarThickness evita que se vean
				// desproporcionadas en pantallas muy anchas.
				maxBarThickness: 64,
			}]
		};

		this.priorityChartOptions = {
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { display: false } },
				y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(148, 163, 184, 0.15)' } }
			},
			// Con solo 4 categorías, el ancho por defecto deja mucho espacio
			// vacío a los costados; se reduce el espaciado entre grupos para
			// que las barras usen mejor el encuadre sin llegar a tocarse.
			categoryPercentage: 0.6,
			barPercentage: 0.9,
			responsive: true,
			maintainAspectRatio: false,
		};
	}

	get unassignedCount(): number {
		return this.listIncident.filter(i => i.status == 'Nueva').length;
	}

	get recentIncidents(): any[] {
		return this.listIncident.slice(0, 3);
	}

	private loadReportSummary(): void {
		this.reportLoading = true;

		this.api.invoke(apireportsummary).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.avgResolutionHoursByCategory = apiResponseData.avgResolutionHoursByCategory || [];
				this.avgResolutionHoursByTechnician = apiResponseData.avgResolutionHoursByTechnician || [];
				this.workloadByTechnician = apiResponseData.workloadByTechnician || [];
				this.slaOverdue = apiResponseData.slaOverdue || [];
			}

			this.reportLoading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.reportLoading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}
}
