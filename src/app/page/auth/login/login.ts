import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../auth/auth.service';

@Component({
	selector: 'app-login',
	imports: [
		CommonModule,
		ReactiveFormsModule,
		ButtonModule,
		InputTextModule,
		PasswordModule
	],
	templateUrl: './login.html',
	styleUrl: './login.css',
})

export class Login {
	private changeDetectorRef = inject(ChangeDetectorRef);
	private messageService = inject(MessageService);
	private router = inject(Router);
	private formBuilder = inject(FormBuilder);

	loading: boolean = false;

	// No existe un flujo de recuperación de contraseña self-service en el
	// backend todavía — en vez de simular uno que no funciona, se muestra
	// esta nota explicando el camino real (contactar a la OTI). Si en el
	// futuro se construye el flujo real, este panel se reemplaza por el
	// formulario correspondiente.
	showRecoveryInfo: boolean = false;

	toggleRecoveryInfo(): void {
		this.showRecoveryInfo = !this.showRecoveryInfo;
	}

	form: FormGroup = this.formBuilder.group({
		email: ['', [Validators.required, Validators.email]],
		password: ['', [Validators.required]]
	});

	constructor(
		private authService: AuthService
	) {}

	get emailFb() {
		return this.form.get('email')!;
	}

	get passwordFb() {
		return this.form.get('password')!;
	}

	submit(): void {
		if(this.form.invalid) {
			this.form.markAllAsTouched();

			return;
		}

		this.loading = true;

		this.authService.login(this.emailFb.value, this.passwordFb.value).then((response: any) => {
			this.loading = false;

			switch(response.type) {
				case 'success':
					this.router.navigate(['/']);

					break;

				case 'error':
					this.messageService.add({ severity: 'error', summary: 'Error', detail: response.listMessage?.[0] || 'No se pudo iniciar sesión.' });

					break;

				default:
					this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'Algo ocurrió mal.' });

					break;
			}

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		}).catch((error: any) => {
			this.loading = false;

			this.messageService.add({ severity: 'error', summary: 'Exception', detail: 'No se pudo conectar con el servidor.' });

			this.changeDetectorRef.markForCheck();
			this.changeDetectorRef.detectChanges();
		});
	}
}
