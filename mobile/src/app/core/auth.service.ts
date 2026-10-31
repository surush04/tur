import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionUser } from './models';

interface AuthPayload {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = new HttpClient(inject(HttpBackend));
  readonly user = signal<SessionUser | null>(null);
  readonly accessToken = signal<string | null>(null);
  private refreshToken: string | null = null;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.restore();
  }

  ready() {
    return this.readyPromise;
  }

  async register(body: { email: string; password: string; firstName: string; lastName: string; language: string }) {
    const response = await firstValueFrom(this.http.post<{ data: AuthPayload }>(`${environment.apiUrl}/auth/register`, body));
    await this.persist(response.data);
  }

  async login(email: string, password: string) {
    const response = await firstValueFrom(
      this.http.post<{ data: AuthPayload }>(`${environment.apiUrl}/auth/login`, { email, password }),
    );
    await this.persist(response.data);
  }

  async refresh() {
    if (!this.refreshToken) throw new Error('AUTH');
    const response = await firstValueFrom(
      this.http.post<{ data: AuthPayload }>(`${environment.apiUrl}/auth/refresh`, { refreshToken: this.refreshToken }),
    );
    await this.persist(response.data);
  }

  async logout() {
    const token = this.refreshToken;
    this.clear();
    if (token) {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken: token })).catch(() => undefined);
    }
  }

  async forgot(email: string) {
    return firstValueFrom(this.http.post<{ data: { message: string; devResetToken?: string } }>(`${environment.apiUrl}/auth/forgot`, { email }));
  }

  async reset(token: string, password: string) {
    await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/reset`, { token, password }));
  }

  async changePassword(currentPassword: string, newPassword: string) {
    await firstValueFrom(
      this.http.post(
        `${environment.apiUrl}/auth/change-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${this.accessToken()}` } },
      ),
    );
    this.clear();
  }

  clear() {
    this.user.set(null);
    this.accessToken.set(null);
    this.refreshToken = null;
    if (Capacitor.isNativePlatform()) {
      void Preferences.remove({ key: 'rohi_refresh' });
    } else {
      sessionStorage.removeItem('rohi_refresh');
    }
  }

  private async restore() {
    const stored = Capacitor.isNativePlatform()
      ? (await Preferences.get({ key: 'rohi_refresh' })).value
      : sessionStorage.getItem('rohi_refresh');
    this.refreshToken = stored;
    if (!stored) return;
    try {
      await this.refresh();
    } catch {
      this.clear();
    }
  }

  private async persist(payload: AuthPayload) {
    this.user.set(payload.user);
    this.accessToken.set(payload.accessToken);
    this.refreshToken = payload.refreshToken;
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: 'rohi_refresh', value: payload.refreshToken });
    } else {
      sessionStorage.setItem('rohi_refresh', payload.refreshToken);
    }
  }
}

export function readAuthError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const payload = error.error as { message?: string | string[] } | null;
    if (Array.isArray(payload?.message)) return payload.message.join(' ');
    if (payload?.message) return payload.message;
  }
  return 'Sign-in failed.';
}
