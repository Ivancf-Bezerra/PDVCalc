import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
    canActivate: [loginGuard],
  },
  {
    path: 'pdv',
    loadComponent: () => import('./features/pdv/pdv.component').then((m) => m.PdvComponent),
    canActivate: [authGuard],
  },
  {
    path: 'precificacao',
    loadComponent: () =>
      import('./features/precificacao/precificacao.component').then((m) => m.PrecificacaoComponent),
    canActivate: [authGuard],
  },
  { path: '', redirectTo: 'pdv', pathMatch: 'full' },
  { path: '**', redirectTo: 'pdv' },
];
