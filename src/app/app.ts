import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import { DrawerModule } from 'primeng/drawer';
import { PopoverModule } from 'primeng/popover';
import { BadgeModule } from 'primeng/badge';
import { MenuItem, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { OptionMenuService } from './observable/option-menu/option-menu.service';
import { AuthService } from './auth/auth.service';
import { Api } from './api/api';
import { apinotificationgetall, apinotificationmarkread, apinotificationmarkallread } from './api/functions';
import { delay, filter } from 'rxjs';

const DARK_MODE_KEY = 'darkMode';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [
		CommonModule,
		RouterOutlet,
		RouterModule,
		ButtonModule,
		MenuModule,
		AvatarModule,
		DrawerModule,
		PopoverModule,
		BadgeModule,
		ToastModule,
		ConfirmDialogModule
	],
	templateUrl: './app.html',
	styleUrls: ['./app.css']
})
export class App implements OnInit {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private messageService = inject(MessageService);
	private optionMenuService = inject(OptionMenuService);
	private router = inject(Router);
	private authService = inject(AuthService);

	constructor(private api: Api) {}

	isLoginPage: boolean = false;
	fullName: string | null = null;
	role: string | null = null;
	mobileMenuOpen: boolean = false;
	darkMode: boolean = false;

	listNotification: any[] = [];
	unreadCount: number = 0;

	allMenuOptions: any[] = [
		{
			id: '',
			route: '',
			icon: 'home',
			text: 'Inicio',
			active: false,
			roles: ['Solicitante', 'Técnico', 'Administrador OTI']
		},
		{
			id: 'incidentinsert',
			route: '/incident/insert',
			icon: 'plus-circle',
			text: 'Reportar un problema',
			active: false,
			roles: ['Solicitante']
		},
		{
			id: 'incidentlist',
			route: '/incident/list',
			icon: 'list',
			text: 'Incidencias',
			active: false,
			roles: ['Solicitante', 'Técnico', 'Administrador OTI']
		},
		{
			id: 'incidentfollowup',
			route: '/incident/follow-up',
			icon: 'search',
			text: 'Seguimiento',
			active: false,
			roles: ['Solicitante', 'Técnico', 'Administrador OTI']
		},
		{
			id: 'adminservices',
			route: '/admin/services',
			icon: 'shield',
			text: 'Servicios y Avisos',
			active: false,
			roles: ['Administrador OTI']
		},
		{
			id: 'servicecatalog',
			route: '/service-catalog',
			icon: 'th-large',
			text: 'Catálogo de servicios',
			active: false,
			roles: ['Solicitante']
		},
		{
			id: 'servicestatuspage',
			route: '/service-status',
			icon: 'wifi',
			text: 'Estado de servicios',
			active: false,
			roles: ['Solicitante', 'Técnico', 'Administrador OTI']
		},
		{
			id: 'help',
			route: '/help',
			icon: 'question-circle',
			text: 'Ayuda',
			active: false,
			roles: ['Solicitante', 'Técnico', 'Administrador OTI']
		}
	];

	menuOptions: any[] = [];

	profileItems: MenuItem[] = [
		{ label: 'Mi Perfil', icon: 'pi pi-user' },
		{ separator: true },
		{ label: 'Cerrar Sesión', icon: 'pi pi-sign-out', command: () => this.logout() }
	];

	ngOnInit(): void {
		this.isLoginPage = this.router.url.startsWith('/login');
		this.fullName = this.authService.getFullName();
		this.role = this.authService.getRole();
		this.filterMenuByRole();
		this.initDarkMode();

		// Si ya hay sesión activa al recargar la página,
		// rearrancar el timer para que el logout automático funcione
		if(this.authService.isAuthenticated()) {
			this.authService.startSessionTimer();
			this.loadNotifications();
		}

		this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
			this.isLoginPage = event.urlAfterRedirects.startsWith('/login');
			this.fullName = this.authService.getFullName();
			this.role = this.authService.getRole();
			this.mobileMenuOpen = false;
			this.filterMenuByRole();

			if(!this.isLoginPage && this.authService.isAuthenticated()) {
				this.loadNotifications();
			}

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});

		this.optionMenuService.data$().pipe(delay(0)).subscribe({
			next: (response: any) => {
				this.menuOptions.map(x => x.active = false);

				this.menuOptions.every((element: any) => {
					if(element.id == response) {
						element.active = true;

						return false;
					}

					return true;
				});

				this.changeDetectorRef.markForCheck();
				this.changeDetectorRef.detectChanges();
			}
		});
	}

	private filterMenuByRole(): void {
		this.menuOptions = this.allMenuOptions.filter(x => x.roles.includes(this.role));
	}

	// Algunos ítems de menú son compartidos entre roles (ej. la lista de
	// incidencias, que un técnico/admin usa para CUALQUIER ticket) pero el
	// Solicitante los entiende mejor en su propio lenguaje ("Mis
	// solicitudes" en vez de "Incidencias"). En vez de duplicar el ítem de
	// menú por rol, se traduce el texto acá para los casos puntuales donde
	// aplica.
	navLabel(item: any): string {
		if(this.role !== 'Solicitante') return item.text;

		const overrides: Record<string, string> = {
			'incidentlist': 'Mis solicitudes',
			'incidentfollowup': 'Ver mi solicitud'
		};

		return overrides[item.id] || item.text;
	}

	private initDarkMode(): void {
		const saved = localStorage.getItem(DARK_MODE_KEY);

		// Si el usuario nunca eligió, respeta la preferencia del sistema operativo/navegador.
		const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

		this.darkMode = saved !== null ? saved === '1' : prefersDark;

		this.applyDarkMode();
	}

	toggleDarkMode(): void {
		this.darkMode = !this.darkMode;

		localStorage.setItem(DARK_MODE_KEY, this.darkMode ? '1' : '0');

		this.applyDarkMode();
	}

	private applyDarkMode(): void {
		document.documentElement.classList.toggle('my-app-dark', this.darkMode);
	}

	loadNotifications(): void {
		this.api.invoke(apinotificationgetall).then((response: any) => {
			const apiResponseData = typeof response === 'string' ? JSON.parse(response) : response;

			if(apiResponseData.type == 'success') {
				this.listNotification = apiResponseData.listNotification || [];
				this.unreadCount = apiResponseData.unreadCount || 0;
			}

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch(() => { /* silencioso: no bloquea el resto de la app */ });
	}

	openNotification(notification: any): void {
		if(!notification.read) {
			notification.read = true;
			this.unreadCount = Math.max(0, this.unreadCount - 1);

			this.api.invoke(apinotificationmarkread, { body: { idHistory: notification.idHistory } }).catch(() => {});
		}

		// Los mensajes directos entre Admin OTI/Técnico (ver help.ts,
		// "Contactar a un colega") no tienen incidencia asociada — no hay
		// a dónde navegar, solo se marcan como leídos.
		if(!notification.ticketCode) return;

		this.router.navigate(['/incident/follow-up'], { queryParams: { code: notification.ticketCode } });
	}

	markAllNotificationsRead(): void {
		if(this.unreadCount === 0) return;

		this.listNotification.forEach(n => n.read = true);
		this.unreadCount = 0;

		this.api.invoke(apinotificationmarkallread).catch(() => {});

		this.changeDetectorRef.markForCheck();
		this.changeDetectorRef.detectChanges();
	}

	logout(): void {
		this.messageService.add({ severity: 'info', summary: 'Correcto!', detail: 'Sesión cerrada correctamente.', life: 5000 });

		this.listNotification = [];
		this.unreadCount = 0;

		this.authService.logout();
	}
}