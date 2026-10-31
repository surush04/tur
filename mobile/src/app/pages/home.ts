import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe, formatTjs } from '../core/i18n';
import { ToastService } from '../core/toast.service';
import { Destination, GroupCard, GuideCard, HomePayload, Reel, StayCard, TourCard } from '../core/models';
import { Photo } from '../ui';

@Component({
  selector: 'app-home',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page compact home">
        <header class="app-header">
          <div class="brand">
            <div class="mark" aria-hidden="true">TT</div>
            <div>
              <p class="logo-word">{{ 'brand.name' | t }}</p>
              <p class="muted">{{ greeting() }}</p>
            </div>
          </div>
          <div class="row">
            <a class="icon-btn" routerLink="/tabs/notifications" [attr.aria-label]="'notif.title' | t"><ion-icon name="notifications-outline"></ion-icon></a>
            <a class="avatar" routerLink="/tabs/profile" [attr.aria-label]="'tabs.profile' | t">
              @if (initial()) { {{ initial() }} } @else { <ion-icon name="person-outline"></ion-icon> }
            </a>
          </div>
        </header>

        @if (loading()) {
          <div class="skel skel-hero" style="margin-top:16px"></div>
          <div class="scroller" style="margin-top:16px">
            @for (item of [1, 2, 3]; track item) { <div class="skel skel-card"></div> }
          </div>
        } @else if (error() && !home()) {
          <div class="error-box stack" style="margin-top:16px">
            <p>{{ 'common.offline' | t }}</p>
            <button class="primary" type="button" (click)="load()">{{ 'common.retry' | t }}</button>
          </div>
        } @else if (home(); as data) {
          @if (cached()) { <p class="warn" style="margin-top:8px">{{ 'common.cached' | t }}</p> }
          <form class="search" style="margin-top:10px" (submit)="search($event)">
            <ion-icon name="search-outline"></ion-icon>
            <input name="q" [placeholder]="'home.search' | t" />
          </form>
          <nav class="paths" [attr.aria-label]="'home.categories' | t">
            <a class="path" routerLink="/tabs/explore"><ion-icon name="map-outline"></ion-icon>{{ 'explore.places' | t }}</a>
            <a class="path" routerLink="/tabs/explore" [queryParams]="{ segment: 'tours' }"><ion-icon name="compass-outline"></ion-icon>{{ 'explore.tours' | t }}</a>
            @if (auth.user()) {
              <a class="path" routerLink="/tabs/groups"><ion-icon name="people-outline"></ion-icon>{{ 'tabs.groups' | t }}</a>
            } @else {
              <a class="path" routerLink="/register" [queryParams]="{ returnUrl: '/tabs/groups' }"><ion-icon name="person-outline"></ion-icon>{{ 'common.account' | t }}</a>
            }
          </nav>
          <div class="chip-row" style="margin-top:10px">
            @for (item of regions; track item) {
              <button class="chip" type="button" [class.on]="region() === item" (click)="region.set(item)">{{ item === 'ALL' ? ('home.where' | t) : i18n.region(item) }}</button>
            }
          </div>
          @if (lead(data); as place) {
            <a class="home-lead" [routerLink]="['/tabs/destination', place.slug]">
              <app-photo [src]="place.coverImageUrl" [alt]="place.name"></app-photo>
              <div class="scrim"></div>
              <div class="copy">
                <p>{{ i18n.region(place.region) }}</p>
                <h2>{{ place.name }}</h2>
              </div>
            </a>
          }
          @if (offers(data).length) {
            <section class="section stack tight">
              <div class="section-head"><h2>{{ 'home.tours' | t }}</h2><a class="linkish" routerLink="/tabs/explore" [queryParams]="{ segment: 'tours' }">{{ 'home.seeAll' | t }}</a></div>
              @for (tour of offers(data); track tour.id) {
                <div class="fav-row">
                  <a [routerLink]="['/tabs/tour', tour.slug]">
                    <div class="media"><app-photo [src]="tour.coverImageUrl" [alt]="tour.title"></app-photo></div>
                    <span>
                      <h3>{{ tour.title }}</h3>
                      <p class="muted">{{ tour.destination?.name || tour.destinationName }} · {{ 'common.days' | t:{ count: tour.durationDays ?? 1 } }}@if (tour.pricePerPerson) { · {{ money(tour.pricePerPerson) }} }</p>
                    </span>
                  </a>
                  <button class="icon-btn plain" type="button" (click)="favTour($event, tour.id)" [attr.aria-label]="'common.save' | t">
                    <ion-icon [name]="favorites.has('tour', tour.id) ? 'heart' : 'heart-outline'"></ion-icon>
                  </button>
                </div>
              }
            </section>
          }
          @if (auth.user() && companions().length) {
            <section class="section stack tight">
              <div class="section-head"><h2>{{ 'home.groups' | t }}</h2><a class="linkish" routerLink="/tabs/groups">{{ 'home.seeAll' | t }}</a></div>
              @for (group of companions(); track group.id) {
                <a class="group-row" [routerLink]="['/tabs/group', group.id]">
                  <div class="media"><app-photo [src]="group.coverImageUrl" [alt]="group.name"></app-photo></div>
                  <span>
                    <h3>{{ group.name }}</h3>
                    <p class="muted">{{ group.destinationName }} · {{ group.departureDate || ('group.flexible' | t) }}</p>
                  </span>
                  <span class="count">{{ group.memberCount }}/{{ group.desiredSize }}</span>
                </a>
              }
              <a class="linkish" routerLink="/tabs/groups/new">{{ 'group.create' | t }}</a>
            </section>
          }
          <section class="section">
            <div class="section-head"><h2>{{ 'home.categories' | t }}</h2></div>
            <div class="chip-row">
              @for (category of data.categories; track category) {
                <a class="chip" [routerLink]="['/tabs/explore']" [queryParams]="{ category }"><ion-icon [name]="icon(category)"></ion-icon>{{ i18n.category(category) }}</a>
              }
            </div>
          </section>
          @if (filter(data.popular).length) {
            <section class="section">
              <div class="section-head"><h2>{{ 'home.popular' | t }}</h2><a class="linkish" routerLink="/tabs/explore">{{ 'home.seeAll' | t }}</a></div>
              <div class="scroller">
                @for (place of filter(data.popular); track place.id) {
                  <article class="home-card">
                    <a class="shot" [routerLink]="['/tabs/destination', place.slug]"><app-photo [src]="place.coverImageUrl" [alt]="place.name"></app-photo></a>
                    <button class="icon-btn fav" type="button" (click)="fav($event, place.id)" [attr.aria-label]="'common.save' | t">
                      <ion-icon [name]="favorites.has('destination', place.id) ? 'heart' : 'heart-outline'"></ion-icon>
                    </button>
                    <a class="body" [routerLink]="['/tabs/destination', place.slug]">
                      <h3>{{ place.name }}</h3>
                      <p class="muted">{{ i18n.region(place.region) }}@if (place.ratingCount) { · {{ place.rating }} }</p>
                    </a>
                  </article>
                }
              </div>
            </section>
          }
          @for (block of blocks(data); track block.title) {
            @if (filter(block.items).length) {
              <section class="section">
                <div class="section-head"><h2>{{ block.title }}</h2></div>
                <div class="scroller">
                  @for (place of filter(block.items); track place.id) {
                    <a class="home-card" [routerLink]="['/tabs/destination', place.slug]">
                      <span class="shot"><app-photo [src]="place.coverImageUrl" [alt]="place.name"></app-photo></span>
                      <span class="body"><h3>{{ place.name }}</h3><p class="muted">{{ i18n.region(place.region) }}</p></span>
                    </a>
                  }
                </div>
              </section>
            }
          }
          @if (reels().length) {
            <section class="section">
              <div class="section-head"><h2>{{ 'home.videos' | t }}</h2><a class="linkish" routerLink="/tabs/reels">{{ 'home.seeAll' | t }}</a></div>
              <div class="scroller">
                @for (reel of reels(); track reel.id) {
                  <a class="home-card" routerLink="/tabs/reels">
                    <span class="shot"><app-photo [src]="reel.posterUrl" [alt]="reel.destinationName"></app-photo></span>
                    <span class="body"><h3>{{ reel.destinationName }}</h3></span>
                  </a>
                }
              </div>
            </section>
          }
          @if (data.guides.length) {
            <section class="section">
              <div class="section-head"><h2>{{ 'home.guides' | t }}</h2><a class="linkish" routerLink="/tabs/guides">{{ 'home.seeAll' | t }}</a></div>
              <div class="scroller">
                @for (guide of data.guides.slice(0, 4); track guide.id) {
                  <a class="home-card" [routerLink]="['/tabs/guide', guide.id]">
                    <span class="shot"><app-photo [src]="guide.coverImageUrl" [alt]="guide.displayName"></app-photo></span>
                    <span class="body">
                      <h3>{{ guide.displayName }}</h3>
                      <p class="muted">{{ i18n.region(guide.region) }}</p>
                      @if (!guide.verified) { <p class="muted">{{ 'common.unverified' | t }}</p> }
                    </span>
                  </a>
                }
              </div>
            </section>
          }
          @if (data.accommodations.length) {
            <section class="section">
              <div class="section-head"><h2>{{ 'home.stays' | t }}</h2><a class="linkish" routerLink="/tabs/stays">{{ 'home.seeAll' | t }}</a></div>
              <div class="scroller">
                @for (stay of data.accommodations.slice(0, 4); track stay.id) {
                  <a class="home-card" [routerLink]="['/tabs/stay', stay.slug]">
                    <span class="shot"><app-photo [src]="stay.coverImageUrl" [alt]="stay.name"></app-photo></span>
                    <span class="body">
                      <h3>{{ stay.name }}</h3>
                      @if (stay.priceRangeMin) { <p class="muted">{{ money(stay.priceRangeMin) }}</p> }
                    </span>
                  </a>
                }
              </div>
            </section>
          }
          <a class="plan section" routerLink="/tabs/planner">
            <ion-icon name="sparkles-outline"></ion-icon>
            <span><strong>{{ 'home.plannerTitle' | t }}</strong><p class="muted">{{ 'home.plannerCta' | t }}</p></span>
            <ion-icon name="chevron-forward"></ion-icon>
          </a>
          @if (auth.user() && !companions().length) { <a class="linkish" routerLink="/tabs/groups/new">{{ 'group.create' | t }}</a> }
        }
      </div>
    </ion-content>
  `,
})
export class HomePage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly i18n = inject(I18nService);
  readonly favorites = inject(FavoritesService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly cached = signal(false);
  readonly home = signal<HomePayload | null>(null);
  readonly reels = signal<Reel[]>([]);
  readonly groups = signal<GroupCard[]>([]);
  readonly region = signal('ALL');
  readonly regions = ['ALL', 'SUGHD', 'DUSHANBE', 'DRS', 'KHATLON', 'GBAO'];

  constructor() {
    void this.favorites.refresh();
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.home().subscribe({
      next: (data) => {
        this.home.set(data);
        sessionStorage.setItem('rohi_home', JSON.stringify(data));
        this.cached.set(false);
        this.loading.set(false);
        this.api.reels().subscribe({ next: (rows) => this.reels.set(rows.slice(0, 4)), error: () => this.reels.set([]) });
        this.api.groups().subscribe({ next: (rows) => this.groups.set(rows.slice(0, 4)), error: () => this.groups.set([]) });
      },
      error: () => {
        const saved = sessionStorage.getItem('rohi_home');
        if (saved) {
          this.home.set(JSON.parse(saved) as HomePayload);
          this.cached.set(true);
        }
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  greeting() {
    const user = this.auth.user();
    return user ? this.i18n.t('home.hello', { name: user.firstName }) : this.i18n.t('home.guest');
  }

  initial() {
    return this.auth.user()?.firstName.slice(0, 1).toUpperCase() ?? '';
  }

  lead(data: HomePayload) {
    return this.filter(data.popular)[0] ?? null;
  }

  offers(data: HomePayload) {
    const rows = this.region() === 'ALL' ? data.tours : data.tours.filter((tour) => (tour.destination?.region || tour.region) === this.region());
    return rows.slice(0, 3);
  }

  companions() {
    const rows = this.region() === 'ALL' ? this.groups() : this.groups().filter((group) => group.region === this.region());
    return rows.slice(0, 2);
  }

  filter(items: Destination[]) {
    return this.region() === 'ALL' ? items : items.filter((item) => item.region === this.region());
  }

  blocks(data: HomePayload): { title: string; items: Destination[] }[] {
    return [
      { title: this.i18n.t('home.trending'), items: data.trending },
      { title: this.i18n.t('home.weekend'), items: data.weekend },
      { title: this.i18n.t('home.budget'), items: data.budget },
    ];
  }

  search(event: Event) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const q = String(new FormData(form).get('q') ?? '');
    void this.router.navigate(['/tabs/search'], { queryParams: { q } });
  }

  fav(event: Event, id: string) {
    event.preventDefault();
    event.stopPropagation();
    void this.keep('destination', id);
  }

  favTour(event: Event, id: string) {
    event.preventDefault();
    event.stopPropagation();
    void this.keep('tour', id);
  }

  icon(category: string) {
    const icons: Record<string, string> = {
      LAKES: 'water-outline',
      MOUNTAINS: 'triangle-outline',
      CITIES: 'business-outline',
      CULTURE: 'color-palette-outline',
      ROAD: 'car-outline',
      NATURE: 'leaf-outline',
    };
    return icons[category] ?? 'compass-outline';
  }

  private async keep(kind: 'destination' | 'tour', id: string) {
    const saved = await this.favorites.toggle(kind, id);
    if (saved) this.toast.show(this.i18n.t('toast.saved'));
  }

  money(value: string | null | undefined) {
    return formatTjs(value);
  }
}

export type { GuideCard, StayCard, TourCard };
