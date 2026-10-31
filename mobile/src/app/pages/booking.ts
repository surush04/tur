import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { ApiFailure, ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TPipe, formatTjs } from '../core/i18n';
import { BookingRecord, TourDetail } from '../core/models';
import { BackButton } from '../ui';

function previewTotal(price: string, travelers: number) {
  const [whole, frac = ''] = price.split('.');
  const dirams = BigInt(whole || '0') * 100n + BigInt((frac + '00').slice(0, 2));
  const total = dirams * BigInt(travelers);
  return `${total / 100n}.${(total % 100n).toString().padStart(2, '0')}`;
}

@Component({
  selector: 'app-booking',
  imports: [IonContent, ReactiveFormsModule, TPipe, BackButton, RouterLink],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        <h1 class="display">{{ 'book.title' | t }}</h1>
        @if (tour(); as item) {
          <p>{{ item.title }}</p>
          <form class="stack" [formGroup]="form" (ngSubmit)="submit(item)">
            <label class="lbl">{{ 'tour.dates' | t }}
              <select class="field" formControlName="tourDateId">
                @for (date of item.dates ?? []; track date.id) {
                  <option [value]="date.id">{{ date.startDate }} · {{ 'tour.seats' | t:{ count: date.remaining } }}</option>
                }
              </select>
            </label>
            <label class="lbl">{{ 'book.travelers' | t }}
              <input class="field" type="number" min="1" max="8" formControlName="travelers" (change)="syncNames()" />
            </label>
            <div formArrayName="travelerNames" class="stack">
              @for (name of names.controls; track $index) {
                <label class="lbl">{{ 'book.names' | t }} {{ $index + 1 }}
                  <input class="field" [formControlName]="$index" />
                </label>
              }
            </div>
            <label class="lbl">{{ 'auth.first' | t }}<input class="field" formControlName="contactName" /></label>
            <label class="lbl">{{ 'auth.email' | t }}<input class="field" type="email" formControlName="contactEmail" /></label>
            <label class="lbl">{{ 'book.phone' | t }}<input class="field" formControlName="contactPhone" /></label>
            <label class="lbl">{{ 'book.notes' | t }}<textarea class="field" formControlName="notes"></textarea></label>
            <div class="soft-card"><div class="body">
              <p class="tiny">{{ 'book.breakdown' | t }}</p>
              <p>{{ formatTjs(item.pricePerPerson) }} × {{ form.controls.travelers.value }}</p>
              <h2>{{ formatTjs(total()) }}</h2>
              <p>{{ 'book.noPayment' | t }}</p>
            </div></div>
            @if (error()) { <p class="error-box">{{ error() }}</p> }
            <button class="primary full" type="submit" [disabled]="form.invalid || busy()">{{ 'book.send' | t }}</button>
          </form>
          <a routerLink="/tabs/trips">{{ 'trips.title' | t }}</a>
        }
      </div>
    </ion-content>
  `,
})
export class BookingPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly formatTjs = formatTjs;
  readonly tour = signal<TourDetail | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly form = this.fb.nonNullable.group({
    tourDateId: ['', Validators.required],
    travelers: [1, [Validators.required, Validators.min(1), Validators.max(8)]],
    travelerNames: this.fb.nonNullable.array([this.fb.nonNullable.control('', Validators.required)]),
    contactName: ['', Validators.required],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.required, Validators.minLength(6)]],
    notes: [''],
  });
  readonly total = computed(() => {
    const price = this.tour()?.pricePerPerson;
    if (!price) return '0.00';
    return previewTotal(price, Number(this.form.controls.travelers.value) || 1);
  });

  constructor() {
    const user = this.auth.user();
    if (user) {
      this.form.patchValue({ contactName: `${user.firstName} ${user.lastName}`, contactEmail: user.email });
      this.names.at(0)?.setValue(`${user.firstName} ${user.lastName}`);
    }
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) return;
    this.api.tour(slug).subscribe((tour) => {
      this.tour.set(tour);
      const first = tour.dates?.[0];
      if (first) this.form.controls.tourDateId.setValue(first.id);
    });
  }

  get names() {
    return this.form.controls.travelerNames as FormArray;
  }

  syncNames() {
    const count = Number(this.form.controls.travelers.value) || 1;
    while (this.names.length < count) this.names.push(this.fb.nonNullable.control('', Validators.required));
    while (this.names.length > count) this.names.removeAt(this.names.length - 1);
  }

  submit(item: TourDetail) {
    this.busy.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    this.api.createBooking({
      tourDateId: value.tourDateId,
      travelers: Number(value.travelers),
      contactName: value.contactName,
      contactEmail: value.contactEmail,
      contactPhone: value.contactPhone,
      notes: value.notes,
      travelerNames: value.travelerNames.map((fullName) => ({ fullName })),
    }).subscribe({
      next: (booking) => void this.router.navigate(['/tabs/confirmation', booking.id], { state: { booking } }),
      error: (failure: ApiFailure) => { this.error.set(failure.message); this.busy.set(false); },
    });
    void item;
  }
}

@Component({
  selector: 'app-confirmation',
  imports: [IonContent, RouterLink, TPipe],
  template: `
    <ion-content>
      <div class="page stack">
        <p class="tiny">{{ 'brand.name' | t }}</p>
        <h1 class="display">{{ 'book.reference' | t }}</h1>
        @if (booking(); as item) {
          <h2>{{ item.reference }}</h2>
          <span class="status" [class]="item.status">{{ ('status.' + item.status) | t }}</span>
          <p>{{ item.tour.title }}</p>
          <p>{{ item.startDate }} · {{ item.travelers }}</p>
          <p>{{ formatTjs(item.totalPrice) }}</p>
          <p class="warn">{{ item.paymentNote }}</p>
        }
        <a class="primary full" routerLink="/tabs/trips">{{ 'trips.title' | t }}</a>
      </div>
    </ion-content>
  `,
})
export class ConfirmationPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly formatTjs = formatTjs;
  readonly booking = signal<BookingRecord | null>(null);

  constructor() {
    const state = history.state as { booking?: BookingRecord };
    if (state.booking) this.booking.set(state.booking);
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.api.booking(id).subscribe((row) => this.booking.set(row));
  }
}
