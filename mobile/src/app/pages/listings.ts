import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe, formatTjs } from '../core/i18n';
import { GuideCard, StayCard } from '../core/models';
import { BackButton, Photo } from '../ui';

@Component({
  selector: 'app-stays',
  imports: [IonContent, RouterLink, TPipe, Photo],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="spread"><h1 class="display">{{ 'stay.title' | t }}</h1><a routerLink="/tabs/submit-listing">{{ 'provider.title' | t }}</a></div>
        <form class="search" (submit)="search($event)"><input name="q" [placeholder]="'home.search' | t" /></form>
        @for (stay of rows(); track stay.id) {
          <a class="tour-card" [routerLink]="['/tabs/stay', stay.slug]">
            <div class="media"><app-photo [src]="stay.coverImageUrl" [alt]="stay.name"></app-photo></div>
            <div class="body">
              <h3>{{ stay.name }}</h3>
              <p class="muted">{{ i18n.region(stay.region ?? '') }}</p>
              <span class="chip">{{ 'common.unverified' | t }}</span>
              @if (stay.priceRangeMin) { <span class="chip">{{ formatTjs(stay.priceRangeMin) }}</span> }
            </div>
          </a>
        }
      </div>
    </ion-content>
  `,
})
export class StaysPage {
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly formatTjs = formatTjs;
  readonly rows = signal<StayCard[]>([]);
  constructor() { this.api.stays().subscribe((rows) => this.rows.set(rows)); }
  search(event: Event) {
    event.preventDefault();
    const q = String(new FormData(event.target as HTMLFormElement).get('q') ?? '');
    this.api.stays(q).subscribe((rows) => this.rows.set(rows));
  }
}

@Component({
  selector: 'app-stay',
  imports: [IonContent, TPipe, Photo, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        @if (item(); as stay) {
          <div class="shot" style="height:240px;border-radius:24px;overflow:hidden"><app-photo [src]="stay.coverImageUrl" [alt]="stay.name"></app-photo></div>
          <span class="chip">{{ 'common.unverified' | t }}</span>
          <h1 class="display">{{ stay.name }}</h1>
          <p>{{ stay.description || stay.summary }}</p>
          <p class="muted">{{ stay.priceNote }}</p>
          @if (stay.contactEmail) { <p>{{ stay.contactEmail }}</p> } @else { <p class="notice">{{ 'common.signIn' | t }}</p> }
          <button class="ghost" type="button" (click)="favorites.toggle('stay', stay.id)">{{ 'common.save' | t }}</button>
          @for (review of stay.reviews ?? []; track review.id) { <article class="day"><strong>{{ review.author }}</strong><p>{{ review.comment }}</p></article> }
        }
      </div>
    </ion-content>
  `,
})
export class StayPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly favorites = inject(FavoritesService);
  readonly item = signal<StayCard | null>(null);
  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) this.api.stay(slug).subscribe((item) => this.item.set(item));
  }
}

@Component({
  selector: 'app-guides',
  imports: [IonContent, RouterLink, TPipe, Photo],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'guide.title' | t }}</h1>
        <form class="search" (submit)="search($event)"><input name="q" [placeholder]="'home.search' | t" /></form>
        @for (guide of rows(); track guide.id) {
          <a class="tour-card" [routerLink]="['/tabs/guide', guide.id]">
            <div class="media"><app-photo [src]="guide.coverImageUrl" [alt]="guide.displayName"></app-photo></div>
            <div class="body">
              <h3>{{ guide.displayName }}</h3>
              <p class="muted">{{ guide.region }} · {{ guide.kind }}</p>
              <span class="chip">{{ 'common.unverified' | t }}</span>
            </div>
          </a>
        }
      </div>
    </ion-content>
  `,
})
export class GuidesPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<GuideCard[]>([]);
  constructor() { this.api.guides().subscribe((rows) => this.rows.set(rows)); }
  search(event: Event) {
    event.preventDefault();
    const q = String(new FormData(event.target as HTMLFormElement).get('q') ?? '');
    this.api.guides(q).subscribe((rows) => this.rows.set(rows));
  }
}

@Component({
  selector: 'app-guide',
  imports: [IonContent, TPipe, BackButton, Photo],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        @if (item(); as guide) {
          <div class="shot" style="height:200px;border-radius:24px;overflow:hidden"><app-photo [src]="guide.coverImageUrl" [alt]="guide.displayName"></app-photo></div>
          <span class="chip">{{ 'common.unverified' | t }}</span>
          <h1 class="display">{{ guide.displayName }}</h1>
          <p>{{ guide.bio }}</p>
          <p class="muted">{{ guide.priceNote }}</p>
          <div class="chips">@for (item of guide.services ?? guide.specialties ?? []; track item) { <span class="chip">{{ item }}</span> }</div>
          @if (guide.contactEmail) { <p>{{ guide.contactEmail }}</p> }
          <button class="ghost" type="button" (click)="favorites.toggle('guide', guide.id)">{{ 'common.save' | t }}</button>
        }
      </div>
    </ion-content>
  `,
})
export class GuidePage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly favorites = inject(FavoritesService);
  readonly item = signal<GuideCard | null>(null);
  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.api.guide(id).subscribe((item) => this.item.set(item));
  }
}

@Component({
  selector: 'app-submit-listing',
  imports: [IonContent, ReactiveFormsModule, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        <h1 class="display">{{ 'provider.title' | t }}</h1>
        <p class="warn">{{ 'common.unverified' | t }}</p>
        <form class="stack" [formGroup]="form" (ngSubmit)="submit()">
          <select class="field" formControlName="kind">
            <option value="ACCOMMODATION">Stay</option>
            <option value="GUIDE">Guide</option>
            <option value="DRIVER">Driver</option>
            <option value="ACTIVITY">Activity</option>
          </select>
          <input class="field" formControlName="name" placeholder="Name" />
          <input class="field" formControlName="region" placeholder="Region code" />
          <textarea class="field" formControlName="description"></textarea>
          <input class="field" formControlName="contactEmail" placeholder="Email" />
          <input class="field" formControlName="services" placeholder="services, comma separated" />
          <button class="primary" type="submit">{{ 'common.save' | t }}</button>
        </form>
        @if (sent()) { <p class="notice">{{ 'provider.sent' | t }}</p> }
      </div>
    </ion-content>
  `,
})
export class SubmitListingPage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly sent = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    kind: ['ACCOMMODATION', Validators.required],
    name: ['', Validators.required],
    region: ['DUSHANBE', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    contactEmail: [this.auth.user()?.email ?? '', [Validators.required, Validators.email]],
    services: ['breakfast'],
  });

  submit() {
    const value = this.form.getRawValue();
    this.api.submitListing({ ...value, services: value.services.split(',').map((item) => item.trim()) }).subscribe(() => this.sent.set(true));
  }
}
