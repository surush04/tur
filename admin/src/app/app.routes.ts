import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import {
  BookingsPage,
  CompanionsAdminPage,
  DashboardPage,
  DestinationsPage,
  ListingsPage,
  LoginPage,
  ReportsPage,
  ReviewsPage,
  ShellPage,
  ToursPage,
  UsersPage,
} from './admin';
import { ModerationPage } from './moderation';

const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return sessionStorage.getItem('rohi_admin_access') ? true : router.createUrlTree(['/login']);
};

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  {
    path: '',
    component: ShellPage,
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPage },
      { path: 'destinations', component: DestinationsPage },
      { path: 'tours', component: ToursPage },
      { path: 'bookings', component: BookingsPage },
      { path: 'users', component: UsersPage },
      { path: 'listings', component: ListingsPage },
      { path: 'companions', component: CompanionsAdminPage },
      { path: 'reviews', component: ReviewsPage },
      { path: 'reports', component: ReportsPage },
      { path: 'moderation', component: ModerationPage },
    ],
  },
];
