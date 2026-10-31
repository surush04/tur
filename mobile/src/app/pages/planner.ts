import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { ApiFailure, ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TPipe, formatTjs } from '../core/i18n';
import { PlanResult } from '../core/models';
import { BackButton } from '../ui';

@Component({
  selector: 'app-planner',
  imports: [IonContent, ReactiveFormsModule, RouterLink, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        <h1 class="display">{{ 'planner.title' | t }}</h1>
        @if (status() && !status()!.configured) { <p class="warn">{{ 'planner.unconfigured' | t }}</p> }
        <form class="stack" [formGroup]="form" (ngSubmit)="generate(false)">
          <label class="lbl">{{ 'planner.start' | t }}<input class="field" formControlName="startLocation" /></label>
          <label class="lbl">{{ 'planner.region' | t }}
            <select class="field" formControlName="region">
              <option value="">{{ 'common.all' | t }}</option>
              <option value="SUGHD">Sughd</option>
              <option value="DUSHANBE">Dushanbe</option>
              <option value="DRS">DRS</option>
              <option value="KHATLON">Khatlon</option>
              <option value="GBAO">GBAO</option>
            </select>
          </label>
          <div class="grid-2">
            <label class="lbl">{{ 'planner.from' | t }}<input class="field" type="date" formControlName="startDate" /></label>
            <label class="lbl">{{ 'planner.to' | t }}<input class="field" type="date" formControlName="endDate" /></label>
          </div>
          <div class="grid-2">
            <label class="lbl">{{ 'planner.people' | t }}<input class="field" type="number" formControlName="travelers" /></label>
            <label class="lbl">{{ 'planner.budget' | t }}<input class="field" formControlName="budgetTjs" /></label>
          </div>
          <label class="lbl">{{ 'planner.interests' | t }}<input class="field" formControlName="interests" placeholder="lakes, mountains, photography" /></label>
          <label class="lbl">{{ 'planner.style' | t }}<input class="field" formControlName="travelStyle" /></label>
          <label class="lbl">{{ 'planner.transport' | t }}<input class="field" formControlName="transport" /></label>
          <label class="lbl">{{ 'planner.stay' | t }}<input class="field" formControlName="accommodation" /></label>
          <label class="lbl">{{ 'planner.access' | t }}<input class="field" formControlName="accessibility" /></label>
          @if (status()?.configured) { <button class="primary full" type="submit">{{ 'planner.generate' | t }}</button> }
          <button class="sand full" type="button" (click)="generate(true)">{{ 'planner.demoCta' | t }}</button>
        </form>
        @if (error()) { <p class="error-box">{{ error() }}</p> }
        @if (plan(); as item) {
          <article class="stack">
            <p class="chip">{{ item.source === 'DEMO' ? ('planner.demo' | t) : ('planner.live' | t) }}</p>
            <h2>{{ item.title }}</h2>
            <p class="warn">{{ item.disclaimer }}</p>
            @if (item.budgetShortfall && item.alternatives) { <p class="notice"><strong>{{ 'planner.alt' | t }}.</strong> {{ item.alternatives }}</p> }
            @for (day of item.days; track day.dayNumber) {
              <section class="day">
                <h3>{{ day.dayNumber }}. {{ day.title }}</h3>
                <p class="muted">{{ day.notes }}</p>
                @for (activity of day.activities; track activity.sortOrder) {
                  <div class="activity">
                    <strong>{{ activity.title }}</strong>
                    <p>{{ activity.description }}</p>
                    <p class="muted">{{ activity.timeEstimateNote }}</p>
                    <p class="muted">{{ activity.transportNote }}</p>
                    @if (activity.estimatedCost) { <span class="chip">{{ 'common.estimate' | t }} {{ formatTjs(activity.estimatedCost) }}</span> }
                    @if (activity.tourSlug) { <a [routerLink]="['/tabs/tour', activity.tourSlug]">{{ 'planner.book' | t }}</a> }
                  </div>
                }
              </section>
            }
            <p><strong>{{ formatTjs(item.totalEstimate) }}</strong></p>
            <h3>{{ 'planner.packing' | t }}</h3>
            <ul>@for (item of item.packing; track item) { <li>{{ item }}</li> }</ul>
            <ul>@for (note of item.assumptions; track note) { <li>{{ note }}</li> }</ul>
            @if (auth.user()) { <button class="primary" type="button" (click)="save(item)">{{ 'planner.save' | t }}</button> }
            @else { <a routerLink="/login" [queryParams]="{ returnUrl: '/tabs/planner' }">{{ 'common.signIn' | t }}</a> }
            @if (saved()) { <p class="notice">{{ 'planner.saved' | t }}</p> }
          </article>
        }
      </div>
    </ion-content>
  `,
})
export class PlannerPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly formatTjs = formatTjs;
  readonly status = signal<{ configured: boolean } | null>(null);
  readonly plan = signal<PlanResult | null>(null);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    startLocation: ['Dushanbe', Validators.required],
    region: [''],
    startDate: [''],
    endDate: [''],
    travelers: [2, [Validators.required, Validators.min(1)]],
    budgetTjs: ['1500', Validators.required],
    interests: ['lakes, mountains, photography'],
    travelStyle: ['relaxed'],
    transport: ['shared car'],
    accommodation: ['guesthouse'],
    accessibility: [''],
  });

  constructor() {
    this.api.aiStatus().subscribe({
      next: (status) => this.status.set(status),
      error: () => this.status.set({ configured: false }),
    });
  }

  generate(demo: boolean) {
    this.error.set('');
    this.saved.set(false);
    const value = this.form.getRawValue();
    this.api.plan({
      ...value,
      region: value.region || undefined,
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined,
      travelers: Number(value.travelers),
      interests: value.interests.split(',').map((item) => item.trim()).filter(Boolean),
      demo,
    }).subscribe({
      next: (plan) => this.plan.set(plan),
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }

  save(plan: PlanResult) {
    const value = this.form.getRawValue();
    this.api.saveItinerary({
      ...plan,
      startLocation: value.startLocation,
      region: value.region || undefined,
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined,
      travelers: Number(value.travelers),
      budgetTjs: value.budgetTjs,
      interests: value.interests.split(',').map((item) => item.trim()).filter(Boolean),
      travelStyle: value.travelStyle,
      transport: value.transport,
      accommodationPref: value.accommodation,
      accessibility: value.accessibility,
      budgetShortfall: Boolean(plan.budgetShortfall),
    }).subscribe({
      next: (saved) => {
        this.saved.set(true);
        void this.router.navigate(['/tabs/itinerary', saved.id]);
      },
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }
}

@Component({
  selector: 'app-itinerary',
  imports: [IonContent, TPipe, BackButton, RouterLink],
  template: `
    <ion-content>
      <div class="page stack">
        <app-back [label]="'common.back' | t"></app-back>
        @if (plan(); as item) {
          <p class="chip">{{ item.source }}</p>
          <h1 class="display">{{ item.title }}</h1>
          <p class="warn">{{ item.disclaimer }}</p>
          <label class="lbl">{{ 'planner.budget' | t }}
            <input class="field" [value]="budget()" (change)="budget.set($any($event.target).value)" />
          </label>
          @for (day of item.days; track day.dayNumber) {
            <section class="day">
              <h3>{{ day.title }}</h3>
              @for (activity of day.activities; track activity.id) {
                <div class="activity">
                  <strong>{{ activity.title }}</strong>
                  <p>{{ activity.description }}</p>
                  <p class="muted">{{ activity.timeEstimateNote }}</p>
                  @if (activity.estimatedCost) { <span class="chip">{{ formatTjs(activity.estimatedCost) }}</span> }
                  @if (activity.tourSlug) { <a [routerLink]="['/tabs/tour', activity.tourSlug]">{{ 'planner.book' | t }}</a> }
                  <button class="text-btn" type="button" (click)="remove(activity.id)">{{ 'planner.remove' | t }}</button>
                </div>
              }
            </section>
          }
          <p>{{ formatTjs(item.totalEstimate) }}</p>
          <button class="sand" type="button" (click)="regenerate()">{{ 'planner.demoCta' | t }}</button>
        }
      </div>
    </ion-content>
  `,
})
export class ItineraryPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly formatTjs = formatTjs;
  readonly plan = signal<(PlanResult & { id?: string }) | null>(null);
  readonly budget = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api.itinerary(id).subscribe((plan) => {
      this.plan.set(plan);
      this.budget.set(plan.budgetTjs ?? '');
    });
  }

  remove(activityId?: string) {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || !activityId) return;
    this.api.removeActivity(id, activityId).subscribe(() => {
      this.api.itinerary(id).subscribe((plan) => this.plan.set(plan));
    });
  }

  regenerate() {
    const current = this.plan();
    if (!current) return;
    void this.router.navigate(['/tabs/planner']);
  }
}
