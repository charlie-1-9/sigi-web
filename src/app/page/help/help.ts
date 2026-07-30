import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { Api } from '../../api/api';
import { apiknowledgearticlegetall, apiknowledgearticleregisterview, apicontactgetall, apicontactsendmessage } from '../../api/functions';
import { OptionMenuService } from '../../observable/option-menu/option-menu.service';
import { AuthService } from '../../auth/auth.service';

@Component({
	selector: 'app-help',
	imports: [CommonModule, RouterModule, FormsModule, InputTextModule, TextareaModule, SelectModule, ButtonModule],
	templateUrl: './help.html',
	styleUrl: './help.css',
})

export class Help implements OnInit {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private optionMenuService = inject(OptionMenuService);
	private api = inject(Api);
	private authService = inject(AuthService);

	loading: boolean = true;
	listArticle: any[] = [];
	search: string = '';
	openArticleId: string | null = null;

	role: string | null = null;

	// ── "Contactar a un colega" (Admin OTI <-> Técnico) ────────────────────
	contacts: { idUser: string; fullName: string }[] = [];
	selectedContactId: string | null = null;
	messageText: string = '';
	sendingMessage: boolean = false;
	messageSent: boolean = false;
	sendError: string | null = null;

	ngOnInit(): void {
		this.optionMenuService.sendData('help');

		this.role = this.authService.getRole();

		this.api.invoke(apiknowledgearticlegetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			this.listArticle = apiResponseData.listArticle || [];
			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => {
			this.loading = false;

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});

		if(this.canContactColleague) {
			this.api.invoke(apicontactgetall).then((response: any) => {
				const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

				this.contacts = apiResponseData.listContact || [];

				this.changeDetectorRef.markForCheck();
				this.changeDetectorRef.detectChanges();
			}).catch(() => {
				// Silencioso: si falla, simplemente el selector queda vacío.
			});
		}
	}

	/** Solo Admin OTI y Técnico pueden contactarse entre sí; el Solicitante
	 *  ve en su lugar el botón de "Reportar" (ver help.html). */
	get canContactColleague(): boolean {
		return this.role === 'Administrador OTI' || this.role === 'Técnico';
	}

	get contactLabel(): string {
		return this.role === 'Administrador OTI' ? 'Escribirle a un técnico' : 'Escribirle al administrador OTI';
	}

	sendMessage(): void {
		if(!this.selectedContactId || !this.messageText.trim() || this.sendingMessage) return;

		this.sendingMessage = true;
		this.sendError = null;
		this.messageSent = false;

		this.api.invoke(apicontactsendmessage, { body: { idRecipientUser: this.selectedContactId, message: this.messageText.trim() } })
			.then((response: any) => {
				const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

				this.sendingMessage = false;

				if(apiResponseData?.type === 'error') {
					this.sendError = apiResponseData.listMessage?.[0] || 'No se pudo enviar el mensaje.';
				} else {
					this.messageSent = true;
					this.messageText = '';
					this.selectedContactId = null;
				}

				this.changeDetectorRef.markForCheck();
				this.changeDetectorRef.detectChanges();
			})
			.catch(() => {
				this.sendingMessage = false;
				this.sendError = 'No se pudo enviar el mensaje. Intenta nuevamente.';

				this.changeDetectorRef.markForCheck();
				this.changeDetectorRef.detectChanges();
			});
	}

	get filteredArticles(): any[] {
		const q = this.search.trim().toLowerCase();

		if(!q) return this.listArticle;

		return this.listArticle.filter(a =>
			a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q)
		);
	}

	toggleArticle(article: any): void {
		const opening = this.openArticleId !== article.idArticle;

		this.openArticleId = opening ? article.idArticle : null;

		// Cuenta la vista solo al abrir (no al cerrar), y solo la primera
		// vez que se abre en esta sesión de navegación — una aproximación
		// razonable de "cuántas veces resultó útil este artículo" sin
		// necesitar deduplicar por usuario en el backend.
		if(opening) {
			this.api.invoke(apiknowledgearticleregisterview, { body: { idArticle: article.idArticle } }).catch(() => {
				// Silencioso: es solo una métrica, no debe interrumpir al usuario.
			});
		}
	}
}
