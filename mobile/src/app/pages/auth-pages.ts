import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService, readAuthError } from '../core/auth.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe } from '../core/i18n';

function safeReturn(route: ActivatedRoute, fallback: string) {
  const value = route.snapshot.queryParamMap.get('returnUrl') ?? '';
  return value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

function goTo(path: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  window.location.assign(qs ? `${path}?${qs}` : path);
}

function withReturn(route: ActivatedRoute): Record<string, string> {
  const value = route.snapshot.queryParamMap.get('returnUrl') ?? '';
  return value.startsWith('/') && !value.startsWith('//') ? { returnUrl: value } : {};
}

@Component({
  selector: 'app-login',
  imports: [IonContent, IonIcon, ReactiveFormsModule, TPipe],
  template: `
    <ion-content>
      <div class="page auth">
        <button class="back-link" type="button" (click)="leave()"><ion-icon name="chevron-back"></ion-icon>{{ 'common.back' | t }}</button>
        <header class="auth-head">
          <p class="tiny">{{ 'brand.name' | t }}</p>
          <h1 class="display">{{ 'auth.login' | t }}</h1>
          <p class="muted">{{ 'auth.loginLead' | t }}</p>
        </header>
        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          <label class="lbl">{{ 'auth.email' | t }}
            <span class="field"><ion-icon name="mail-outline" aria-hidden="true"></ion-icon><input type="email" formControlName="email" autocomplete="username" /></span>
          </label>
          <label class="lbl">{{ 'auth.password' | t }}
            <span class="field">
              <ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon>
              <input [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" />
              <button class="peek" type="button" (click)="show.set(!show())" [attr.aria-label]="(show() ? 'auth.hide' : 'auth.show') | t"><ion-icon [name]="show() ? 'eye-off-outline' : 'eye-outline'"></ion-icon></button>
            </span>
          </label>
          <p class="hint">{{ 'auth.passwordHint' | t }}</p>
          <button class="linkish" type="button" (click)="go('/forgot')">{{ 'auth.forgot' | t }}</button>
          @if (error()) { <p class="error-box">{{ error() }}</p> }
          <button class="primary full" type="submit" [disabled]="form.invalid || busy()">{{ 'auth.login' | t }}</button>
        </form>
        <div class="auth-switch">
          <p class="muted">{{ 'auth.noAccount' | t }}</p>
          <button class="ghost full" type="button" (click)="go('/register')">{{ 'auth.register' | t }}</button>
        </div>
      </div>
    </ion-content>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly favs = inject(FavoritesService);
  private readonly route = inject(ActivatedRoute);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly show = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(200)]],
  });

  leave() {
    goTo(safeReturn(this.route, '/tabs/home'));
  }

  go(path: string) {
    goTo(path, withReturn(this.route));
  }

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.form.controls.email.value, this.form.controls.password.value);
      await this.favs.mergeLocal();
      goTo(safeReturn(this.route, '/tabs/profile'));
    } catch (error) {
      this.error.set(readAuthError(error));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-register',
  imports: [IonContent, IonIcon, ReactiveFormsModule, TPipe],
  template: `
    <ion-content>
      <div class="page auth">
        <button class="back-link" type="button" (click)="leave()"><ion-icon name="chevron-back"></ion-icon>{{ 'common.back' | t }}</button>
        @if (!kind()) {
          <header class="auth-head">
            <p class="tiny">{{ 'brand.name' | t }}</p>
            <h1 class="display">{{ 'auth.register' | t }}</h1>
            <p class="muted">{{ 'auth.kindLead' | t }}</p>
          </header>
          <div class="auth-kinds">
            <button class="kind" type="button" (click)="kind.set('traveler')">
              <strong>{{ 'auth.traveler' | t }}</strong>
              <span>{{ 'auth.travelerLead' | t }}</span>
            </button>
            <button class="kind" type="button" (click)="kind.set('company')">
              <strong>{{ 'auth.company' | t }}</strong>
              <span>{{ 'auth.companyLead' | t }}</span>
            </button>
          </div>
        } @else {
        <header class="auth-head">
          <p class="tiny">{{ 'brand.name' | t }}</p>
          <h1 class="display">{{ kind() === 'company' ? ('auth.company' | t) : ('auth.traveler' | t) }}</h1>
          <p class="muted">{{ kind() === 'company' ? ('auth.companyForm' | t) : ('auth.registerLead' | t) }}</p>
        </header>
        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          <div class="grid-2">
            <label class="lbl">{{ (kind() === 'company' ? 'auth.companyName' : 'auth.first') | t }}
              <span class="field"><input formControlName="firstName" autocomplete="organization" /></span>
            </label>
            <label class="lbl">{{ (kind() === 'company' ? 'auth.yourName' : 'auth.last') | t }}
              <span class="field"><input formControlName="lastName" autocomplete="name" /></span>
            </label>
          </div>
          <label class="lbl">{{ 'auth.email' | t }}
            <span class="field"><ion-icon name="mail-outline" aria-hidden="true"></ion-icon><input type="email" formControlName="email" autocomplete="username" /></span>
          </label>
          <label class="lbl">{{ 'auth.password' | t }}
            <span class="field">
              <ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon>
              <input [type]="show() ? 'text' : 'password'" formControlName="password" inputmode="numeric" maxlength="4" autocomplete="new-password" />
              <button class="peek" type="button" (click)="show.set(!show())" [attr.aria-label]="(show() ? 'auth.hide' : 'auth.show') | t"><ion-icon [name]="show() ? 'eye-off-outline' : 'eye-outline'"></ion-icon></button>
            </span>
          </label>
          <p class="hint">{{ 'auth.passwordHint' | t }}</p>
          @if (error()) { <p class="error-box">{{ error() }}</p> }
          <button class="primary full" type="submit" [disabled]="form.invalid || busy()">{{ 'auth.register' | t }}</button>
        </form>
        }
        <div class="auth-switch">
          <p class="muted">{{ 'auth.hasAccount' | t }}</p>
          <button class="ghost full" type="button" (click)="go('/login')">{{ 'auth.login' | t }}</button>
        </div>
      </div>
    </ion-content>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly show = signal(false);
  readonly kind = signal<'' | 'traveler' | 'company'>('');
  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
  });

  leave() {
    if (this.kind()) {
      this.kind.set('');
      return;
    }
    goTo(safeReturn(this.route, '/tabs/home'));
  }

  go(path: string) {
    goTo(path, withReturn(this.route));
  }

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const value = this.form.getRawValue();
      await this.auth.register({ ...value, language: this.i18n.lang() });
      if (this.kind() === 'company') {
        const user = await firstValueFrom(this.api.setMode('owner'));
        this.auth.user.set(user);
        goTo('/tabs/owner');
        return;
      }
      goTo(safeReturn(this.route, '/tabs/home'));
    } catch (error) {
      this.error.set(readAuthError(error));
    } finally {
      this.busy.set(false);
    }
  }
}

@Component({
  selector: 'app-forgot',
  imports: [IonContent, IonIcon, ReactiveFormsModule, TPipe],
  template: `
    <ion-content>
      <div class="page auth">
        <button class="back-link" type="button" (click)="go('/login')"><ion-icon name="chevron-back"></ion-icon>{{ 'auth.login' | t }}</button>
        <header class="auth-head">
          <p class="tiny">{{ 'brand.name' | t }}</p>
          <h1 class="display">{{ 'auth.forgot' | t }}</h1>
          <p class="muted">{{ (step() === 'reset' ? 'auth.resetLead' : 'auth.forgotLead') | t }}</p>
        </header>
        @if (step() === 'done') {
          <p class="notice">{{ message() }}</p>
          <button class="primary full" type="button" (click)="go('/login')">{{ 'auth.login' | t }}</button>
        } @else {
          <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
            @if (step() === 'email') {
              <label class="lbl">{{ 'auth.email' | t }}
                <span class="field"><ion-icon name="mail-outline" aria-hidden="true"></ion-icon><input type="email" formControlName="email" autocomplete="username" /></span>
              </label>
            } @else {
              @if (message()) { <p class="notice">{{ message() }}</p> }
              @if (devToken()) { <p class="warn">{{ 'auth.dev' | t }} {{ devToken() }}</p> }
              <label class="lbl">{{ 'auth.code' | t }}
                <span class="field"><input formControlName="token" autocomplete="one-time-code" /></span>
              </label>
              <label class="lbl">{{ 'auth.newPin' | t }}
                <span class="field">
                  <ion-icon name="lock-closed-outline" aria-hidden="true"></ion-icon>
                  <input [type]="show() ? 'text' : 'password'" formControlName="password" inputmode="numeric" maxlength="4" autocomplete="new-password" />
                  <button class="peek" type="button" (click)="show.set(!show())" [attr.aria-label]="(show() ? 'auth.hide' : 'auth.show') | t"><ion-icon [name]="show() ? 'eye-off-outline' : 'eye-outline'"></ion-icon></button>
                </span>
              </label>
              <p class="hint">{{ 'auth.passwordHint' | t }}</p>
            }
            @if (error()) { <p class="error-box">{{ error() }}</p> }
            <button class="primary full" type="submit" [disabled]="busy() || !ready()">{{ step() === 'email' ? ('auth.send' | t) : ('auth.reset' | t) }}</button>
          </form>
        }
      </div>
    </ion-content>
  `,
})
export class ForgotPage {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  readonly message = signal('');
  readonly devToken = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly show = signal(false);
  readonly step = signal<'email' | 'reset' | 'done'>('email');
  readonly form = inject(FormBuilder).nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    token: [''],
    password: ['', [Validators.pattern(/^\d{4}$/)]],
  });

  ready() {
    const value = this.form.getRawValue();
    if (this.step() === 'email') return this.form.controls.email.valid;
    return value.token.trim().length >= 20 && /^\d{4}$/.test(value.password);
  }

  go(path: string) {
    goTo(path, withReturn(this.route));
  }

  async submit() {
    if (!this.ready()) return;
    this.busy.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    try {
      if (this.step() === 'email') {
        const response = await this.auth.forgot(value.email);
        this.message.set(response.data.message);
        this.devToken.set(response.data.devResetToken ?? '');
        if (response.data.devResetToken) this.form.controls.token.setValue(response.data.devResetToken);
        this.step.set('reset');
        return;
      }
      await this.auth.reset(value.token.trim(), value.password);
      this.message.set(this.i18n.t('auth.updated'));
      this.step.set('done');
    } catch (error) {
      this.error.set(readAuthError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
