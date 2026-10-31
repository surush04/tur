import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { ApiFailure, ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TPipe, formatTjs } from '../core/i18n';
import { BackButton } from '../ui';

interface CompanionCard {
  id: string;
  title: string;
  destinationName: string;
  region: string;
  startDate: string;
  endDate: string;
  interests: string[];
  budgetEstimate: string | null;
  companionsWanted: number;
  status: string;
  isHost?: boolean;
  host?: { displayName: string };
  safetyNote?: string;
  description?: string;
  requests?: { id: string; status: string; message?: string; firstName: string }[];
}

@Component({
  selector: 'app-companions',
  imports: [IonContent, ReactiveFormsModule, RouterLink, TPipe],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'comp.title' | t }}</h1>
        <p class="warn">{{ 'comp.warn' | t }}</p>
        @if (auth.user()) {
          <form class="stack" [formGroup]="form" (ngSubmit)="create()">
            <h2>{{ 'comp.create' | t }}</h2>
            <input class="field" formControlName="title" placeholder="Title" />
            <input class="field" formControlName="destinationName" placeholder="Destination" />
            <input class="field" formControlName="region" placeholder="SUGHD" />
            <div class="grid-2">
              <input class="field" type="date" formControlName="startDate" />
              <input class="field" type="date" formControlName="endDate" />
            </div>
            <input class="field" formControlName="interests" placeholder="lakes, photography" />
            <input class="field" formControlName="budgetEstimate" placeholder="800" />
            <input class="field" type="number" formControlName="companionsWanted" />
            <textarea class="field" formControlName="description"></textarea>
            <button class="primary" type="submit">{{ 'comp.create' | t }}</button>
          </form>
        } @else {
          <a routerLink="/login">{{ 'common.signIn' | t }}</a>
        }
        @if (error()) { <p class="error-box">{{ error() }}</p> }
        @if (!rows().length) { <div class="empty">{{ 'comp.empty' | t }}</div> }
        @for (row of rows(); track row.id) {
          <a class="soft-card" [routerLink]="['/tabs/companion', row.id]"><div class="body">
            <h3>{{ row.title }}</h3>
            <p>{{ row.destinationName }} · {{ row.startDate }}</p>
            <p class="muted">{{ row.host?.displayName }}</p>
            <span class="chip">{{ 'comp.wanted' | t:{ count: row.companionsWanted } }}</span>
            @if (row.budgetEstimate) { <span class="chip">{{ formatTjs(row.budgetEstimate) }}</span> }
          </div></a>
        }
      </div>
    </ion-content>
  `,
})
export class CompanionsPage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly formatTjs = formatTjs;
  readonly rows = signal<CompanionCard[]>([]);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    title: ['Weekend lakes', Validators.required],
    destinationName: ['Iskanderkul Lake', Validators.required],
    region: ['SUGHD', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    interests: ['lakes, photography'],
    budgetEstimate: ['800'],
    companionsWanted: [2, Validators.required],
    description: ['Sharing a car. Please do not include a phone number.', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {
    this.reload();
  }

  reload() {
    this.api.companions().subscribe((rows) => this.rows.set(rows as unknown as CompanionCard[]));
  }

  create() {
    const value = this.form.getRawValue();
    this.api.createCompanion({
      ...value,
      companionsWanted: Number(value.companionsWanted),
      interests: value.interests.split(',').map((item) => item.trim()),
      budgetEstimate: value.budgetEstimate || undefined,
    }).subscribe({
      next: () => { this.error.set(''); this.reload(); },
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }
}

@Component({
  selector: 'app-companion-detail',
  imports: [IonContent, TPipe, BackButton, ReactiveFormsModule],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        @if (item(); as trip) {
          <h1 class="display">{{ trip.title }}</h1>
          <p class="warn">{{ trip.safetyNote }}</p>
          <p>{{ trip.destinationName }} · {{ trip.startDate }} – {{ trip.endDate }}</p>
          <p>{{ trip.description }}</p>
          <p>{{ trip.host?.displayName }}</p>
          @if (!trip.isHost && auth.user()) {
            <textarea class="field" [value]="message()" (input)="message.set($any($event.target).value)"></textarea>
            <button class="primary" type="button" (click)="join(trip.id)">{{ 'comp.join' | t }}</button>
            <button class="ghost" type="button" (click)="report()">{{ 'comp.report' | t }}</button>
            <button class="ghost" type="button" (click)="block()">{{ 'comp.block' | t }}</button>
          }
          @if (trip.isHost) {
            <button class="ghost" type="button" (click)="cancel(trip.id)">{{ 'comp.cancel' | t }}</button>
            @for (request of trip.requests ?? []; track request.id) {
              <article class="day">
                <strong>{{ request.firstName }} · {{ request.status }}</strong>
                <p>{{ request.message }}</p>
                @if (request.status === 'PENDING') {
                  <button class="primary" type="button" (click)="decide(trip.id, request.id, 'ACCEPTED')">{{ 'comp.accept' | t }}</button>
                  <button class="ghost" type="button" (click)="decide(trip.id, request.id, 'REJECTED')">{{ 'comp.reject' | t }}</button>
                }
              </article>
            }
          }
          @if (note()) { <p class="notice">{{ note() }}</p> }
        }
      </div>
    </ion-content>
  `,
})
export class CompanionDetailPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly item = signal<CompanionCard | null>(null);
  readonly message = signal('');
  readonly note = signal('');
  private hostId = '';

  constructor() {
    this.reload();
  }

  reload() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api.companion(id).subscribe((row) => {
      const trip = row as unknown as CompanionCard & { hostId?: string };
      this.item.set(trip);
      this.hostId = String((row as { hostId?: string }).hostId ?? '');
    });
  }

  join(id: string) {
    this.api.joinCompanion(id, this.message()).subscribe({
      next: () => this.note.set('Request sent. Your email and phone stay private.'),
      error: (failure: ApiFailure) => this.note.set(failure.message),
    });
  }

  decide(id: string, requestId: string, status: 'ACCEPTED' | 'REJECTED') {
    this.api.decideCompanion(id, requestId, status).subscribe(() => this.reload());
  }

  cancel(id: string) {
    this.api.cancelCompanion(id).subscribe(() => this.reload());
  }

  report() {
    if (!this.hostId) return;
    const reason = window.prompt('Why are you reporting this invitation?') ?? '';
    if (reason.length < 3) return;
    this.api.reportUser(this.hostId, reason).subscribe(() => this.note.set('Report sent to moderators.'));
  }

  block() {
    if (!this.hostId) return;
    this.api.blockUser(this.hostId).subscribe(() => this.note.set('Blocked. You will not see each other’s invitations.'));
  }
}
