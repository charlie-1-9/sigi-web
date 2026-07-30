import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Api } from '../../../api/api';
import {
	apiservicestatusgetall, apiservicestatusupdate,
	apiannouncementgetallforadmin, apiannouncementinsert, apiannouncementdeactivate
} from '../../../api/functions';
import { OptionMenuService } from '../../../observable/option-menu/option-menu.service';

const STATUS_OPTIONS = [
	{ label: 'Operativo', value: 'Operativo' },
	{ label: 'Degradado', value: 'Degradado' },
	{ label: 'Interrumpido', value: 'Interrumpido' }
];

const SEVERITY_OPTIONS = [
	{ label: 'Informativo', value: 'info' },
	{ label: 'Advertencia', value: 'warning' },
	{ label: 'Crítico', value: 'critical' }
];

const STATUS_COLORS: Record<string, string> = {
	'Operativo': '#22c55e', 'Degradado': '#eab308', 'Interrumpido': '#ef4444'
};

const SEVERITY_COLORS: Record<string, string> = {
	'info': '#1E3A5F', 'warning': '#92400e', 'critical': '#b91c1c'
};

@Component({
	selector: 'app-admin-services',
	imports: [CommonModule, FormsModule, ButtonModule, SelectModule, InputTextModule, TextareaModule, TagModule, TooltipModule],
	templateUrl: './services.html',
	styleUrl: './services.css',
})

export class AdminServices implements OnInit {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private messageService = inject(MessageService);
	private confirmationService = inject(ConfirmationService);
	private optionMenuService = inject(OptionMenuService);
	private api = inject(Api);

	STATUS_OPTIONS = STATUS_OPTIONS;
	SEVERITY_OPTIONS = SEVERITY_OPTIONS;
	STATUS_COLORS = STATUS_COLORS;
	SEVERITY_COLORS = SEVERITY_COLORS;

	loadingStatus: boolean = true;
	loadingAnnouncements: boolean = true;
	savingStatusId: string | null = null;
	sendingAnnouncement: boolean = false;

	listServiceStatus: any[] = [];
	listAnnouncement: any[] = [];

	newAnnouncement = {
		title: '',
		message: '',
		severity: 'info',
		startsAt: '',
		endsAt: ''
	};

	ngOnInit(): void {
		this.optionMenuService.sendData('adminservices');

		this.loadServiceStatus();
		this.loadAnnouncements();
	}

	loadServiceStatus(): void {
		this.loadingStatus = true;

		this.api.invoke(apiservicestatusgetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			// Copia editable independiente de lo que llegó de la API, para
			// no mutar la respuesta original mientras el admin edita antes
			// de guardar.
			this.listServiceStatus = (apiResponseData.listServiceStatus || []).map((s: any) => ({ ...s }));

			this.loadingStatus = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loadingStatus = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	saveStatus(row: any): void {
		this.savingStatusId = row.idServiceStatus;

		this.api.invoke(apiservicestatusupdate, {
			body: { idServiceStatus: row.idServiceStatus, status: row.status, note: row.note || undefined }
		}).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.savingStatusId = null;

			if(apiResponseData.type === 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: `Estado de "${row.name}" actualizado.` });
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo actualizar el estado.' });
			}

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.savingStatusId = null;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'No se pudo conectar con el servidor.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	loadAnnouncements(): void {
		this.loadingAnnouncements = true;

		this.api.invoke(apiannouncementgetallforadmin).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listAnnouncement = apiResponseData.listAnnouncement || [];
			this.loadingAnnouncements = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loadingAnnouncements = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	get canSubmitAnnouncement(): boolean {
		return this.newAnnouncement.title.trim().length > 0 && this.newAnnouncement.message.trim().length > 0;
	}

	submitAnnouncement(): void {
		if(!this.canSubmitAnnouncement) return;

		this.sendingAnnouncement = true;

		this.api.invoke(apiannouncementinsert, {
			body: {
				title: this.newAnnouncement.title,
				message: this.newAnnouncement.message,
				severity: this.newAnnouncement.severity,
				startsAt: this.newAnnouncement.startsAt || undefined,
				endsAt: this.newAnnouncement.endsAt || undefined
			}
		}).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.sendingAnnouncement = false;

			if(apiResponseData.type === 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: 'Aviso publicado.' });

				this.newAnnouncement = { title: '', message: '', severity: 'info', startsAt: '', endsAt: '' };

				this.loadAnnouncements();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo publicar el aviso.' });
			}

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.sendingAnnouncement = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'No se pudo conectar con el servidor.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	confirmDeactivate(row: any): void {
		this.confirmationService.confirm({
			message: `¿Retirar el aviso "${row.title}"? Dejará de mostrarse a los usuarios.`,
			header: 'Confirmar',
			icon: 'pi pi-exclamation-triangle',
			acceptLabel: 'Retirar',
			rejectLabel: 'Cancelar',
			accept: () => this.deactivateAnnouncement(row)
		});
	}

	private deactivateAnnouncement(row: any): void {
		this.api.invoke(apiannouncementdeactivate, { body: { idAnnouncement: row.idAnnouncement } }).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type === 'success') {
				this.messageService.add({ severity: 'success', summary: 'Correcto', detail: 'Aviso retirado.' });

				this.loadAnnouncements();
			} else {
				this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo retirar el aviso.' });
			}

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'No se pudo conectar con el servidor.' });
		});
	}
}
