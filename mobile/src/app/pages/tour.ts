import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe, formatTjs } from '../core/i18n';
import { ToastService } from '../core/toast.service';
import { TourDetail } from '../core/models';
import { BackButton, Photo } from '../ui';

@Component({
  selector: 'app-tour',
  imports: [IonContent, IonIcon, RouterLink, ReactiveFormsModule, TPipe, Photo, BackButton],
  template: `
    <ion-content>
      @if (loading()) { <div class="page"><div class="skel skel-hero"></div></div> }
      @else if (failed()) { <div class="page stack"><p class="error-box">{{ message() || ('common.offline' | t) }}</p><button class="primary" type="button" (click)="load()">{{ 'common.retry' | t }}</button></div> }
      @else if (tour(); as item) {
        <div class="tour-hero">
          <app-photo [src]="item.coverImageUrl || item.images?.[0]?.url" [alt]="item.title"></app-photo>
          <div class="tour-hero-tools">
            <app-back [label]="'common.back' | t"></app-back>
            <button class="icon-btn" type="button" (click)="save(item.id)" [attr.aria-label]="'common.save' | t"><ion-icon [name]="favorites.has('tour', item.id) ? 'heart' : 'heart-outline'"></ion-icon></button>
          </div>
        </div>
        <div class="page stack">
          <h1 class="display">{{ item.title }}</h1>
          @if (item.ratingCount) { <p class="stars">{{ item.rating }} · {{ item.ratingCount }}</p> }
          <div class="facts">
            <div><span class="tiny">{{ 'common.catalogPrice' | t }}</span><strong>{{ formatTjs(item.pricePerPerson) }}</strong></div>
            <div><span class="tiny">{{ 'group.destination' | t }}</span><strong>{{ item.destination?.name || item.destinationName }}</strong></div>
            <div><span class="tiny">{{ 'filter.days' | t }}</span><strong>{{ 'common.days' | t:{ count: item.durationDays ?? 1 } }}</strong></div>
          </div>
          @if (item.owner) {
            <p><strong>{{ 'tour.owner' | t }}:</strong> {{ item.owner.name }}</p>
            <span class="chip">{{ 'common.unverified' | t }}</span>
          }
          @if (!auth.user()) { <p class="muted">{{ 'gate.number' | t }}</p> }
          <p>{{ item.description || item.summary }}</p>
          <p class="muted">{{ item.priceNote || ('tour.priceNote' | t) }}</p>
          @if ((item.images ?? []).length > 1) {
            <div class="gallery">
              @for (image of item.images ?? []; track image.url) { <div class="shot"><app-photo [src]="image.url" [alt]="image.alt"></app-photo></div> }
            </div>
          }
          <h2>{{ 'tour.included' | t }}</h2>
          <ul>@for (line of item.included ?? []; track line) { <li>{{ line }}</li> }</ul>
          <h2>{{ 'tour.excluded' | t }}</h2>
          <ul>@for (line of item.excluded ?? []; track line) { <li>{{ line }}</li> }</ul>
          <p><strong>{{ 'tour.meeting' | t }}:</strong> {{ item.meetingPoint }}</p>
          @if (item.guide) {
            <a class="soft-card" [routerLink]="['/tabs/guide', item.guide.id]"><div class="body">
              <p class="tiny">{{ 'tour.guide' | t }}</p>
              <h3>{{ item.guide.displayName }}</h3>
              <p>{{ item.guide.bio }}</p>
              <span class="chip">{{ 'common.unverified' | t }}</span>
            </div></a>
          }
          <h2>{{ 'tour.dates' | t }}</h2>
          @if (!(item.dates ?? []).length) { <p class="empty">{{ 'tour.none' | t }}</p> }
          @for (date of item.dates ?? []; track date.id) {
            <p class="chip">{{ date.startDate }} – {{ date.endDate }} · {{ 'tour.seats' | t:{ count: date.remaining } }}</p>
          }
          <p><strong>{{ 'tour.policy' | t }}:</strong> {{ item.cancellationPolicy }}</p>
          <h2>{{ 'tour.reviews' | t }}</h2>
          @if (!(item.reviews ?? []).length) { <p class="empty">{{ 'review.empty' | t }}</p> }
          @for (review of item.reviews ?? []; track review.id) {
            <article class="day"><strong>{{ review.author }} · {{ review.rating }}/5</strong><p>{{ review.comment }}</p></article>
          }
          @if (auth.user()) {
            <form class="stack" [formGroup]="reviewForm" (ngSubmit)="sendReview(item.id)">
              <label class="lbl">{{ 'review.add' | t }}<input class="field" type="number" min="1" max="5" formControlName="rating" /></label>
              <textarea class="field" formControlName="comment"></textarea>
              <button class="ghost" type="submit">{{ 'review.add' | t }}</button>
            </form>
          }
          <div class="dock">
            @if ((item.dates ?? []).length) {
              <a class="primary" [routerLink]="['/tabs/book', item.slug]">{{ 'tour.book' | t }}</a>
            }
            @if (auth.user()) {
              <button class="primary" type="button" (click)="sheet.set(true)">{{ 'tour.write' | t }}</button>
              <a class="ghost" routerLink="/tabs/groups/new">{{ 'group.create' | t }}</a>
            } @else {
              <a class="primary" routerLink="/register" [queryParams]="{ returnUrl: '/tabs/tour/' + item.slug }">{{ 'common.account' | t }}</a>
            }
          </div>
          @if (sheet() && auth.user()) {
            <div class="sheet-backdrop" (click)="sheet.set(false)"></div>
            <section class="sheet" role="dialog" [attr.aria-label]="'tour.write' | t">
              <div class="spread"><strong>{{ 'tour.write' | t }}</strong><button class="icon-btn" type="button" (click)="sheet.set(false)"><ion-icon name="close-outline"></ion-icon></button></div>
              @if (item.owner?.name) { <p>{{ 'tour.owner' | t }}: {{ item.owner.name }}</p> }
              @if (item.owner?.phone) { <p><strong>{{ 'tour.phone' | t }}:</strong> {{ item.owner.phone }}</p> }
              @if (item.owner?.telegram) {
                <a class="ghost full" [href]="telegram(item.owner.telegram)" target="_blank" rel="noopener"><ion-icon name="paper-plane-outline"></ion-icon>{{ 'tour.telegram' | t }} · {{ item.owner.telegram }}</a>
              }
              @if (item.owner?.whatsapp) {
                @if (whatsapp(item.owner.whatsapp); as link) {
                  <a class="ghost full" [href]="link" target="_blank" rel="noopener"><ion-icon name="logo-whatsapp"></ion-icon>{{ 'tour.whatsapp' | t }}</a>
                } @else {
                  <p>{{ 'tour.whatsapp' | t }}: {{ item.owner.whatsapp }}</p>
                }
              }
              <form class="stack" (submit)="contactOperator($event, item.id)">
                <input class="field" name="body" [placeholder]="'group.contactNote' | t" />
                <button class="primary" type="submit">{{ 'reels.send' | t }}</button>
              </form>
              @if (message()) { <p>{{ message() }}</p> }
            </section>
          }
        </div>
      }
    </ion-content>
  `,
})
export class TourPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly favorites = inject(FavoritesService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  readonly formatTjs = formatTjs;
  readonly tour = signal<TourDetail | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly message = signal('');
  readonly sheet = signal(false);
  readonly reviewForm = inject(FormBuilder).nonNullable.group({
    rating: [5, [Validators.min(1), Validators.max(5)]],
    comment: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    this.route.paramMap.subscribe(() => this.load());
  }

  save(id: string) {
    void this.favorites.toggle('tour', id).then((saved) => { if (saved) this.toast.show(this.i18n.t('toast.saved')); });
  }

  load() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) return;
    this.loading.set(true);
    this.api.tour(slug).subscribe({
      next: (tour) => { this.tour.set(tour); this.loading.set(false); this.failed.set(false); },
      error: (error: { message?: string }) => { this.message.set(error.message ?? ''); this.failed.set(true); this.loading.set(false); },
    });
  }

  sendReview(tourId: string) {
    if (this.reviewForm.invalid) return;
    this.api.review({ tourId, ...this.reviewForm.getRawValue() }).subscribe({ next: () => this.load() });
  }

  telegram(handle: string) {
    const name = handle.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
    return `https://t.me/${encodeURIComponent(name)}`;
  }

  whatsapp(handle: string) {
    if (handle.startsWith('http')) return handle;
    const digits = handle.replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}` : '';
  }

  contactOperator(event: Event, tourId: string) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (body.length < 1) return;
    this.api.messageOperator(tourId, body).subscribe({
      next: (thread) => void this.router.navigate(['/tabs/messages', thread.id]),
      error: (error: { message?: string }) => this.message.set(error.message ?? ''),
    });
  }
}
