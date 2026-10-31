import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { ApiService } from '../core/api.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe, formatTjs } from '../core/i18n';
import { ToastService } from '../core/toast.service';
import { Destination, TourCard } from '../core/models';
import { Photo } from '../ui';

@Component({
  selector: 'app-explore',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo],
  template: `
    <ion-content>
      <div class="page stack">
        <div class="spread">
          <h1 class="display" style="font-size:28px;margin:0">{{ 'explore.title' | t }}</h1>
          <a class="icon-btn" routerLink="/tabs/map" [attr.aria-label]="'map.title' | t"><ion-icon name="map-outline"></ion-icon></a>
        </div>
        <form class="search" (submit)="apply($event)">
          <ion-icon name="search-outline"></ion-icon>
          <input name="q" [value]="q()" [placeholder]="'home.search' | t" />
        </form>
        <div class="seg">
          <button type="button" [class.on]="segment() === 'places'" (click)="segment.set('places'); reload()">{{ 'explore.places' | t }}</button>
          <button type="button" [class.on]="segment() === 'tours'" (click)="segment.set('tours'); reload()">{{ 'explore.tours' | t }}</button>
        </div>
        <div class="chip-row">
          <button class="chip" type="button" [class.on]="region() === ''" (click)="setRegion('')">{{ 'common.all' | t }}</button>
          @for (item of regions; track item) {
            <button class="chip" type="button" [class.on]="region() === item" (click)="setRegion(item)">{{ i18n.region(item) }}</button>
          }
        </div>
        @if (segment() === 'places') {
          <div class="chip-row">
            @for (item of categories; track item) {
              <button class="chip" type="button" [class.on]="category() === item" (click)="setCategory(item)">{{ i18n.category(item) }}</button>
            }
            <button class="chip" type="button" (click)="sort.set(sort() === 'name' ? 'rating' : 'name'); reload()">{{ sort() === 'name' ? ('sort.name' | t) : ('sort.rating' | t) }}</button>
          </div>
        } @else {
          <button class="ghost" type="button" (click)="filtersOpen.set(true)">
            <ion-icon name="options-outline"></ion-icon>
            {{ 'explore.filters' | t }}
            @if (filterCount()) { <span class="chip on">{{ filterCount() }}</span> }
          </button>
        }
        @if (loading()) {
          <div class="skel" style="height:176px;border-radius:20px"></div>
          <div class="skel" style="height:176px;border-radius:20px"></div>
        } @else if (failed()) {
          <div class="error-box stack"><p>{{ 'common.offline' | t }}</p><button class="primary" type="button" (click)="reload()">{{ 'common.retry' | t }}</button></div>
        } @else if (segment() === 'places' && !places().length) {
          <div class="empty">{{ 'explore.empty' | t }}</div>
        } @else if (segment() === 'tours' && !tours().length) {
          <div class="empty">{{ 'explore.empty' | t }}</div>
        }
        <div class="stack">
          @if (segment() === 'places') {
            @for (place of places(); track place.id) {
              <a class="trip-card" [routerLink]="['/tabs/destination', place.slug]">
                <div class="media">
                  <app-photo [src]="place.coverImageUrl" [alt]="place.name"></app-photo>
                  <button class="icon-btn fav" type="button" (click)="fav($event, place.id)" [attr.aria-label]="'common.save' | t"><ion-icon [name]="favorites.has('destination', place.id) ? 'heart' : 'heart-outline'"></ion-icon></button>
                </div>
                <div class="body">
                  <h3>{{ place.name }}</h3>
                  <p class="muted">{{ i18n.region(place.region) }} · {{ i18n.category(place.category) }}</p>
                  <p class="clamp">{{ place.summary }}</p>
                </div>
              </a>
            }
          } @else {
            @for (tour of tours(); track tour.id) {
              <article class="trip-card">
                <a class="media" [routerLink]="['/tabs/tour', tour.slug]">
                  <app-photo [src]="tour.coverImageUrl" [alt]="tour.title"></app-photo>
                  <button class="icon-btn fav" type="button" (click)="fav($event, tour.id, 'tour')" [attr.aria-label]="'common.save' | t"><ion-icon [name]="favorites.has('tour', tour.id) ? 'heart' : 'heart-outline'"></ion-icon></button>
                </a>
                <div class="body">
                  <h3>{{ tour.title }}</h3>
                  <p class="muted">{{ tour.destination?.name || tour.destinationName }} · {{ 'common.days' | t:{ count: tour.durationDays ?? 1 } }}</p>
                  <div class="trip-meta">
                    <strong>{{ formatTjs(tour.pricePerPerson) }}</strong>
                    @if (tour.ratingCount) { <span class="chip">{{ tour.rating }} · {{ tour.ratingCount }}</span> }
                  </div>
                  <a class="primary" [routerLink]="['/tabs/tour', tour.slug]">{{ 'tour.view' | t }}</a>
                </div>
              </article>
            }
          }
        </div>
        @if (filtersOpen()) {
          <div class="sheet-backdrop" (click)="filtersOpen.set(false)"></div>
          <form class="sheet stack" (submit)="applyFilters($event)">
            <div class="spread">
              <h2 style="margin:0">{{ 'explore.filters' | t }}</h2>
              <button class="icon-btn" type="button" (click)="filtersOpen.set(false)" [attr.aria-label]="'common.close' | t"><ion-icon name="close-outline"></ion-icon></button>
            </div>
            <label class="lbl">{{ 'filter.price' | t }}<input class="field" name="maxPrice" type="number" [value]="maxPrice()" /></label>
            <label class="lbl">{{ 'filter.days' | t }}<input class="field" name="duration" type="number" [value]="duration()" /></label>
            <label class="lbl">{{ 'filter.date' | t }}<input class="field" name="date" type="date" [value]="date()" /></label>
            <label class="lbl">{{ 'filter.group' | t }}<input class="field" name="group" type="number" [value]="group()" /></label>
            <div class="chips">
              @for (level of levels; track level) {
                <button class="chip" type="button" [class.on]="difficulty() === level" (click)="difficulty.set(difficulty() === level ? '' : level)">{{ ('diff.' + level) | t }}</button>
              }
            </div>
            <button class="chip" type="button" (click)="tourSort.set(tourSort() === 'price_asc' ? 'price_desc' : tourSort() === 'price_desc' ? 'rating' : 'price_asc')">{{ 'sort.price' | t }}</button>
            <button class="primary" type="submit">{{ 'explore.tours' | t }}</button>
            <button class="ghost" type="button" (click)="clearFilters()">{{ 'filter.clear' | t }}</button>
          </form>
        }
      </div>
    </ion-content>
  `,
})
export class ExplorePage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);
  readonly favorites = inject(FavoritesService);
  private readonly toast = inject(ToastService);
  readonly formatTjs = formatTjs;
  readonly places = signal<Destination[]>([]);
  readonly tours = signal<TourCard[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly segment = signal<'places' | 'tours'>('places');
  readonly q = signal('');
  readonly region = signal('');
  readonly category = signal('');
  readonly sort = signal('featured');
  readonly maxPrice = signal('');
  readonly duration = signal('');
  readonly date = signal('');
  readonly group = signal('');
  readonly difficulty = signal('');
  readonly tourSort = signal('price_asc');
  readonly filtersOpen = signal(false);
  readonly filterCount = computed(() => [this.maxPrice(), this.duration(), this.date(), this.group(), this.difficulty()].filter(Boolean).length);
  readonly regions = ['SUGHD', 'DUSHANBE', 'DRS', 'KHATLON', 'GBAO'];
  readonly categories = ['LAKES', 'MOUNTAINS', 'CITIES', 'CULTURE', 'ROAD', 'NATURE'];
  readonly levels = ['EASY', 'MODERATE', 'CHALLENGING', 'STRENUOUS'];

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.q.set(params.get('q') ?? '');
      this.category.set(params.get('category') ?? '');
      if (params.get('segment') === 'tours') this.segment.set('tours');
      this.reload();
    });
  }

  setRegion(value: string) {
    this.region.set(value);
    this.reload();
  }

  setCategory(value: string) {
    this.category.set(this.category() === value ? '' : value);
    this.reload();
  }

  apply(event: Event) {
    event.preventDefault();
    const q = String(new FormData(event.target as HTMLFormElement).get('q') ?? '');
    void this.router.navigate([], { queryParams: { q }, queryParamsHandling: 'merge' });
  }

  applyFilters(event: Event) {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.maxPrice.set(String(data.get('maxPrice') ?? ''));
    this.duration.set(String(data.get('duration') ?? ''));
    this.date.set(String(data.get('date') ?? ''));
    this.group.set(String(data.get('group') ?? ''));
    this.filtersOpen.set(false);
    this.reload();
  }

  clearFilters() {
    this.maxPrice.set('');
    this.duration.set('');
    this.date.set('');
    this.group.set('');
    this.difficulty.set('');
    this.filtersOpen.set(false);
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.failed.set(false);
    if (this.segment() === 'places') {
      this.api.destinations({ q: this.q(), region: this.region(), category: this.category(), sort: this.sort() }).subscribe({
        next: (rows) => { this.places.set(rows); this.loading.set(false); },
        error: () => { this.failed.set(true); this.loading.set(false); },
      });
      return;
    }
    this.api.tours({
      q: this.q(),
      destination: '',
      difficulty: this.difficulty() || undefined,
      maxPrice: this.maxPrice() || undefined,
      duration: this.duration() || undefined,
      date: this.date() || undefined,
      groupSize: this.group() || undefined,
      sort: this.tourSort(),
    }).subscribe({
      next: (rows) => {
        const region = this.region();
        this.tours.set(region ? rows.filter((row) => row.destination?.region === region) : rows);
        this.loading.set(false);
      },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }

  fav(event: Event, id: string, kind: 'destination' | 'tour' = 'destination') {
    event.preventDefault();
    event.stopPropagation();
    void this.favorites.toggle(kind, id).then((saved) => { if (saved) this.toast.show(this.i18n.t('toast.saved')); });
  }
}
