import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

type Kind = 'destination' | 'tour' | 'stay' | 'guide';

interface LocalFavs {
  destination: string[];
  tour: string[];
  stay: string[];
  guide: string[];
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  private readonly local = signal<LocalFavs>(this.read());
  private readonly remote = signal<{ id: string; destinationId?: string | null; tourId?: string | null; accommodationId?: string | null; guideId?: string | null }[]>([]);

  savedLocal() {
    return this.local();
  }

  has(kind: Kind, id: string) {
    if (!this.auth.user()) return false;
    return this.remote().some((row) => this.match(row, kind) === id);
  }

  async refresh() {
    if (!this.auth.user()) return;
    const rows = await firstValueFrom(this.api.favorites());
    this.remote.set(rows);
  }

  async toggle(kind: Kind, id: string) {
    if (!this.auth.user()) {
      await this.nav.navigateRoot('/register', { queryParams: { returnUrl: this.router.url } });
      return false;
    }
    const existing = this.remote().find((row) => this.match(row, kind) === id);
    if (existing) {
      await firstValueFrom(this.api.removeFavorite(existing.id));
    } else {
      const body =
        kind === 'destination'
          ? { destinationId: id }
          : kind === 'tour'
            ? { tourId: id }
            : kind === 'stay'
              ? { accommodationId: id }
              : { guideId: id };
      await firstValueFrom(this.api.addFavorite(body));
    }
    await this.refresh();
    return true;
  }

  async mergeLocal() {
    if (!this.auth.user()) return;
    const local = this.read();
    for (const id of local.destination) await firstValueFrom(this.api.addFavorite({ destinationId: id })).catch(() => undefined);
    for (const id of local.tour) await firstValueFrom(this.api.addFavorite({ tourId: id })).catch(() => undefined);
    for (const id of local.stay) await firstValueFrom(this.api.addFavorite({ accommodationId: id })).catch(() => undefined);
    for (const id of local.guide) await firstValueFrom(this.api.addFavorite({ guideId: id })).catch(() => undefined);
    localStorage.removeItem('rohi_favs');
    this.local.set({ destination: [], tour: [], stay: [], guide: [] });
    await this.refresh();
  }

  private match(row: { destinationId?: string | null; tourId?: string | null; accommodationId?: string | null; guideId?: string | null }, kind: Kind) {
    if (kind === 'destination') return row.destinationId;
    if (kind === 'tour') return row.tourId;
    if (kind === 'stay') return row.accommodationId;
    return row.guideId;
  }

  private read(): LocalFavs {
    try {
      const parsed = JSON.parse(localStorage.getItem('rohi_favs') ?? '') as LocalFavs;
      return {
        destination: parsed.destination ?? [],
        tour: parsed.tour ?? [],
        stay: parsed.stay ?? [],
        guide: parsed.guide ?? [],
      };
    } catch {
      return { destination: [], tour: [], stay: [], guide: [] };
    }
  }
}
