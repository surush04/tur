import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { apiOrigin } from '../../environments/environment';
import { ApiFailure, ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18nService, TPipe, formatTjs } from '../core/i18n';
import { Destination } from '../core/models';
import { BackButton } from '../ui';

@Component({
  selector: 'app-owner-home',
  imports: [IonContent, IonIcon, RouterLink, ReactiveFormsModule, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page compact stack tight">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'owner.title' | t }}</h1>
        </div>
        <p class="muted">{{ 'owner.studioLead' | t }}</p>
        <div class="facts">
          <div><span class="tiny">{{ 'owner.views' | t }}</span><strong>{{ dash()?.views ?? 0 }}</strong></div>
          <div><span class="tiny">{{ 'owner.mine' | t }}</span><strong>{{ dash()?.tours.length ?? 0 }}</strong></div>
        </div>
        <p class="muted">{{ 'owner.contactHint' | t }}</p>
        <form class="stack tight" [formGroup]="handles" (ngSubmit)="saveHandles()">
          <label class="lbl">{{ 'owner.telegram' | t }}<input class="field" formControlName="telegramHandle" placeholder="tajiktravel" /></label>
          <label class="lbl">{{ 'owner.whatsapp' | t }}<input class="field" formControlName="whatsappHandle" placeholder="992900000000" /></label>
          <button class="ghost full" type="submit">{{ 'common.save' | t }}</button>
        </form>
        <a class="primary full" routerLink="/tabs/owner/new">{{ 'owner.newTour' | t }}</a>
        <a class="ghost full" routerLink="/tabs/reels/new">{{ 'owner.reel' | t }}</a>
        <a class="ghost full" routerLink="/tabs/groups/new">{{ 'owner.group' | t }}</a>
        <h2>{{ 'owner.mine' | t }}</h2>
        @if (!(dash()?.tours.length)) { <div class="empty">{{ 'owner.empty' | t }}</div> }
        @if (dash()?.tours?.length) {
          <nav class="menu">
            @for (tour of dash()?.tours ?? []; track tour.id) {
              <div class="menu-row">
                <a [routerLink]="['/tabs/owner', tour.id]" style="flex:1;min-width:0;color:inherit;text-decoration:none">{{ tour.title }} · {{ money(tour.pricePerPerson) }} · {{ tour.viewCount }}</a>
                <button class="icon-btn plain" type="button" (click)="removeTour(tour.id)" [attr.aria-label]="'owner.delete' | t"><ion-icon name="close-outline"></ion-icon></button>
              </div>
            }
          </nav>
        }
        @if (note()) { <p class="notice">{{ note() }}</p> }
        @if (dash()?.videos?.length) {
          <h2>{{ 'tabs.reels' | t }}</h2>
          <nav class="menu">
            @for (video of dash()?.videos ?? []; track video.id) {
              <div class="menu-row">
                <span style="flex:1;min-width:0">{{ video.caption }} · {{ video.status === 'PUBLISHED' ? ('owner.live' | t) : ('owner.pending' | t) }}</span>
                <button class="icon-btn plain" type="button" (click)="removeVideo(video.id)" [attr.aria-label]="'owner.delete' | t"><ion-icon name="close-outline"></ion-icon></button>
              </div>
            }
          </nav>
        }
        @if (dash()?.groups?.length) {
          <h2>{{ 'tabs.groups' | t }}</h2>
          <nav class="menu">
            @for (group of dash()?.groups ?? []; track group.id) {
              <a class="menu-row" [routerLink]="['/tabs/group', group.id]">{{ group.name }} · {{ group.memberCount }}/{{ group.desiredSize }}<ion-icon class="chev" name="chevron-forward"></ion-icon></a>
            }
          </nav>
        }
        @if (auth.user()?.role === 'PROVIDER') {
          <button class="text-btn" type="button" (click)="traveler()">{{ 'owner.traveler' | t }}</button>
        }
      </div>
    </ion-content>
  `,
})
export class OwnerHomePage {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  readonly note = signal('');
  readonly dash = signal<{
    views: number;
    tours: { id: string; title: string; pricePerPerson: string | null; published: boolean; viewCount: number }[];
    videos: { id: string; caption: string; status: string }[];
    groups: { id: string; name: string; memberCount: number; desiredSize: number }[];
  } | null>(null);
  readonly handles = inject(FormBuilder).nonNullable.group({
    telegramHandle: [''],
    whatsappHandle: [''],
  });

  constructor() {
    this.api.me().subscribe((user) => {
      this.auth.user.set(user);
      this.handles.patchValue({ telegramHandle: user.telegramHandle ?? '', whatsappHandle: user.whatsappHandle ?? '' });
    });
    this.reload();
  }

  reload() {
    this.api.ownerDashboard().subscribe((data) => this.dash.set(data));
  }

  saveHandles() {
    this.api.updateProfile(this.handles.getRawValue()).subscribe((user) => {
      this.auth.user.set(user);
      this.note.set('');
    });
  }

  removeTour(id: string) {
    this.api.deleteOwnerTour(id).subscribe((result) => {
      this.note.set(result.hidden ? this.i18n.t('owner.hiddenNote') : '');
      this.reload();
    });
  }

  removeVideo(id: string) {
    this.api.deleteOwnerVideo(id).subscribe(() => this.reload());
  }

  traveler() {
    this.api.setMode('traveler').subscribe((user) => {
      this.auth.user.set(user);
      void this.router.navigateByUrl('/tabs/profile');
    });
  }

  money(value: string | null) {
    return formatTjs(value);
  }
}

@Component({
  selector: 'app-owner-tour',
  imports: [IonContent, ReactiveFormsModule, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page compact stack tight">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ id ? ('owner.editTour' | t) : ('owner.newTour' | t) }}</h1>
        </div>
        <form class="stack tight" [formGroup]="form" (ngSubmit)="save()">
          <label class="lbl">{{ 'group.destination' | t }}
            <select class="field" formControlName="destinationId">
              @for (place of places(); track place.id) { <option [value]="place.id">{{ place.name }}</option> }
            </select>
          </label>
          <label class="lbl">{{ 'owner.tourName' | t }}<input class="field" formControlName="title" /></label>
          <label class="lbl">{{ 'owner.about' | t }}<input class="field" formControlName="summary" /></label>
          <label class="lbl">{{ 'owner.about' | t }}<textarea class="field" formControlName="description"></textarea></label>
          <label class="lbl">{{ 'owner.icon' | t }}<input type="file" accept="image/jpeg,image/png,image/webp" (change)="pick($event, 'cover')" /></label>
          <label class="lbl">{{ 'owner.photos' | t }}<input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="pick($event, 'photos')" /></label>
          <label class="lbl">{{ 'owner.video' | t }}<input type="file" accept="video/mp4,video/webm" (change)="pick($event, 'video')" /></label>
          <p class="hint">{{ 'owner.videoNote' | t }}</p>
          @if (cover() || photos().length) {
            <div class="shot-row">
              @if (cover()) { <img [src]="media(cover())" alt="" /> }
              @for (photo of photos(); track photo) { <img [src]="media(photo)" alt="" /> }
            </div>
          }
          <label class="lbl">{{ 'home.categories' | t }}
            <select class="field" formControlName="category">
              @for (item of categories; track item) { <option [value]="item">{{ i18n.category(item) }}</option> }
            </select>
          </label>
          <label class="lbl">{{ 'filter.level' | t }}
            <select class="field" formControlName="difficulty">
              @for (item of levels; track item) { <option [value]="item">{{ ('diff.' + item) | t }}</option> }
            </select>
          </label>
          <div class="grid-2">
            <label class="lbl">{{ 'filter.days' | t }}<input class="field" type="number" min="1" formControlName="durationDays" /></label>
            <label class="lbl">{{ 'filter.price' | t }}<input class="field" inputmode="decimal" formControlName="pricePerPerson" /></label>
          </div>
          <label class="lbl">{{ 'tour.meeting' | t }}<input class="field" formControlName="meetingPoint" /></label>
          <label class="lbl">{{ 'owner.phone' | t }}<input class="field" inputmode="tel" formControlName="contactPhone" placeholder="+992" /></label>
          <label class="lbl">{{ 'tour.included' | t }}<input class="field" formControlName="included" /></label>
          <label class="menu-row"><input type="checkbox" formControlName="published" /> {{ 'owner.post' | t }}</label>
          <button class="primary full" type="submit" [disabled]="form.invalid || uploading()">{{ 'common.save' | t }}</button>
        </form>
        @if (error()) { <p class="error-box">{{ error() }}</p> }
      </div>
    </ion-content>
  `,
})
export class OwnerTourPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);
  readonly places = signal<Destination[]>([]);
  readonly error = signal('');
  readonly cover = signal('');
  readonly photos = signal<string[]>([]);
  readonly videoUrl = signal('');
  readonly uploading = signal(false);
  readonly media = (url: string) => (url.startsWith('/') ? `${apiOrigin()}${url}` : url);
  readonly categories = ['LAKES', 'MOUNTAINS', 'CITIES', 'CULTURE', 'ROAD', 'NATURE'];
  readonly levels = ['EASY', 'MODERATE', 'CHALLENGING', 'STRENUOUS'];
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly form = inject(FormBuilder).nonNullable.group({
    destinationId: ['', Validators.required],
    title: ['', [Validators.required, Validators.minLength(2)]],
    summary: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(2)]],
    category: ['CITIES', Validators.required],
    difficulty: ['MODERATE', Validators.required],
    durationDays: [1, [Validators.required, Validators.min(1)]],
    pricePerPerson: ['', [Validators.required, Validators.pattern(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)]],
    meetingPoint: ['', Validators.required],
    contactPhone: [''],
    included: [''],
    published: [true],
  });

  constructor() {
    this.api.destinations({ pageSize: 50 }).subscribe((rows) => {
      this.places.set(rows);
      if (!this.form.controls.destinationId.value && rows[0]) this.form.controls.destinationId.setValue(rows[0].id);
    });
    if (this.id) {
      this.api.ownerTour(this.id).subscribe((tour) => {
        this.form.patchValue({ ...tour, pricePerPerson: tour.pricePerPerson ?? '' });
        this.cover.set(tour.coverImageUrl ?? '');
        this.photos.set(tour.imageUrls ?? []);
      });
    }
  }

  async pick(event: Event, kind: 'cover' | 'photos' | 'video') {
    const files = [...((event.target as HTMLInputElement).files ?? [])].slice(0, 8);
    if (!files.length) return;
    this.uploading.set(true);
    this.error.set('');
    try {
      for (const file of files) {
        const result = await firstValueFrom(this.api.uploadMedia(file));
        if (kind === 'cover') this.cover.set(result.url);
        else if (kind === 'video') this.videoUrl.set(result.url);
        else this.photos.update((list) => [...list, result.url].slice(0, 8));
      }
    } catch (error) {
      this.error.set((error as ApiFailure).message);
    } finally {
      this.uploading.set(false);
    }
  }

  save() {
    if (this.form.invalid || this.uploading()) return;
    if (this.videoUrl() && !this.cover() && !this.photos().length) {
      this.error.set(this.i18n.t('owner.videoNote'));
      return;
    }
    const raw = this.form.getRawValue();
    this.api.saveOwnerTour({
      ...raw,
      durationDays: Number(raw.durationDays),
      coverImageUrl: this.cover(),
      imageUrls: this.photos(),
    }, this.id ?? undefined).subscribe({
      next: (saved) => {
        if (!this.videoUrl()) {
          void this.router.navigateByUrl('/tabs/owner');
          return;
        }
        const place = this.places().find((item) => item.id === raw.destinationId);
        const caption = raw.title.trim().length >= 3 ? raw.title.trim() : raw.summary.trim();
        this.api.publishReel({
          caption,
          destinationName: place?.name || raw.title,
          region: place?.region || 'SUGHD',
          posterUrl: this.cover() || this.photos()[0],
          videoUrl: this.videoUrl(),
          ...(raw.published ? { tourId: saved.id } : {}),
        }).subscribe({
          next: () => void this.router.navigateByUrl('/tabs/owner'),
          error: (error: ApiFailure) => this.error.set(error.message),
        });
      },
      error: (error: ApiFailure) => this.error.set(error.message),
    });
  }
}
