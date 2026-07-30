import { Routes } from '@angular/router';
import { Login } from './page/auth/login/login';
import { Home } from './page/home/home';
import { IncidentInsert } from './page/incident/insert/insert';
import { IncidentList } from './page/incident/list/list';
import { IncidentFollowUp } from './page/incident/follow-up/follow-up';
import { AdminServices } from './page/admin/services/services';
import { Help } from './page/help/help';
import { ServiceStatusPage } from './page/service-status/service-status';
import { ServiceCatalog } from './page/service-catalog/service-catalog';
import { authGuard } from './auth/auth.guard';
import { roleGuard } from './auth/role.guard';

export const routes: Routes = [
	{ path: 'login', component: Login },
	{ path: '', component: Home, canActivate: [authGuard] },
	{ path: 'incident/insert', component: IncidentInsert, canActivate: [authGuard, roleGuard(['Solicitante'])] },
	{ path: 'incident/list', component: IncidentList, canActivate: [authGuard] },
	{ path: 'incident/follow-up', component: IncidentFollowUp, canActivate: [authGuard] },
	{ path: 'admin/services', component: AdminServices, canActivate: [authGuard, roleGuard(['Administrador OTI'])] },
	{ path: 'help', component: Help, canActivate: [authGuard] },
	{ path: 'service-status', component: ServiceStatusPage, canActivate: [authGuard] },
	{ path: 'service-catalog', component: ServiceCatalog, canActivate: [authGuard, roleGuard(['Solicitante'])] }
];
