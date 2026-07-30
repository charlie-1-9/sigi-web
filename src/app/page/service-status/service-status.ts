import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Api } from '../../api/api';
import { apiservicestatusgetall } from '../../api/functions';
import { OptionMenuService } from '../../observable/option-menu/option-menu.service';

const STATUS_META: Record<string, { color: string; icon: string; label: string }> = {
	'Operativo': { color: '#22c55e', icon: 'pi-check-circle', label: 'Operativo' },
	'Degradado': { color: '#eab308', icon: 'pi-exclamation-triangle', label: 'Funcionando con lentitud' },
	'Interrumpido': { color: '#ef4444', icon: 'pi-times-circle', label: 'No disponible' }
};

@Component({
	selector: 'app-service-status',
	imports: [CommonModule, RouterModule],
	templateUrl: './service-status.html',
	styleUrl: './service-status.css',
})

export class ServiceStatusPage implements OnInit {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private optionMenuService = inject(OptionMenuService);
	private api = inject(Api);

	STATUS_META = STATUS_META;

	loading: boolean = true;
	listServiceStatus: any[] = [];

	ngOnInit(): void {
		this.optionMenuService.sendData('servicestatuspage');

		this.load();
	}

	load(): void {
		this.loading = true;

		this.api.invoke(apiservicestatusgetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listServiceStatus = apiResponseData.listServiceStatus || [];
			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}

	get allOperational(): boolean {
		return this.listServiceStatus.every(s => s.status === 'Operativo');
	}
}
