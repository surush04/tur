import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TPipe, formatTjs } from '../core/i18n';
import { BookingRecord } from '../core/models';
import { BackButton, Photo } from '../ui';

@Component({
  selector: 'app-trips',
  imports: [IonContent, RouterLink, TPipe, Photo],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'trips.title' | t }}</h1>
        @if (!auth.user()) {
          <div class="empty stack">
            <p>{{ 'trips.guest' | t }}</p>
            <a class="primary" routerLink="/login" [queryParams]="{ returnUrl: '/tabs/trips' }">{{ 'common.signIn' | t }}</a>
          </div>
        } @else if (loading()) {
          <div class="skel" style="height:140px"></div>
        } @else if (failed()) {
          <div class="error-box stack"><p>{{ 'common.offline' | t }}</p><button class="primary" type="button" (click)="load()">{{ 'common.retry' | t }}</button></div>
        } @else if (!rows().length) {
          <div class="empty">{{ 'trips.empty' | t }}</div>
        } @else {
          @for (item of rows(); track item.id) {
            <a class="tour-card" [routerLink]="['/tabs/trips', item.id]">
              <div class="media"><app-photo [src]="item.tour.coverImageUrl" [alt]="item.tour.title"></app-photo></div>
              <div class="body">
                <span class="status" [class]="item.status">{{ ('status.' + item.status) | t }}</span>
                <h3>{{ item.tour.title }}</h3>
                <p class="muted">{{ item.reference }} · {{ item.startDate }}</p>
                <p>{{ formatTjs(item.totalPrice) }}</p>
              </div>
            </a>
          }
        }
      </div>
    </ion-content>
  `,
})
export class TripsPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  readonly formatTjs = formatTjs;
  readonly rows = signal<BookingRecord[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly upcoming = computed(() => this.rows().filter((row) => row.status === 'PENDING' || row.status === 'CONFIRMED'));

  constructor() {
    if (this.auth.user()) this.load();
  }

  load() {
    this.loading.set(true);
    this.api.bookings().subscribe({
      next: (rows) => { this.rows.set(rows); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }
}

@Component({
  selector: 'app-trip-detail',
  imports: [IonContent, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        @if (item(); as booking) {
          <span class="status" [class]="booking.status">{{ ('status.' + booking.status) | t }}</span>
          <h1 class="display">{{ booking.reference }}</h1>
          <p>{{ booking.tour.title }} · {{ booking.tour.destinationName }}</p>
          <p>{{ booking.startDate }} – {{ booking.endDate }}</p>
          <p>{{ formatTjs(booking.pricePerPerson) }} × {{ booking.travelers }} = {{ formatTjs(booking.totalPrice) }}</p>
          <p class="warn">{{ booking.paymentNote }}</p>
          <p>{{ booking.contactName }} · {{ booking.contactPhone }}</p>
          <ul>@for (name of booking.travelerNames; track name) { <li>{{ name }}</li> }</ul>
          @if (booking.status === 'PENDING' || booking.status === 'CONFIRMED') {
            <button class="ghost" type="button" (click)="cancel(booking.id)">{{ 'trips.cancel' | t }}</button>
          }
          @if (message()) { <p class="notice">{{ message() }}</p> }
        }
      </div>
    </ion-content>
  `,
})
export class TripDetailPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly formatTjs = formatTjs;
  readonly item = signal<BookingRecord | null>(null);
  readonly message = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.api.booking(id).subscribe((row) => this.item.set(row));
  }

  cancel(id: string) {
    this.api.cancelBooking(id).subscribe({
      next: (row) => this.item.set(row),
      error: (error: { message: string }) => this.message.set(error.message),
    });
  }
}
