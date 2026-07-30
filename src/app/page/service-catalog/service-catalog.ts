import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Api } from '../../api/api';
import { apicategorygetall } from '../../api/functions';
import { OptionMenuService } from '../../observable/option-menu/option-menu.service';

@Component({
	selector: 'app-service-catalog',
	imports: [CommonModule, RouterModule],
	templateUrl: './service-catalog.html',
	styleUrl: './service-catalog.css',
})

export class ServiceCatalog implements OnInit {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private optionMenuService = inject(OptionMenuService);
	private api = inject(Api);

	loading: boolean = true;
	listCategory: any[] = [];

	ngOnInit(): void {
		this.optionMenuService.sendData('servicecatalog');

		this.api.invoke(apicategorygetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listCategory = apiResponseData.listCategory || [];
			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}
}
