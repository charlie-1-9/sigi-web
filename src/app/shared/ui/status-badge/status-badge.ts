import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Colores + ícono por estado técnico (tstatus.name). Vive acá, en el
// componente compartido, para que dejar de repetirse en cada página que
// muestra un estado (list, home, follow-up) — un cambio de paleta se hace
// en un solo lugar.
const STATUS_META: Record<string, { color: string; icon: string }> = {
	'Nueva': { color: '#3b82f6', icon: 'pi-circle-fill' },
	'Pendiente': { color: '#94a3b8', icon: 'pi-clock' },
	'Asignada': { color: '#06b6d4', icon: 'pi-user' },
	'En Proceso': { color: '#f97316', icon: 'pi-spinner' },
	'Resuelta': { color: '#22c55e', icon: 'pi-check-circle' },
	'Cerrada': { color: '#15803d', icon: 'pi-verified' },
	'Cancelada': { color: '#ef4444', icon: 'pi-times-circle' },
	'Reabierta': { color: '#a855f7', icon: 'pi-refresh' }
};

@Component({
	selector: 'app-status-badge',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './status-badge.html',
	styleUrl: './status-badge.css',
})

export class StatusBadge {
	// Nombre de estado tal como viene de la BD (tstatus.name) o de la
	// traducción amigable ya resuelta — el badge no distingue entre
	// ambos, solo necesita el texto a mostrar y de qué color pintarlo.
	@Input({ required: true }) label!: string;

	// Clave para buscar color/ícono por defecto en STATUS_META. Si no se
	// pasa, se usa `label` (funciona bien cuando el texto mostrado ES el
	// nombre técnico; si se muestra un texto traducido, pasar `statusKey`
	// aparte para que igual encuentre el color correcto).
	@Input() statusKey?: string;

	// Permite forzar color/ícono cuando el estado no es uno de los 8
	// conocidos (ej. severidades de aviso: info/warning/critical).
	@Input() colorOverride?: string;
	@Input() iconOverride?: string;

	get resolvedColor(): string {
		if(this.colorOverride) return this.colorOverride;

		return STATUS_META[this.statusKey || this.label]?.color || '#94a3b8';
	}

	get resolvedIcon(): string {
		if(this.iconOverride) return this.iconOverride;

		return STATUS_META[this.statusKey || this.label]?.icon || 'pi-circle-fill';
	}
}
