import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe } from '../core/i18n';
import { ToastService } from '../core/toast.service';
import { Photo } from '../ui';

type ItemKind = 'destination' | 'tour' | 'stay' | 'guide';

interface FavItem {
  id: string;
  kind: ItemKind;
  targetId: string;
  title: string;
  subtitle: string;
  image?: string | null;
  href: string;
}

@Component({
  selector: 'app-favorites',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo],
  template: `
    <ion-content>
      <div class="page compact stack tight">
        <h1 class="display" style="font-size:26px;margin:0">{{ 'fav.title' | t }}</h1>
        @if (!auth.user() && rows().length) { <p class="muted" style="margin:0">{{ 'fav.device' | t }}</p> }
        @if (kinds().length > 1) {
          <div class="chip-row">
            <button class="chip" type="button" [class.on]="filter() === ''" (click)="filter.set('')">{{ 'common.all' | t }}</button>
            @for (kind of kinds(); track kind) {
              <button class="chip" type="button" [class.on]="filter() === kind" (click)="filter.set(kind)">{{ label(kind) }}</button>
            }
          </div>
        }
        @if (loading()) {
          <div class="skel" style="height:72px;border-radius:16px"></div>
        } @else if (!shown().length) {
          <div class="empty">{{ 'fav.empty' | t }}</div>
          <a class="ghost" routerLink="/tabs/explore">{{ 'explore.title' | t }}</a>
        } @else {
          @for (row of shown(); track row.id) {
            <div class="fav-row">
              <a [routerLink]="row.href">
                <div class="media"><app-photo [src]="row.image" [alt]="row.title"></app-photo></div>
                <span>
                  <h3>{{ row.title }}</h3>
                  <p class="muted">{{ label(row.kind) }}@if (place(row.subtitle)) { · {{ place(row.subtitle) }} }</p>
                </span>
              </a>
              <button class="icon-btn plain" type="button" (click)="remove(row)" [attr.aria-label]="label(row.kind)">
                <ion-icon name="heart"></ion-icon>
              </button>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
})
export class FavoritesPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly favorites = inject(FavoritesService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  readonly rows = signal<FavItem[]>([]);
  readonly loading = signal(true);
  readonly filter = signal<'' | ItemKind>('');
  readonly kinds = computed(() => {
    const present = new Set(this.rows().map((row) => row.kind));
    return (['destination', 'tour', 'stay', 'guide'] as const).filter((kind) => present.has(kind));
  });
  readonly shown = computed(() => {
    const kind = this.filter();
    return kind ? this.rows().filter((row) => row.kind === kind) : this.rows();
  });

  constructor() {
    void this.load();
  }

  label(kind: ItemKind) {
    return this.i18n.t(`fav.${kind}`);
  }

  place(code: string) {
    return code ? this.i18n.region(code) : '';
  }

  async remove(row: FavItem) {
    this.rows.update((list) => list.filter((item) => item.id !== row.id));
    if (this.filter() && !this.rows().some((item) => item.kind === this.filter())) this.filter.set('');
    try {
      const removed = await this.favorites.toggle(row.kind, row.targetId);
      if (removed) this.toast.show(this.i18n.t('fav.removed'));
    } catch {
      await this.load();
    }
  }

  private async load() {
    this.loading.set(true);
    await this.auth.ready();
    try {
      this.rows.set(this.auth.user() ? await this.remoteRows() : await this.localRows());
    } catch {
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async remoteRows(): Promise<FavItem[]> {
    const rows = await firstValueFrom(this.api.favorites());
    return rows.flatMap((row) => {
      const kind = row.destinationId ? 'destination' : row.tourId ? 'tour' : row.accommodationId ? 'stay' : row.guideId ? 'guide' : '';
      const targetId = row.destinationId || row.tourId || row.accommodationId || row.guideId || '';
      if (!kind || !targetId) return [];
      return [{ id: row.id, kind, targetId, title: row.title, subtitle: row.subtitle, image: row.image, href: row.href }];
    });
  }

  private async localRows(): Promise<FavItem[]> {
    const saved = this.favorites.savedLocal();
    const jobs: Promise<FavItem[]>[] = [];
    if (saved.destination.length) jobs.push(this.places(saved.destination));
    if (saved.tour.length) jobs.push(this.trips(saved.tour));
    if (saved.stay.length) jobs.push(this.lodging(saved.stay));
    if (saved.guide.length) jobs.push(this.people(saved.guide));
    const groups = await Promise.all(jobs);
    return groups.flat();
  }

  private async places(ids: string[]) {
    const wanted = new Set(ids);
    const rows = await firstValueFrom(this.api.destinations({ pageSize: 50 })).catch(() => []);
    return rows.filter((row) => wanted.has(row.id)).map((row) => this.item('destination', row.id, row.name, row.region, row.coverImageUrl, `/tabs/destination/${row.slug}`));
  }

  private async trips(ids: string[]) {
    const wanted = new Set(ids);
    const rows = await firstValueFrom(this.api.tours({ pageSize: 50 })).catch(() => []);
    return rows.filter((row) => wanted.has(row.id)).map((row) => this.item('tour', row.id, row.title, row.destination?.region || row.region || '', row.coverImageUrl, `/tabs/tour/${row.slug}`));
  }

  private async lodging(ids: string[]) {
    const wanted = new Set(ids);
    const rows = await firstValueFrom(this.api.stays()).catch(() => []);
    return rows.filter((row) => wanted.has(row.id)).map((row) => this.item('stay', row.id, row.name, row.region || '', row.coverImageUrl, `/tabs/stay/${row.slug}`));
  }

  private async people(ids: string[]) {
    const wanted = new Set(ids);
    const rows = await firstValueFrom(this.api.guides()).catch(() => []);
    return rows.filter((row) => wanted.has(row.id)).map((row) => this.item('guide', row.id, row.displayName, row.region, row.coverImageUrl, `/tabs/guide/${row.id}`));
  }

  private item(kind: ItemKind, targetId: string, title: string, subtitle: string, image: string | null | undefined, href: string): FavItem {
    return { id: `${kind}:${targetId}`, kind, targetId, title, subtitle, image, href };
  }
}
