import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { I18nService } from './i18n';

export const langInterceptor: HttpInterceptorFn = (req, next) => {
  const i18n = inject(I18nService);
  return next(req.clone({ setHeaders: { 'Accept-Language': i18n.lang() } }));
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => error);
      }
      return from(auth.refresh()).pipe(
        switchMap(() => next(req.clone({ setHeaders: { Authorization: `Bearer ${auth.accessToken() ?? ''}` } }))),
        catchError((refreshError: unknown) => {
          auth.clear();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
