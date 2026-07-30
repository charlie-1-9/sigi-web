import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
	selector: 'app-empty-state',
	standalone: true,
	imports: [CommonModule, RouterModule, ButtonModule],
	templateUrl: './empty-state.html',
	styleUrl: './empty-state.css',
})

export class EmptyState {
	@Input() icon: string = 'pi-inbox';
	@Input() message: string = '';
	@Input() hint?: string;
	@Input() actionLabel?: string;
	@Input() actionRoute?: string;
	@Input() actionIcon: string = 'pi-plus';
}
