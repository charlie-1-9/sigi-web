import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { Api } from '../../../api/api';
import { apicategorygetall, apiprioritygetall, apiincidentinsert, Apiincidentinsert$Params } from '../../../api/functions';
import { ConfirmationService, MessageService } from 'primeng/api';
import { OptionMenuService } from '../../../observable/option-menu/option-menu.service';

@Component({
	selector: 'app-incident-insert',
	imports: [
		CommonModule,
		RouterModule,
		FormsModule,
		ReactiveFormsModule,
		InputTextModule,
		TextareaModule,
		ButtonModule,
		FileUploadModule,
		SelectModule,
		TooltipModule
	],
	templateUrl: './insert.html',
	styleUrl: './insert.css',
})

export class IncidentInsert implements OnInit {
	private confirmationService = inject(ConfirmationService);
	private messageService = inject(MessageService);
	private optionMenuService = inject(OptionMenuService);
	private route = inject(ActivatedRoute);

	frmInsertIncident: FormGroup;
	frmInsertIncidentInitValue: any = {};

	listCategory: any[] = [];
	listPriority: any[] = [];

	fileQuantity: number = 0;
	fileRowList: any[] = [];
	listFile: any[] = [];

	sending: boolean = false;

	// Se muestra en un panel de confirmación fijo (no solo un toast que
	// desaparece) para que el código de ticket quede visible mientras el
	// usuario lo necesite — punto explícito del checklist de accesibilidad.
	submittedTicketCode: string | null = null;

	startNewReport(): void {
		this.submittedTicketCode = null;
	}

	// ── Asistente por pasos ────────────────────────────────────────────────
	// El formulario original era un solo bloque largo; se divide en pasos
	// cortos con progreso visible para que se sienta como un avance real,
	// no como "llenar un formulario". La validación de cada paso solo exige
	// los campos que ese paso contiene, para no bloquear el avance con
	// errores de campos que el usuario todavía no ha visto.
	currentStep: number = 1;
	readonly totalSteps = 4;
	readonly stepLabels: string[] = [
		'¿Qué necesitas?',
		'¿Qué servicio?',
		'Describe el problema',
		'Evidencia y envío'
	];

	get currentStepLabel(): string {
		return this.stepLabels[this.currentStep - 1];
	}

	get canGoNext(): boolean {
		switch(this.currentStep) {
			case 1:
				return this.requestType !== null;
			case 2:
				return this.categoryFb.valid && this.titleFb.valid &&
					this.requiredExtraFields.every(f => (this.extraFieldValues[f.key] || '').trim().length > 0);
			case 3:
				return this.descriptionFb.valid;
			default:
				return true;
		}
	}

	goNext(): void {
		if(!this.canGoNext) {
			// Marca solo los campos del paso actual, para que el mensaje de
			// error apunte a lo que el usuario tiene enfrente.
			const fieldsByStep: Record<number, any[]> = {
				2: [this.categoryFb, this.titleFb],
				3: [this.descriptionFb]
			};

			(fieldsByStep[this.currentStep] || []).forEach(control => {
				control.markAsTouched();
				control.markAsDirty();
			});

			this.extraFieldsTouched = true;

			return;
		}

		if(this.currentStep < this.totalSteps) {
			this.currentStep++;

			this.saveDraft();
		}
	}

	goBack(): void {
		if(this.currentStep > 1) {
			this.currentStep--;
		}
	}

	get categoryFb() { return this.frmInsertIncident.controls['category']; }
	get titleFb() { return this.frmInsertIncident.controls['title']; }
	get descriptionFb() { return this.frmInsertIncident.controls['description']; }
	get locationFb() { return this.frmInsertIncident.controls['location']; }

	get selectedCategory(): any {
		return this.listCategory.find(c => c.idCategory == this.categoryFb.value);
	}

	// ── Paso 1 · Tipo de solicitud ──────────────────────────────────────────
	// No existe todavía un flujo de "solicitud de servicio" separado del de
	// "incidencia" en el backend — ambos crean el mismo tipo de registro.
	// La elección igual se guarda (como parte de extraFields) para que quede
	// visible en el ticket, en vez de ser solo un adorno en el wizard.
	requestType: 'problema' | 'solicitud' | null = null;

	// ── Campos dinámicos por categoría ─────────────────────────────────────
	// Cada categoría define en tcategory.extraFieldsSchema (JSON) qué
	// preguntar además de lo genérico — Wi-Fi pide edificio/aula/
	// dispositivo, correo pide la cuenta afectada, etc. — en vez de mostrar
	// siempre los mismos campos sin importar el problema.
	extraFieldValues: Record<string, string> = {};
	extraFieldsTouched: boolean = false;

	get extraFieldsSchema(): { key: string; label: string; required?: boolean }[] {
		const raw = this.selectedCategory?.extraFieldsSchema;

		if(!raw) return [];

		try {
			return JSON.parse(raw);
		} catch {
			return [];
		}
	}

	get requiredExtraFields() {
		return this.extraFieldsSchema.filter(f => f.required);
	}

	// ── Prioridad calculada, no elegida ─────────────────────────────────────
	// No se le pide al Solicitante un concepto técnico ("prioridad"); se le
	// hacen 3 preguntas en su propio lenguaje y el sistema traduce eso a
	// una prioridad del catálogo. El técnico puede ajustarla después desde
	// el listado, como cualquier otro dato — esto solo define el valor
	// inicial con el que nace la incidencia.
	impactScope: 'solo' | 'grupo' | 'area' | null = null;
	isBlocking: boolean | null = null;
	sinceWhen: 'ahora' | 'horas' | 'dia' | null = null;

	get impactQuestionsAnswered(): boolean {
		return this.impactScope !== null && this.isBlocking !== null && this.sinceWhen !== null;
	}

	// Nombre de prioridad (debe coincidir con tpriority.name: Baja/Media/
	// Alta/Crítica) según las 3 respuestas. La lógica es intencionalmente
	// simple y legible — no un modelo — porque el técnico/admin puede
	// corregirla igual, y lo importante es que el criterio sea explicable.
	get calculatedPriorityName(): string | null {
		if(!this.impactQuestionsAnswered) return null;

		let score = 0;

		score += this.impactScope === 'area' ? 2 : this.impactScope === 'grupo' ? 1 : 0;
		score += this.isBlocking ? 2 : 0;
		score += this.sinceWhen === 'dia' ? 1 : 0;

		if(score >= 5) return 'Crítica';
		if(score >= 3) return 'Alta';
		if(score >= 1) return 'Media';

		return 'Baja';
	}

	get calculatedPriority(): any {
		return this.listPriority.find(p => p.name === this.calculatedPriorityName) || null;
	}

	fileFor(rowId: string): any {
		return this.listFile.find((f: any) => f.name === rowId) || null;
	}

	constructor(
		private formBuilder: FormBuilder,
		private api: Api
	) {
		this.frmInsertIncidentInitValue = {
			'category': '',
			'title': '',
			'description': '',
			'location': ''
		};

		this.frmInsertIncident = this.formBuilder.group({
			'category': [this.frmInsertIncidentInitValue.category, [Validators.required]],
			'title': [this.frmInsertIncidentInitValue.title, [Validators.required, Validators.minLength(5)]],
			'description': [this.frmInsertIncidentInitValue.description, [Validators.required, Validators.minLength(10)]],
			'location': [this.frmInsertIncidentInitValue.location, []]
		});
	}

	ngOnInit(): void {
		this.initialization();
	}

	private readonly DRAFT_KEY = 'incidentInsertDraft';

	private initialization(): void {
		this.optionMenuService.sendData('incidentinsert');

		this.api.invoke(apicategorygetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listCategory = apiResponseData.listCategory || [];

			const preselectedCategory = this.route.snapshot.queryParamMap.get('category');

			if(preselectedCategory && this.listCategory.some(c => c.idCategory === preselectedCategory)) {
				this.categoryFb.setValue(preselectedCategory);
			}
		});

		this.api.invoke(apiprioritygetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listPriority = apiResponseData.listPriority || [];
		});

		this.restoreDraft();
	}

	// ── Borrador ────────────────────────────────────────────────────────────
	// Un formulario de varios pasos que se pierde por completo si el
	// usuario se distrae, cambia de pestaña o su celular recarga la
	// página es frustrante. Se guarda un borrador liviano en cada avance
	// de paso y se limpia solo al enviar con éxito.
	private saveDraft(): void {
		try {
			localStorage.setItem(this.DRAFT_KEY, JSON.stringify({
				currentStep: this.currentStep,
				formValue: this.frmInsertIncident.value,
				extraFieldValues: this.extraFieldValues,
				requestType: this.requestType,
				impactScope: this.impactScope,
				isBlocking: this.isBlocking,
				sinceWhen: this.sinceWhen
			}));
		} catch {
			// localStorage lleno o deshabilitado: perder el borrador no debe
			// romper el formulario, solo se pierde la conveniencia.
		}
	}

	private restoreDraft(): void {
		const raw = localStorage.getItem(this.DRAFT_KEY);

		if(!raw) return;

		try {
			const draft = JSON.parse(raw);

			this.frmInsertIncident.patchValue(draft.formValue || {});
			this.extraFieldValues = draft.extraFieldValues || {};
			this.requestType = draft.requestType ?? null;
			this.impactScope = draft.impactScope ?? null;
			this.isBlocking = draft.isBlocking ?? null;
			this.sinceWhen = draft.sinceWhen ?? null;
			this.currentStep = draft.currentStep || 1;

			this.messageService.add({ severity: 'info', summary: 'Borrador recuperado', detail: 'Retomamos tu solicitud donde la dejaste.' });
		} catch {
			localStorage.removeItem(this.DRAFT_KEY);
		}
	}

	private clearDraft(): void {
		localStorage.removeItem(this.DRAFT_KEY);
	}

	addFile(): void {
		this.fileQuantity++;

		this.fileRowList.push({
			'id': 'file' + this.fileQuantity
		});
	}

	removeFile(element: any): void {
		let positionTemp = this.fileRowList.indexOf(element);

		this.fileRowList.splice(positionTemp, 1);

		this.listFile = this.listFile.filter((value) => value.name != element.id);
	}

	onFileSelect(event: any, name: string): void {
		const file: File = event.currentFiles ? event.currentFiles[0] : event.files[0];

		if(!file) return;

		const reader = new FileReader();

		reader.onload = () => {
			// quita elementos previos con el mismo id de fila (permite reemplazar el archivo)
			this.listFile = this.listFile.filter((value) => value.name != name);

			this.listFile.push({
				name,
				file,
				fileName: file.name,
				mimeType: file.type,
				dataUrl: reader.result as string
			});
		};

		reader.readAsDataURL(file);
	}

	sendInsertIncident(event: Event): void {
		if(!this.frmInsertIncident.valid) {
			this.frmInsertIncident.markAllAsTouched();
			this.frmInsertIncident.markAsDirty();

			this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Complete y corrija todos los datos faltantes.' });

			return;
		}

		this.confirmationService.confirm({
			target: event.target as EventTarget,
			message: '¿Confirmar el registro de esta incidencia?',
			header: 'Confirmación',
			icon: 'pi pi-info-circle',
			rejectLabel: 'Cancelar',
			rejectButtonProps: {
				label: 'Cancelar',
				severity: 'secondary',
				outlined: true
			},
			acceptButtonProps: {
				label: 'Aceptar',
				severity: 'primary'
			},
			accept: () => {
				this.sending = true;

				const files = this.listFile.map((f: any) => f.file).filter((f: File | undefined): f is File => !!f);

				const bodyParams: Apiincidentinsert$Params = {
					body: {
						idCategory: this.categoryFb.value,
						idPriority: this.calculatedPriority?.idPriority,
						title: this.titleFb.value,
						description: this.descriptionFb.value,
						location: this.locationFb.value,
						extraFields: JSON.stringify({ ...this.extraFieldValues, _requestType: this.requestType }),
						files
					}
				};

				this.api.invoke(apiincidentinsert, bodyParams).then((response: any) => {
					const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

					switch(apiResponseData.type) {
						case 'success':
							this.submittedTicketCode = apiResponseData.ticketCode || null;

							this.fileQuantity = 0;
							this.fileRowList = [];
							this.listFile = [];
							this.extraFieldValues = {};
							this.requestType = null;
							this.impactScope = null;
							this.isBlocking = null;
							this.sinceWhen = null;

							this.frmInsertIncident.reset(this.frmInsertIncidentInitValue);
							this.currentStep = 1;
							this.clearDraft();

							break;

						case 'warning':
							this.messageService.add({ severity: 'warn', summary: 'Atención', detail: apiResponseData.listMessage?.[0] || 'Revise los datos ingresados.' });

							break;

						case 'error':
							this.messageService.add({ severity: 'error', summary: 'Error', detail: apiResponseData.listMessage?.[0] || 'No se pudo registrar la incidencia.' });

							break;

						default:
							this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });

							break;
					}

					this.sending = false;
				}).catch(() => {
					this.sending = false;

					this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });
				});
			},
			reject: () => {}
		});
	}
}
