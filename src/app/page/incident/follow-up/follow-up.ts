import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { Api } from '../../../api/api';
import {
	apiincidentgetbycode,
	apiincidentcommentinsert,
	apiincidentcommentgetall,
	apiincidentstart,
	apiincidentresolve,
	apiincidentclose,
	apiincidentreopen
} from '../../../api/functions';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../auth/auth.service';
import { OptionMenuService } from '../../../observable/option-menu/option-menu.service';
import { Subscription, interval } from 'rxjs';
import { friendlyStatus, FriendlyStatus } from '../../../shared/friendly-labels';

const COMMENT_POLL_MS = 5000;

const STATUS_COLORS: Record<string, string> = {
	'Nueva': '#3b82f6', 'Pendiente': '#94a3b8', 'Asignada': '#06b6d4',
	'En Proceso': '#f97316', 'Resuelta': '#22c55e', 'Cerrada': '#15803d',
	'Cancelada': '#ef4444', 'Reabierta': '#a855f7'
};

// Traduce las acciones técnicas del historial (tal como las guarda el
// backend en tincidenthistory) a un mensaje en primera persona y un ícono,
// para que el historial se lea como una conversación y no como un log.
const HISTORY_META: Record<string, { icon: string; label: string }> = {
	'Creación': { icon: 'pi-inbox', label: 'Recibimos tu solicitud' },
	'Asignación': { icon: 'pi-user-plus', label: 'Se asignó un técnico' },
	'Inicio de atención': { icon: 'pi-wrench', label: 'El técnico comenzó a trabajar en esto' },
	'Resolución': { icon: 'pi-check-circle', label: 'Se registró una solución' },
	'Cierre': { icon: 'pi-verified', label: 'Confirmaste que el problema quedó resuelto' },
	'Reapertura': { icon: 'pi-refresh', label: 'Se reabrió porque el problema persistía' },
	'Cambio de prioridad': { icon: 'pi-flag', label: 'Cambió la prioridad' },
	'Cambio de estado': { icon: 'pi-sync', label: 'Cambió el estado' },
};

@Component({
	selector: 'app-incident-follow-up',
	imports: [
		CommonModule,
		RouterModule,
		FormsModule,
		ReactiveFormsModule,
		InputTextModule,
		TextareaModule,
		ButtonModule,
		TagModule,
		SelectModule,
		CheckboxModule
	],
	templateUrl: './follow-up.html',
	styleUrl: './follow-up.css',
})

export class IncidentFollowUp implements OnInit, OnDestroy {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private optionMenuService = inject(OptionMenuService);
	private messageService = inject(MessageService);
	private authService = inject(AuthService);
	private route = inject(ActivatedRoute);

	frmFollowUp: FormGroup;

	role: string | null = null;
	dataResponse: any = null;

	listComment: any[] = [];
	commentText: string = '';
	internalComment: boolean = false;
	loadingComment: boolean = false;

	solutionText: string = '';
	reopenReason: string = '';
	showReopen: boolean = false;

	loadingLookup: boolean = false;
	actionLoading: boolean = false;

	STATUS_COLORS = STATUS_COLORS;

	// Para el Solicitante, el estado se muestra en su propio lenguaje
	// ("El técnico está trabajando" en vez de "En Proceso") — técnicos y
	// administradores siguen viendo el término ITIL, que es el que usan
	// en su trabajo diario.
	get displayStatus(): FriendlyStatus {
		const raw = this.dataResponse?.status;

		if(!raw) return { label: '', explanation: '', icon: 'pi-circle-fill' };

		if(this.role === 'Solicitante') {
			return friendlyStatus(raw);
		}

		return { label: raw, explanation: '', icon: 'pi-circle-fill' };
	}

	historyIcon(action: string): string {
		return HISTORY_META[action]?.icon || 'pi-circle-fill';
	}

	historyLabel(action: string): string {
		return HISTORY_META[action]?.label || action;
	}

	// Mensaje cálido para los estados de espera, en vez de dejar solo un
	// spinner o un tag de estado seco — dice qué está pasando y qué sigue.
	get waitingMessage(): string | null {
		switch(this.dataResponse?.status) {
			case 'Nueva':
				return 'Estamos buscando al técnico más adecuado para tu caso.';
			case 'Pendiente':
				return 'Tu solicitud está a la espera de información o recursos adicionales.';
			case 'Asignada':
				return `${this.dataResponse.technicianFullName || 'El técnico asignado'} pronto comenzará a atender tu incidencia.`;
			case 'En Proceso':
				return 'El técnico está trabajando en tu incidencia ahora mismo.';
			case 'Resuelta':
				return 'Marcamos esto como resuelto — confírmanos si el problema realmente quedó solucionado.';
			default:
				return null;
		}
	}

	private commentPollSubscription: Subscription | null = null;

	get codeFb() { return this.frmFollowUp.controls['code']; }

	constructor(
		private formBuilder: FormBuilder,
		private api: Api
	) {
		this.frmFollowUp = this.formBuilder.group({
			'code': ['']
		});
	}

	ngOnInit(): void {
		this.optionMenuService.sendData('incidentfollowup');

		this.role = this.authService.getRole();

		const codeParam = this.route.snapshot.queryParamMap.get('code');

		if(codeParam) {
			this.codeFb.setValue(codeParam);
			this.searchIncident();
		}
	}

	ngOnDestroy(): void {
		this.stopCommentPolling();
	}

	// ─── Búsqueda ───────────────────────────────────────────────────────────

	searchIncident(): void {
		const codeValue = (this.codeFb.value || '').trim();

		if(!codeValue) return;

		this.dataResponse = null;
		this.listComment = [];
		this.showReopen = false;

		this.stopCommentPolling();

		this.loadingLookup = true;

		this.api.invoke(apiincidentgetbycode, { code: codeValue }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.dataResponse = apiResponseData;
				this.solutionText = apiResponseData.solution || '';

				this.loadComments();
				this.startCommentPolling();
			} else {
				this.messageService.add({ severity: 'error', summary: 'No encontrado', detail: apiResponseData.listMessage?.[0] || 'No se encontró una incidencia con ese código.' });
			}

			this.loadingLookup = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loadingLookup = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	// ─── Permisos contextuales ──────────────────────────────────────────────

	get canStart(): boolean {
		return this.role == 'Técnico' && this.dataResponse?.status == 'Asignada' && this.dataResponse?.idTechnician == this.authService.getIdUser();
	}

	get canResolve(): boolean {
		return this.role == 'Técnico' && this.dataResponse?.status == 'En Proceso' && this.dataResponse?.idTechnician == this.authService.getIdUser();
	}

	get canCloseOrReopen(): boolean {
		return this.role == 'Solicitante' && this.dataResponse?.status == 'Resuelta' && this.dataResponse?.idUser == this.authService.getIdUser();
	}

	get canComment(): boolean {
		if(!this.dataResponse) return false;

		const idUser = this.authService.getIdUser();

		return (this.role == 'Técnico' && this.dataResponse.idTechnician == idUser) ||
			(this.role == 'Solicitante' && this.dataResponse.idUser == idUser);
	}

	// ─── Acciones (CU-03 / CU-04) ───────────────────────────────────────────

	startWork(): void {
		this.actionLoading = true;

		this.api.invoke(apiincidentstart, { body: { idIncident: this.dataResponse.idIncident } }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: 'Atención iniciada.' });

				this.searchIncident();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo iniciar la atención.' });
			}

			this.actionLoading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.actionLoading = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });
		});
	}

	resolveIncident(): void {
		if(!this.solutionText.trim()) {
			this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Describe la solución aplicada.' });

			return;
		}

		this.actionLoading = true;

		this.api.invoke(apiincidentresolve, { body: { idIncident: this.dataResponse.idIncident, solution: this.solutionText.trim() } }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: 'Solución registrada. Incidencia marcada como resuelta.' });

				this.searchIncident();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo registrar la solución.' });
			}

			this.actionLoading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.actionLoading = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });
		});
	}

	closeIncident(): void {
		this.actionLoading = true;

		this.api.invoke(apiincidentclose, { body: { idIncident: this.dataResponse.idIncident } }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: 'Incidencia cerrada. Gracias por confirmar.' });

				this.searchIncident();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo cerrar la incidencia.' });
			}

			this.actionLoading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.actionLoading = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });
		});
	}

	reopenIncident(): void {
		if(!this.reopenReason.trim()) {
			this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Cuéntanos por qué el problema no quedó resuelto.' });

			return;
		}

		this.actionLoading = true;

		this.api.invoke(apiincidentreopen, { body: { idIncident: this.dataResponse.idIncident, observation: this.reopenReason.trim() } }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.messageService.add({ severity: 'info', summary: 'Incidencia reabierta', detail: 'El técnico será notificado nuevamente.' });

				this.reopenReason = '';
				this.showReopen = false;

				this.searchIncident();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo reabrir la incidencia.' });
			}

			this.actionLoading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.actionLoading = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });
		});
	}

	// ─── Comentarios ────────────────────────────────────────────────────────

	private loadComments(): void {
		if(!this.dataResponse?.idIncident) return;

		this.api.invoke(apiincidentcommentgetall, { idIncident: this.dataResponse.idIncident }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				let comments = apiResponseData.listComment || [];

				if(this.role == 'Solicitante') {
					comments = comments.filter((c: any) => !c.internalComment);
				}

				this.listComment = comments;
			}

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {});
	}

	private startCommentPolling(): void {
		this.stopCommentPolling();

		this.commentPollSubscription = interval(COMMENT_POLL_MS).subscribe(() => {
			this.loadComments();
		});
	}

	private stopCommentPolling(): void {
		if(this.commentPollSubscription) {
			this.commentPollSubscription.unsubscribe();
			this.commentPollSubscription = null;
		}
	}

	insertComment(): void {
		if(!this.commentText.trim()) {
			this.messageService.add({ severity: 'warn', summary: 'Atención', detail: 'Escribe un comentario antes de enviar.' });

			return;
		}

		this.loadingComment = true;

		this.api.invoke(apiincidentcommentinsert, {
			body: {
				idIncident: this.dataResponse.idIncident,
				description: this.commentText.trim(),
				internalComment: this.role == 'Técnico' ? this.internalComment : false
			}
		}).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.commentText = '';
				this.internalComment = false;

				this.loadComments();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo registrar el comentario.' });
			}

			this.loadingComment = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loadingComment = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}
}
