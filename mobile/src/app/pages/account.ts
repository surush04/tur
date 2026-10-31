import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { apiOrigin } from '../../environments/environment';
import { ApiFailure, ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService, Lang, TPipe } from '../core/i18n';
import { BackButton } from '../ui';

function mediaUrl(url: string) {
  return url.startsWith('/') ? `${apiOrigin()}${url}` : url;
}

@Component({
  selector: 'app-profile',
  imports: [IonContent, IonIcon, RouterLink, TPipe],
  template: `
    <ion-content>
      <div class="page stack">
        @if (auth.user(); as user) {
          <header class="profile-head">
            <div class="avatar">
              @if (user.avatarUrl) {
                <img [src]="photo(user.avatarUrl)" alt="" />
              } @else {
                {{ user.firstName.slice(0, 1) }}
              }
            </div>
            <h1>{{ user.firstName }} {{ user.lastName }}</h1>
            <p class="muted">{{ user.email }}</p>
            @if (user.city) { <p class="muted">{{ user.city }}</p> }
          </header>
          @if (user.role === 'PROVIDER' || user.role === 'GUIDE' || user.role === 'ADMIN') {
            <nav class="menu">
              <a class="menu-row" routerLink="/tabs/owner"><ion-icon name="business-outline"></ion-icon>{{ 'owner.title' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
              <a class="menu-row" routerLink="/tabs/owner/new"><ion-icon name="add-outline"></ion-icon>{{ 'owner.newTour' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
              <a class="menu-row" routerLink="/tabs/reels/new"><ion-icon name="film-outline"></ion-icon>{{ 'owner.reel' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
              <a class="menu-row" routerLink="/tabs/groups/new"><ion-icon name="people-outline"></ion-icon>{{ 'owner.group' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            </nav>
          } @else {
            <button class="primary full" type="button" (click)="become()">{{ 'owner.become' | t }}</button>
          }
          <div class="quick">
            <a routerLink="/tabs/groups"><ion-icon name="people-outline"></ion-icon>{{ 'profile.groups' | t }}</a>
            <a routerLink="/tabs/reels"><ion-icon name="film-outline"></ion-icon>{{ 'tabs.reels' | t }}</a>
            <a routerLink="/tabs/favorites"><ion-icon name="bookmark-outline"></ion-icon>{{ 'tabs.favorites' | t }}</a>
            <a routerLink="/tabs/trips"><ion-icon name="calendar-outline"></ion-icon>{{ 'trips.title' | t }}</a>
          </div>
          <nav class="menu">
            <a class="menu-row" routerLink="/tabs/profile/edit"><ion-icon name="create-outline"></ion-icon>{{ 'profile.edit' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            <a class="menu-row" routerLink="/tabs/messages"><ion-icon name="chatbubble-ellipses-outline"></ion-icon>{{ 'profile.messages' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            <a class="menu-row" routerLink="/tabs/inquiries"><ion-icon name="mail-outline"></ion-icon>{{ 'profile.inquiries' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            <a class="menu-row" routerLink="/tabs/companions"><ion-icon name="people-outline"></ion-icon>{{ 'comp.title' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
          </nav>
          <nav class="menu">
            <a class="menu-row" routerLink="/tabs/notifications"><ion-icon name="notifications-outline"></ion-icon>{{ 'notif.title' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            <a class="menu-row" routerLink="/tabs/language"><ion-icon name="language-outline"></ion-icon>{{ 'profile.language' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            <a class="menu-row" routerLink="/tabs/settings"><ion-icon name="settings-outline"></ion-icon>{{ 'profile.settings' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            <a class="menu-row" routerLink="/tabs/help"><ion-icon name="help-circle-outline"></ion-icon>{{ 'profile.help' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
          </nav>
          <button class="ghost full" type="button" (click)="logout()">{{ 'profile.logout' | t }}</button>
        } @else {
          <header class="profile-head">
            <div class="avatar">TT</div>
            <h1>{{ 'brand.name' | t }}</h1>
            <p class="muted">{{ 'profile.guest' | t }}</p>
          </header>
          <a class="primary full" routerLink="/login">{{ 'common.signIn' | t }}</a>
          <a class="ghost full" routerLink="/register">{{ 'common.account' | t }}</a>
          <nav class="menu">
            <a class="menu-row" routerLink="/tabs/language"><ion-icon name="language-outline"></ion-icon>{{ 'profile.language' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            <a class="menu-row" routerLink="/tabs/help"><ion-icon name="help-circle-outline"></ion-icon>{{ 'profile.help' | t }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
          </nav>
        }
      </div>
    </ion-content>
  `,
})
export class ProfilePage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly photo = mediaUrl;

  become() {
    this.api.setMode('owner').subscribe((user) => {
      this.auth.user.set(user);
      void this.router.navigateByUrl('/tabs/owner');
    });
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/tabs/home');
  }
}

@Component({
  selector: 'app-edit-profile',
  imports: [IonContent, ReactiveFormsModule, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'profile.edit' | t }}</h1>
        </div>
        <form class="stack" [formGroup]="form" (ngSubmit)="save()">
          <label class="lbl">{{ 'profile.photo' | t }}
            <input type="file" accept="image/jpeg,image/png,image/webp" (change)="pick($event)" />
          </label>
          @if (avatar()) { <img class="photo-pick" [src]="photo(avatar())" alt="" /> }
          <label class="lbl">{{ (company ? 'auth.companyName' : 'auth.first') | t }}<input class="field" formControlName="firstName" /></label>
          <label class="lbl">{{ (company ? 'auth.yourName' : 'auth.last') | t }}<input class="field" formControlName="lastName" /></label>
          <label class="lbl">{{ 'profile.city' | t }}<input class="field" formControlName="city" /></label>
          <label class="lbl">{{ 'profile.bio' | t }}<textarea class="field" formControlName="bio"></textarea></label>
          <label class="lbl">{{ 'profile.interests' | t }}<input class="field" formControlName="interests" /></label>
          <label class="lbl">{{ 'profile.regions' | t }}<input class="field" formControlName="regions" /></label>
          <label class="menu-row"><input type="checkbox" formControlName="showProfilePublicly" /> {{ 'comp.title' | t }}</label>
          <button class="primary full" type="submit" [disabled]="uploading()">{{ 'common.save' | t }}</button>
        </form>
        @if (error()) { <p class="error-box">{{ error() }}</p> }
        @if (saved()) { <p class="notice">{{ 'common.save' | t }}</p> }
      </div>
    </ion-content>
  `,
})
export class EditProfilePage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  readonly saved = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly company = this.auth.user()?.role === 'PROVIDER';
  readonly avatar = signal(this.auth.user()?.avatarUrl ?? '');
  readonly photo = mediaUrl;
  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: [this.auth.user()?.firstName ?? '', Validators.required],
    lastName: [this.auth.user()?.lastName ?? '', Validators.required],
    city: [this.auth.user()?.city ?? ''],
    bio: [this.auth.user()?.bio ?? ''],
    interests: [(this.auth.user()?.interests ?? []).join(', ')],
    regions: [(this.auth.user()?.preferredRegions ?? []).join(', ')],
    showProfilePublicly: [this.auth.user()?.showProfilePublicly ?? false],
  });

  async pick(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.api.uploadMedia(file));
      if (!/^\/uploads\/[a-f0-9]{32}\.(jpe?g|png|webp)$/.test(result.url)) {
        this.error.set(this.i18n.t('profile.photoType'));
        return;
      }
      this.avatar.set(result.url);
    } catch (error) {
      this.error.set((error as ApiFailure).message);
    } finally {
      this.uploading.set(false);
    }
  }

  save() {
    const raw = this.form.getRawValue();
    this.api.updateProfile({
      firstName: raw.firstName,
      lastName: raw.lastName,
      city: raw.city,
      bio: raw.bio,
      showProfilePublicly: raw.showProfilePublicly,
      interests: raw.interests.split(',').map((item) => item.trim()).filter(Boolean),
      preferredRegions: raw.regions.split(',').map((item) => item.trim()).filter(Boolean),
      ...(this.avatar() ? { avatarUrl: this.avatar() } : {}),
    }).subscribe((user) => {
      this.auth.user.set(user);
      this.avatar.set(user.avatarUrl ?? '');
      this.saved.set(true);
    });
  }
}

@Component({
  selector: 'app-settings',
  imports: [IonContent, ReactiveFormsModule, RouterLink, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'profile.settings' | t }}</h1>
        </div>
        @if (auth.user(); as user) {
          <form class="stack" [formGroup]="prefs" (ngSubmit)="savePrefs()">
            <div class="menu">
              <label class="menu-row"><input type="checkbox" formControlName="notifyBookings" /> {{ 'settings.bookings' | t }}</label>
              <label class="menu-row"><input type="checkbox" formControlName="notifyCompanions" /> {{ 'settings.companions' | t }}</label>
              <label class="menu-row"><input type="checkbox" formControlName="notifyMarketing" /> {{ 'settings.marketing' | t }}</label>
            </div>
            <button class="ghost full" type="submit">{{ 'common.save' | t }}</button>
          </form>
          <div class="stack">
            <h2>{{ 'settings.security' | t }}</h2>
            <p class="hint">{{ 'auth.passwordHint' | t }}</p>
            <button class="primary full" type="button" (click)="changePin()">{{ 'auth.changePin' | t }}</button>
          </div>
          @if (message()) { <p class="notice">{{ message() }}</p> }
          <button class="ghost" type="button" (click)="remove()">{{ 'settings.delete' | t }}</button>
        } @else {
          <a routerLink="/login">{{ 'common.signIn' | t }}</a>
        }
      </div>
    </ion-content>
  `,
})
export class SettingsPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  readonly message = signal('');
  readonly prefs = inject(FormBuilder).nonNullable.group({
    notifyBookings: [this.auth.user()?.notifyBookings ?? true],
    notifyCompanions: [this.auth.user()?.notifyCompanions ?? true],
    notifyMarketing: [this.auth.user()?.notifyMarketing ?? false],
  });

  savePrefs() {
    this.api.updateProfile(this.prefs.getRawValue()).subscribe((user) => {
      this.auth.user.set(user);
      this.message.set('Saved');
    });
  }

  changePin() {
    const email = this.auth.user()?.email ?? '';
    window.location.assign(email ? `/forgot?email=${encodeURIComponent(email)}` : '/forgot');
  }

  remove() {
    this.api.requestDeletion().subscribe((result) => this.message.set(result.message));
  }
}

@Component({
  selector: 'app-language',
  imports: [IonContent, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'lang.title' | t }}</h1>
        </div>
        <div class="menu">
          @for (item of langs; track item) {
            <button class="menu-row" type="button" [class.on]="i18n.lang() === item" (click)="choose(item)">{{ ('lang.' + item) | t }}</button>
          }
        </div>
      </div>
    </ion-content>
  `,
})
export class LanguagePage {
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly langs: Lang[] = ['en', 'ru', 'tg'];
  choose(lang: Lang) {
    this.i18n.use(lang);
    if (this.auth.user()) this.api.updateProfile({ language: lang }).subscribe();
  }
}

@Component({
  selector: 'app-help',
  imports: [IonContent, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'help.title' | t }}</h1>
        </div>
        <p>{{ 'help.body' | t }}</p>
        <p class="muted">support@rohi.local</p>
        <p class="warn">{{ 'home.note' | t }}</p>
      </div>
    </ion-content>
  `,
})
export class HelpPage {}

@Component({
  selector: 'app-notifications',
  imports: [IonContent, RouterLink, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'notif.title' | t }}</h1>
        </div>
        @if (!auth.user()) {
          <p>{{ 'notif.sign' | t }}</p>
          <a class="primary" routerLink="/login">{{ 'common.signIn' | t }}</a>
        } @else if (!rows().length) {
          <div class="empty">{{ 'notif.empty' | t }}</div>
        } @else {
          @for (row of rows(); track row.id) {
            <button class="soft-card" type="button" (click)="read(row.id)"><div class="body">
              <h3>{{ row.title }}</h3>
              <p>{{ row.body }}</p>
              @if (!row.readAt) { <span class="chip">New</span> }
            </div></button>
          }
        }
      </div>
    </ion-content>
  `,
})
export class NotificationsPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  readonly rows = signal<{ id: string; title: string; body: string; readAt: string | null }[]>([]);
  constructor() {
    if (this.auth.user()) this.api.notifications().subscribe((rows) => this.rows.set(rows));
  }
  read(id: string) {
    this.api.readNotification(id).subscribe(() => {
      this.rows.update((rows) => rows.map((row) => row.id === id ? { ...row, readAt: new Date().toISOString() } : row));
    });
  }
}
