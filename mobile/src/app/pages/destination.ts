import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { ApiService } from '../core/api.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe, formatTjs } from '../core/i18n';
import { Destination } from '../core/models';
import { BackButton, Photo } from '../ui';

@Component({
  selector: 'app-destination',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo, BackButton],
  template: `
    <ion-content>
      @if (loading()) { <div class="page"><div class="skel skel-hero"></div></div> }
      @else if (failed()) { <div class="page error-box stack"><p>{{ 'common.offline' | t }}</p><button class="primary" type="button" (click)="load()">{{ 'common.retry' | t }}</button></div> }
      @else if (place(); as item) {
        <div class="gallery">
          @for (image of gallery(item); track image.url) {
            <div class="shot"><app-photo [src]="image.url" [alt]="image.alt"></app-photo></div>
          }
        </div>
        <div class="page stack">
          <div class="spread">
            <app-back [label]="'common.back' | t"></app-back>
            <button class="icon-btn" type="button" (click)="share(item)"><ion-icon name="share-outline"></ion-icon></button>
            <button class="icon-btn" type="button" (click)="favorites.toggle('destination', item.id)"><ion-icon [name]="favorites.has('destination', item.id) ? 'heart' : 'heart-outline'"></ion-icon></button>
          </div>
          @if (copied()) { <p class="notice">{{ 'share.copied' | t }}</p> }
          <p class="tiny">{{ i18n.region(item.region) }} · {{ i18n.category(item.category) }}</p>
          <h1 class="display">{{ item.name }}</h1>
          @if (item.ratingCount) { <p class="stars">{{ item.rating }} · {{ item.ratingCount }}</p> }
          <p>{{ item.description }}</p>
          <div class="chips">
            @for (activity of item.activities ?? []; track activity) { <span class="chip">{{ activity }}</span> }
          </div>
          @if (item.suggestedDays) { <p><strong>{{ 'dest.duration' | t }}:</strong> {{ 'common.days' | t:{ count: item.suggestedDays } }}</p> }
          @if (item.bestPeriod) { <p>{{ item.bestPeriod }}</p> }
          @if (item.budgetEstimateMin) {
            <div class="soft-card"><div class="body">
              <p class="tiny">{{ 'dest.budget' | t }}</p>
              <h3>{{ formatTjs(item.budgetEstimateMin) }} – {{ formatTjs(item.budgetEstimateMax) }}</h3>
              <p class="muted">{{ item.budgetNote }}</p>
            </div></div>
          }
          <div class="soft-card"><div class="body">
            <p class="tiny">{{ 'map.title' | t }}</p>
            <p>{{ item.locationNote }}</p>
            <p class="muted">{{ 'dest.mapNote' | t }}</p>
            <a class="primary" style="width:max-content" [routerLink]="['/tabs/map']" [queryParams]="{ focus: item.slug }">{{ 'common.map' | t }}</a>
          </div></div>
          <p class="notice">{{ 'dest.weather' | t }}</p>
          @if (item.tips) { <div class="warn"><strong>{{ 'dest.tips' | t }}</strong><p>{{ item.tips }}</p></div> }
          <h2>{{ 'home.tours' | t }}</h2>
          @for (tour of item.tours ?? []; track tour.id) {
            <a class="tour-card" [routerLink]="['/tabs/tour', tour.slug]">
              <div class="media"><app-photo [src]="tour.coverImageUrl || item.coverImageUrl" [alt]="tour.title"></app-photo></div>
              <div class="body"><h3>{{ tour.title }}</h3><span class="chip">{{ formatTjs(tour.pricePerPerson) }}</span></div>
            </a>
          }
          <a class="primary full" [routerLink]="['/tabs/explore']" [queryParams]="{ segment: 'tours', q: item.name }">{{ 'common.tours' | t }}</a>
          <h2>{{ 'dest.stays' | t }}</h2>
          @for (stay of item.accommodations ?? []; track stay.id) {
            <a class="soft-card" [routerLink]="['/tabs/stay', stay.slug]"><div class="body"><h3>{{ stay.name }}</h3><p>{{ stay.summary }}</p><span class="chip">{{ 'common.unverified' | t }}</span></div></a>
          }
        </div>
      }
    </ion-content>
  `,
})
export class DestinationPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(I18nService);
  readonly favorites = inject(FavoritesService);
  readonly formatTjs = formatTjs;
  readonly place = signal<Destination | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly copied = signal(false);

  constructor() {
    this.route.paramMap.subscribe(() => this.load());
  }

  load() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) return;
    this.loading.set(true);
    this.failed.set(false);
    this.api.destination(slug).subscribe({
      next: (place) => { this.place.set(place); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }

  gallery(item: Destination) {
    const images = item.images?.length ? item.images : [{ url: item.coverImageUrl ?? '', alt: item.name }];
    return images.filter((image) => image.url);
  }

  async share(item: Destination) {
    const url = location.origin + '/tabs/destination/' + item.slug;
    if (navigator.share) {
      await navigator.share({ title: item.name, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
  }
}
