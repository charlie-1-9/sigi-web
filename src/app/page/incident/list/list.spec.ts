import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../auth/auth.service';
import { IncidentList } from './list';
import { testProviders } from '../../../../testing/test-providers';

// Espera a que se resuelvan las promesas pendientes (llamadas al MockApi,
// que simula ~300ms de latencia de red).
function flush(ms = 400): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

describe('IncidentList', () => {
	let authService: AuthService;

	beforeEach(() => {
		localStorage.clear();

		TestBed.configureTestingModule({ providers: testProviders });

		authService = TestBed.inject(AuthService);
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('carga únicamente las incidencias asignadas al técnico autenticado', async () => {
		await authService.login('cmendoza@unamba.edu.pe', '123456');

		const fixture = TestBed.createComponent(IncidentList);

		fixture.detectChanges();

		await flush();

		const component = fixture.componentInstance;

		expect(component.listIncident.length).toBeGreaterThan(0);
		expect(component.listIncident.every((i: any) => !!i.technicianFullName)).toBe(true);
	});

	it('filteredList filtra por texto de búsqueda (ticket o título)', async () => {
		await authService.login('rttito@unamba.edu.pe', '123456');

		const fixture = TestBed.createComponent(IncidentList);

		fixture.detectChanges();

		await flush();

		const component = fixture.componentInstance;
		const total = component.filteredList.length;

		component.search = 'INC-2026-0001';

		expect(component.filteredList.length).toBe(1);
		expect(component.filteredList[0].ticketCode).toBe('INC-2026-0001');

		component.search = 'ticket-que-no-existe-xyz';

		expect(component.filteredList.length).toBe(0);

		component.search = '';

		expect(component.filteredList.length).toBe(total);
	});

	it('filteredList filtra por estado', async () => {
		await authService.login('rttito@unamba.edu.pe', '123456');

		const fixture = TestBed.createComponent(IncidentList);

		fixture.detectChanges();

		await flush();

		const component = fixture.componentInstance;

		component.filterStatus = 'Resuelta';

		expect(component.filteredList.every((i: any) => i.status === 'Resuelta')).toBe(true);

		component.filterStatus = 'Todos';

		expect(component.filteredList.length).toBe(component.listIncident.length);
	});

	it('el técnico puede modificar la prioridad y el estado de una incidencia asignada', async () => {
		await authService.login('cmendoza@unamba.edu.pe', '123456');

		const fixture = TestBed.createComponent(IncidentList);

		fixture.detectChanges();

		await flush();

		const component = fixture.componentInstance;
		const row = component.listIncident[0];
		const previousStatus = row.status;
		const nextStatus = previousStatus === 'En Proceso' ? 'Resuelta' : 'En Proceso';

		component.updateStatus(row, nextStatus);

		await flush(800);

		const updatedRow = component.listIncident.find((i: any) => i.idIncident === row.idIncident);

		expect(updatedRow.status).toBe(nextStatus);
	});
});
