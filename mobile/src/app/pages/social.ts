import { DatePipe } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { ApiFailure, ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { FavoritesService } from '../core/favorites.service';
import { I18nService, TPipe, formatTjs } from '../core/i18n';
import { ConversationCard, GroupCard, GroupDetail, InquiryCard, Reel, TourCard } from '../core/models';
import { BackButton, Photo } from '../ui';
import { apiOrigin } from '../../environments/environment';

function media(url: string | null | undefined) {
  if (!url) return '';
  return url.startsWith('/') ? `${apiOrigin()}${url}` : url;
}

@Component({
  selector: 'app-reels',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false">
      @if (loading()) { <div class="page"><div class="skel skel-hero"></div></div> }
      @else if (error()) { <div class="page error-box stack"><p>{{ error() }}</p><button class="primary" type="button" (click)="load()">{{ 'common.retry' | t }}</button></div> }
      @else if (!reels().length) {
        <div class="page stack">
          <h1 class="display">{{ 'reels.title' | t }}</h1>
          <p>{{ 'reels.empty' | t }}</p>
          <a class="primary" routerLink="/tabs/reels/new">{{ 'reels.upload' | t }}</a>
        </div>
      } @else {
        <div class="reel-feed" #feed>
          @for (reel of reels(); track reel.id) {
            <article class="reel" [attr.data-id]="reel.id">
              @if (broken().has(reel.id)) {
                <app-photo [src]="reel.posterUrl" [alt]="reel.destinationName"></app-photo>
                <p class="reel-fallback">{{ 'reels.unavailable' | t }}</p>
              } @else {
                <video
                  playsinline
                  loop
                  [muted]="muted()"
                  [poster]="src(reel.posterUrl)"
                  [src]="active() === reel.id ? src(reel.videoUrl) : ''"
                  (error)="markBroken(reel.id)"
                  (timeupdate)="tick($event, reel.id)"
                ></video>
              }
              <div class="reel-progress"><span [style.width.%]="active() === reel.id ? progress() : 0"></span></div>
              <div class="reel-copy">
                <p class="tiny">{{ reel.creator }}</p>
                <h2>{{ reel.tourTitle || reel.destinationName }}</h2>
                <p>{{ reel.destinationName }}</p>
                <p>{{ reel.caption }}</p>
                <div class="row">
                  @if (reel.tourSlug) { <a class="sand" [routerLink]="['/tabs/tour', reel.tourSlug]">{{ 'reels.viewTour' | t }}</a> }
                  @if (reel.groupId && auth.user()) { <a class="primary" [routerLink]="['/tabs/group', reel.groupId]">{{ 'reels.joinGroup' | t }}</a> }
                </div>
              </div>
              <div class="reel-actions">
                <button type="button" (click)="like(reel)"><ion-icon [name]="reel.liked ? 'heart' : 'heart-outline'"></ion-icon><span>{{ reel.likes }}</span></button>
                <button type="button" (click)="openComments(reel)"><ion-icon name="chatbubble-ellipses-outline"></ion-icon><span>{{ reel.comments }}</span></button>
                <button type="button" (click)="share(reel)"><ion-icon name="share-outline"></ion-icon></button>
                <button type="button" (click)="save(reel)"><ion-icon [name]="reel.saved ? 'bookmark' : 'bookmark-outline'"></ion-icon></button>
                <button type="button" (click)="muted.set(!muted())"><ion-icon [name]="muted() ? 'volume-mute-outline' : 'volume-high-outline'"></ion-icon></button>
                <button type="button" (click)="report(reel.id)"><ion-icon name="flag-outline"></ion-icon></button>
              </div>
            </article>
          }
        </div>
        <a class="reel-add" routerLink="/tabs/reels/new" [attr.aria-label]="'reels.upload' | t"><ion-icon name="add-outline"></ion-icon></a>
        @if (commentsFor(); as current) {
          <section class="reel-sheet">
            <div class="spread"><strong>{{ 'reels.comments' | t }}</strong><button class="icon-btn" type="button" (click)="commentsFor.set(null)"><ion-icon name="close-outline"></ion-icon></button></div>
            @for (comment of comments(); track comment.id) { <p><strong>{{ comment.author }}</strong> {{ comment.body }}</p> }
            @if (!comments().length) { <p class="muted">{{ 'reels.noComments' | t }}</p> }
            <form class="row" (submit)="sendComment($event, current.id)">
              <input name="body" [placeholder]="'reels.comment' | t" />
              <button class="primary" type="submit">{{ 'reels.send' | t }}</button>
            </form>
          </section>
        }
      }
    </ion-content>
  `,
})
export class ReelsPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly nav = inject(NavController);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroy = inject(DestroyRef);
  private observer?: IntersectionObserver;
  readonly reels = signal<Reel[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly active = signal('');
  readonly muted = signal(true);
  readonly progress = signal(0);
  readonly broken = signal(new Set<string>());
  readonly commentsFor = signal<Reel | null>(null);
  readonly comments = signal<{ id: string; body: string; author: string }[]>([]);
  readonly src = media;

  constructor() {
    this.load();
    afterNextRender(() => this.watch());
    this.destroy.onDestroy(() => {
      this.observer?.disconnect();
      this.host.nativeElement.querySelectorAll('video').forEach((node: Element) => {
        const video = node as HTMLVideoElement;
        video.pause();
        video.removeAttribute('src');
        video.load();
      });
    });
  }

  load() {
    this.loading.set(true);
    this.api.reels().subscribe({
      next: (rows) => {
        this.reels.set(rows);
        this.active.set(rows[0]?.id ?? '');
        this.loading.set(false);
        setTimeout(() => this.watch());
      },
      error: (failure: ApiFailure) => {
        this.error.set(failure.message);
        this.loading.set(false);
      },
    });
  }

  watch() {
    this.observer?.disconnect();
    const root = this.host.nativeElement.querySelector('.reel-feed');
    if (!root) return;
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = (visible.target as HTMLElement).dataset['id'] ?? '';
        this.active.set(id);
        this.progress.set(0);
        this.host.nativeElement.querySelectorAll('video').forEach((node: Element) => {
          const video = node as HTMLVideoElement;
          const item = video.closest('.reel') as HTMLElement | null;
          if (item?.dataset['id'] === id) void video.play().catch(() => undefined);
          else video.pause();
        });
      },
      { root, threshold: 0.7 },
    );
    root.querySelectorAll('.reel').forEach((node: Element) => this.observer?.observe(node));
  }

  tick(event: Event, id: string) {
    if (this.active() !== id) return;
    const video = event.target as HTMLVideoElement;
    this.progress.set(video.duration ? (video.currentTime / video.duration) * 100 : 0);
  }

  markBroken(id: string) {
    const next = new Set(this.broken());
    next.add(id);
    this.broken.set(next);
  }

  like(reel: Reel) {
    if (!this.auth.user()) return void this.nav.navigateRoot('/register', { queryParams: { returnUrl: this.router.url } });
    this.api.likeReel(reel.id).subscribe((result) => {
      this.reels.update((rows) => rows.map((row) => (row.id === reel.id ? { ...row, liked: result.liked, likes: result.count } : row)));
    });
  }

  save(reel: Reel) {
    if (!this.auth.user()) return void this.nav.navigateRoot('/register', { queryParams: { returnUrl: this.router.url } });
    this.api.saveReel(reel.id).subscribe((result) => {
      this.reels.update((rows) => rows.map((row) => (row.id === reel.id ? { ...row, saved: result.saved } : row)));
    });
  }

  openComments(reel: Reel) {
    this.commentsFor.set(reel);
    this.api.reelComments(reel.id).subscribe((rows) => this.comments.set(rows));
  }

  sendComment(event: Event, id: string) {
    event.preventDefault();
    if (!this.auth.user()) return void this.nav.navigateRoot('/register', { queryParams: { returnUrl: this.router.url } });
    const form = event.target as HTMLFormElement;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body) return;
    this.api.commentReel(id, body).subscribe(() => {
      form.reset();
      this.api.reelComments(id).subscribe((rows) => this.comments.set(rows));
    });
  }

  share(reel: Reel) {
    const url = `${location.origin}/tabs/reels`;
    if (navigator.share) void navigator.share({ title: reel.destinationName, text: reel.caption, url });
    else void navigator.clipboard.writeText(url);
  }

  report(id: string) {
    if (!this.auth.user()) return void this.nav.navigateRoot('/register', { queryParams: { returnUrl: this.router.url } });
    const reason = window.prompt('Report reason') ?? '';
    if (reason.trim().length < 3) return;
    this.api.reportContent('VIDEO', id, reason.trim()).subscribe();
  }
}

@Component({
  selector: 'app-video-upload',
  imports: [IonContent, ReactiveFormsModule, TPipe],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'reels.upload' | t }}</h1>
        <p class="muted">{{ 'reels.uploadNote' | t }}</p>
        <form class="stack" [formGroup]="form" (ngSubmit)="save()">
          <label>{{ 'reels.videoFile' | t }}<input type="file" accept="video/mp4,video/webm" (change)="pick($event, 'video')" /></label>
          <label>{{ 'reels.posterFile' | t }}<input type="file" accept="image/jpeg,image/png,image/webp" (change)="pick($event, 'poster')" /></label>
          <input class="field" formControlName="caption" [placeholder]="'reels.caption' | t" />
          <input class="field" formControlName="destinationName" [placeholder]="'group.destination' | t" />
          <input class="field" formControlName="region" placeholder="SUGHD" />
          <button class="primary" type="submit" [disabled]="busy()">{{ 'reels.publish' | t }}</button>
        </form>
        @if (message()) { <p>{{ message() }}</p> }
      </div>
    </ion-content>
  `,
})
export class VideoUploadPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly message = signal('');
  private videoUrl = '';
  private posterUrl = '';
  readonly form = inject(FormBuilder).nonNullable.group({
    caption: ['', [Validators.required, Validators.minLength(3)]],
    destinationName: ['', Validators.required],
    region: ['SUGHD', Validators.required],
  });

  pick(event: Event, kind: 'video' | 'poster') {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.busy.set(true);
    this.api.uploadMedia(file).subscribe({
      next: (result) => {
        if (kind === 'video') this.videoUrl = result.url;
        else this.posterUrl = result.url;
        this.busy.set(false);
      },
      error: (failure: ApiFailure) => {
        this.message.set(failure.message);
        this.busy.set(false);
      },
    });
  }

  save() {
    if (!this.videoUrl || !this.posterUrl) {
      this.message.set('Upload both files first. Nothing is published until the files are stored.');
      return;
    }
    this.busy.set(true);
    this.api.publishReel({ ...this.form.getRawValue(), videoUrl: this.videoUrl, posterUrl: this.posterUrl }).subscribe({
      next: (reel) => void this.router.navigate(['/tabs/reels'], { queryParams: { status: reel.status } }),
      error: (failure: ApiFailure) => {
        this.message.set(failure.message);
        this.busy.set(false);
      },
    });
  }
}

@Component({
  selector: 'app-groups',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo],
  template: `
    <ion-content>
      <div class="page compact stack tight">
        <div class="spread">
          <h1 class="display" style="font-size:26px;margin:0">{{ 'group.title' | t }}</h1>
          <a class="icon-btn" routerLink="/tabs/groups/new" [attr.aria-label]="'group.create' | t"><ion-icon name="add-outline"></ion-icon></a>
        </div>
        <div class="seg">
          <button type="button" [class.on]="segment() === 'discover'" (click)="show('discover')">{{ 'group.discover' | t }}</button>
          <button type="button" [class.on]="segment() === 'mine'" (click)="show('mine')">{{ 'group.mine' | t }}</button>
        </div>
        @if (operator()) {
          <button class="chip" type="button" [class.on]="segment() === 'operator'" (click)="show('operator')">{{ 'group.looking' | t }}</button>
        }
        <form class="search" (submit)="filter($event)">
          <ion-icon name="search-outline"></ion-icon>
          <input name="destination" [placeholder]="'group.destination' | t" />
          <input name="budget" inputmode="decimal" [placeholder]="'filter.price' | t" style="max-width:88px" />
        </form>
        @if (loading()) { <div class="skel" style="height:72px;border-radius:16px"></div> }
        @else if (!rows().length) { <div class="empty">{{ 'group.empty' | t }}</div> }
        @else {
          @for (group of rows(); track group.id) {
            <a class="group-row" [routerLink]="['/tabs/group', group.id]">
              <div class="media"><app-photo [src]="group.coverImageUrl" [alt]="group.name"></app-photo></div>
              <span>
                <h3>{{ group.name }}</h3>
                <p class="muted">{{ group.destinationName }} · {{ group.departureDate || ('group.flexible' | t) }}</p>
                @if (group.budgetPerPerson) { <p class="muted">{{ money(group.budgetPerPerson) }}</p> }
              </span>
              <span class="count">{{ group.memberCount }}/{{ group.desiredSize }}</span>
            </a>
          }
        }
      </div>
    </ion-content>
  `,
})
export class GroupsPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly segment = signal<'discover' | 'mine' | 'operator'>('discover');
  readonly rows = signal<GroupCard[]>([]);
  readonly loading = signal(true);
  readonly operator = () => ['PROVIDER', 'GUIDE', 'ADMIN'].includes(this.auth.user()?.role ?? '');

  constructor() { this.reload(); }

  filter(event: Event) {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.reload({ destination: String(data.get('destination') ?? ''), budget: String(data.get('budget') ?? '') });
  }

  show(segment: 'discover' | 'mine' | 'operator') {
    this.segment.set(segment);
    this.reload();
  }

  reload(query: Record<string, string | undefined> = {}) {
    this.loading.set(true);
    const request = this.segment() === 'mine' ? this.api.myGroups() : this.segment() === 'operator' ? this.api.operatorGroups(query) : this.api.groups(query);
    request.subscribe({
      next: (rows) => { this.rows.set(rows); this.loading.set(false); },
      error: () => { this.rows.set([]); this.loading.set(false); },
    });
  }

  money(value: string) { return formatTjs(value); }
}

@Component({
  selector: 'app-group-create',
  imports: [IonContent, ReactiveFormsModule, TPipe, BackButton],
  template: `
    <ion-content>
      <div class="page compact stack tight">
        <div class="subhead">
          <app-back [label]="'common.back' | t"></app-back>
          <h1>{{ 'group.create' | t }}</h1>
        </div>
        <form class="stack tight" [formGroup]="form" (ngSubmit)="save()">
          <label class="lbl">{{ 'group.name' | t }}<input class="field" formControlName="name" /></label>
          <label class="lbl">{{ 'group.destination' | t }}<input class="field" formControlName="destinationName" /></label>
          <label class="lbl">
            <select class="field" formControlName="region" [attr.aria-label]="'group.destination' | t">
              @for (item of regions; track item) { <option [value]="item">{{ i18n.region(item) }}</option> }
            </select>
          </label>
          <label class="lbl">{{ 'group.about' | t }}<textarea class="field" formControlName="description"></textarea></label>
          <div class="grid-2">
            <label class="lbl">{{ 'filter.date' | t }}<input class="field" type="date" formControlName="departureDate" /></label>
            <label class="lbl">{{ 'group.size' | t }}<input class="field" type="number" formControlName="desiredSize" /></label>
          </div>
          <label class="menu-row"><input type="checkbox" formControlName="flexibleDates" /> {{ 'group.flexible' | t }}</label>
          <label class="lbl">{{ 'group.budget' | t }}<input class="field" formControlName="budgetPerPerson" /></label>
          <label class="lbl">{{ 'group.style' | t }}<input class="field" formControlName="travelStyle" /></label>
          <label class="lbl">{{ 'group.public' | t }}
            <select class="field" formControlName="visibility">
              <option value="PUBLIC">{{ 'group.public' | t }}</option>
              <option value="PRIVATE">{{ 'group.private' | t }}</option>
            </select>
          </label>
          <label class="lbl">{{ 'group.join' | t }}
            <select class="field" formControlName="joinMode">
              <option value="REQUEST">{{ 'group.askJoin' | t }}</option>
              <option value="OPEN">{{ 'group.openJoin' | t }}</option>
            </select>
          </label>
          <label class="lbl">{{ 'group.rules' | t }}<textarea class="field" formControlName="rules"></textarea></label>
          <label class="lbl">{{ 'group.cover' | t }}<input class="field" type="file" accept="image/jpeg,image/png,image/webp" (change)="cover($event)" /></label>
          <button class="primary full" type="submit">{{ 'group.create' | t }}</button>
        </form>
        @if (error()) { <p class="error-box">{{ error() }}</p> }
      </div>
    </ion-content>
  `,
})
export class GroupCreatePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(I18nService);
  readonly error = signal('');
  readonly regions = ['SUGHD', 'DUSHANBE', 'DRS', 'KHATLON', 'GBAO'];
  private coverUrl = '';
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    destinationName: ['', Validators.required],
    region: ['SUGHD', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
    departureDate: [''],
    departureTime: [''],
    flexibleDates: [true],
    budgetPerPerson: [''],
    desiredSize: [4, Validators.required],
    travelStyle: [''],
    visibility: ['PUBLIC'],
    joinMode: ['REQUEST'],
    rules: [''],
  });

  cover(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.uploadMedia(file).subscribe({
      next: (result) => { this.coverUrl = result.url; },
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }

  save() {
    const raw = this.form.getRawValue();
    this.api.createGroup({
      ...raw,
      departureDate: raw.departureDate || undefined,
      departureTime: raw.departureTime || undefined,
      budgetPerPerson: raw.budgetPerPerson || undefined,
      coverImageUrl: this.coverUrl || undefined,
      rules: raw.rules || undefined,
      travelStyle: raw.travelStyle || undefined,
    }).subscribe({
      next: (group) => void this.router.navigate(['/tabs/group', group.id]),
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }
}

@Component({
  selector: 'app-group-detail',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo, DatePipe],
  template: `
    <ion-content [scrollY]="false">
      @if (group(); as item) {
        <section class="wa">
          <header class="wa-bar">
            <a class="icon-btn" routerLink="/tabs/groups" [attr.aria-label]="'common.back' | t"><ion-icon name="chevron-back"></ion-icon></a>
            <button class="wa-who" type="button" (click)="info.set(true)">
              <span class="avatar" aria-hidden="true">{{ item.name.slice(0, 1) }}</span>
              <span>
                <strong>{{ item.name }}</strong>
                <span class="muted">{{ item.memberCount }}/{{ item.desiredSize }} · {{ item.destinationName }}</span>
              </span>
            </button>
            <button class="icon-btn" type="button" (click)="info.set(true)" [attr.aria-label]="'group.more' | t"><ion-icon name="ellipsis-vertical"></ion-icon></button>
          </header>
          <div class="wa-thread">
            @if (notice()) { <p class="bubble system">{{ notice() }}</p> }
            @if (!item.isMember) {
              <p class="bubble system">{{ item.description }}</p>
            } @else {
              @for (message of messages(); track message.id) {
                <article class="bubble" [class.mine]="message.sender?.mine" [class.system]="message.system">
                  @if (!message.system && !message.sender?.mine) { <span class="tiny">{{ message.sender?.firstName }}</span> }
                  <p>{{ message.body }}</p>
                  <span class="tiny">{{ message.createdAt | date: 'shortTime' }}</span>
                </article>
              }
            }
          </div>
          @if (!item.isMember) {
            <form class="wa-compose" (submit)="join($event)">
              <input name="message" [placeholder]="'group.joinNote' | t" />
              <button class="primary join-btn" type="submit">{{ item.joinMode === 'OPEN' ? ('group.join' | t) : ('group.request' | t) }}</button>
            </form>
          } @else {
            <form class="wa-compose" (submit)="send($event)">
              <input name="body" [placeholder]="'group.message' | t" />
              <button class="primary" type="submit" [attr.aria-label]="'reels.send' | t"><ion-icon name="send-outline"></ion-icon></button>
            </form>
          }
        </section>
        @if (info()) {
        <div class="info-screen">
        <div class="page compact stack tight">
          <header class="wa-bar" style="position:sticky;top:0;z-index:2;margin-inline:-12px">
            <button class="icon-btn" type="button" (click)="info.set(false)" [attr.aria-label]="'common.back' | t"><ion-icon name="chevron-back"></ion-icon></button>
            <strong>{{ 'group.more' | t }}</strong>
          </header>
          <div class="tour-hero" style="height:132px;border-radius:16px;overflow:hidden">
            <app-photo [src]="item.coverImageUrl" [alt]="item.name"></app-photo>
          </div>
          <div>
            <h1 class="display" style="font-size:24px;margin:0">{{ item.name }}</h1>
            <p class="muted" style="margin:4px 0 0">{{ item.destinationName }} · {{ item.departureDate || ('group.flexible' | t) }} {{ item.departureTime }}</p>
          </div>
          <div class="facts">
            <div><span class="tiny">{{ 'group.members' | t }}</span><strong>{{ item.memberCount }}/{{ item.desiredSize }}</strong></div>
            <div><span class="tiny">{{ 'common.perPerson' | t }}</span><strong>{{ item.budgetPerPerson ? money(item.budgetPerPerson) : ('group.flexible' | t) }}</strong></div>
            <div><span class="tiny">{{ 'group.organizer' | t }}</span><strong>{{ item.organizer.firstName }}</strong></div>
          </div>
          @if (item.members.length) {
            <div class="members">
              @for (member of item.members; track member.userId) {
                <span class="avatar" [attr.aria-label]="member.firstName">{{ member.firstName.slice(0, 1) }}</span>
              }
            </div>
          }
          <p>{{ item.description }}</p>
          <div class="chips">
            <span class="chip">{{ item.visibility }}</span>
            <span class="chip">{{ item.status }}</span>
            @if (item.summary.popularTour) { <span class="chip">{{ 'group.popular' | t }}: {{ item.summary.popularTour.title }} · {{ item.summary.popularTour.votes }}</span> }
            @if (item.summary.estimatedTotal) { <span class="chip">{{ 'group.estimate' | t }}: {{ money(item.summary.estimatedTotal) }}</span> }
          </div>
          <p class="tiny">{{ item.summary.note }}</p>
          @if (item.isMember && !item.isOrganizer) {
            <button class="ghost" type="button" (click)="leave()">{{ 'group.leave' | t }}</button>
          }
          @if (notice()) { <p class="notice">{{ notice() }}</p> }

          @if (item.isOrganizer) {
            <section class="stack">
              <h2>{{ 'group.requests' | t }}</h2>
              @for (request of item.joinRequests; track request.id) {
                <div class="soft-card"><div class="body">
                  <strong>{{ request.firstName }}</strong>
                  <p>{{ request.message }}</p>
                  <div class="row">
                    <button class="primary" type="button" (click)="decide(request.id, 'ACCEPTED')">{{ 'group.accept' | t }}</button>
                    <button class="ghost" type="button" (click)="decide(request.id, 'REJECTED')">{{ 'group.decline' | t }}</button>
                  </div>
                </div></div>
              }
              @for (request of item.contactRequests; track request.id) {
                <div class="soft-card"><div class="body">
                  <strong>{{ request.operatorFirstName }} · {{ request.status }}</strong>
                  <p>{{ request.message }}</p>
                  @if (request.status === 'PENDING') {
                    <div class="row">
                      <button class="primary" type="button" (click)="answerContact(request.id, 'ACCEPTED')">{{ 'group.accept' | t }}</button>
                      <button class="ghost" type="button" (click)="answerContact(request.id, 'DECLINED')">{{ 'group.decline' | t }}</button>
                    </div>
                  }
                </div></div>
              }
            </section>
          }

          <section class="stack">
            <h2>{{ 'group.proposals' | t }}</h2>
            @for (proposal of item.proposals; track proposal.id) {
              <article class="soft-card"><div class="body">
                <h3>{{ proposal.title }}</h3>
                <p class="muted">{{ proposal.operatorName }} · {{ 'common.days' | t: { count: proposal.durationDays } }}</p>
                <p>{{ money(proposal.pricePerPerson) }} {{ 'common.perPerson' | t }} · {{ proposal.votes }} {{ 'group.votes' | t }}</p>
                <p>{{ proposal.included }}</p>
                <p class="muted">{{ proposal.excluded }}</p>
                <div class="row">
                  @if (item.isMember) { <button class="primary" type="button" (click)="vote(proposal.id)">{{ item.myVote === proposal.id ? ('group.voted' | t) : ('group.vote' | t) }}</button> }
                  @if (item.isOrganizer) { <button class="ghost" type="button" (click)="select(proposal.id)">{{ 'group.select' | t }}</button> }
                  @if (proposal.tourSlug) { <a [routerLink]="['/tabs/tour', proposal.tourSlug]">{{ 'reels.viewTour' | t }}</a> }
                </div>
              </div></article>
            }
          </section>

          @if (item.isMember) {
            <section class="stack">
              <h2>{{ 'group.dates' | t }}</h2>
              @for (poll of item.polls; track poll.id) {
                <article class="soft-card"><div class="body">
                  <strong>{{ poll.question }}</strong>
                  @for (option of poll.options; track option.id) {
                    <div class="spread">
                      <span>{{ option.label }} · {{ option.votes }}</span>
                      @if (poll.status === 'OPEN') { <button class="chip" type="button" (click)="voteDate(poll.id, option.id)">{{ option.mine ? ('group.voted' | t) : ('group.vote' | t) }}</button> }
                      @if (item.isOrganizer && poll.status === 'OPEN') { <button class="chip" type="button" (click)="closeDate(poll.id, option.id)">{{ 'group.close' | t }}</button> }
                    </div>
                  }
                </div></article>
              }
              <form class="stack" (submit)="poll($event)">
                <input class="field" name="question" [placeholder]="'group.poll' | t" />
                <input class="field" name="options" placeholder="2026-11-14, 2026-11-21" />
                <button class="ghost" type="submit">{{ 'group.addPoll' | t }}</button>
              </form>
            </section>
          }

          @if (item.isMember || item.isOperator) {
            <form class="stack" (submit)="propose($event)">
              <h2>{{ 'group.propose' | t }}</h2>
              <input class="field" name="title" [placeholder]="'group.tourName' | t" />
              <input class="field" name="operatorName" [placeholder]="'group.operator' | t" />
              <input class="field" name="pricePerPerson" placeholder="350.00" />
              <input class="field" name="durationDays" type="number" value="1" />
              <input class="field" name="included" [placeholder]="'tour.included' | t" />
              <input class="field" name="excluded" [placeholder]="'tour.excluded' | t" />
              <button class="ghost" type="submit">{{ 'group.propose' | t }}</button>
            </form>
          }

          @if (item.isOperator && !item.isMember) {
            <form class="stack" (submit)="contact($event)">
              <h2>{{ 'group.contact' | t }}</h2>
              <textarea class="field" name="message" [placeholder]="'group.contactNote' | t"></textarea>
              <button class="primary" type="submit">{{ 'group.contact' | t }}</button>
            </form>
          }

          @if (item.isOrganizer) {
            <form class="stack" (submit)="inquire($event)">
              <h2>{{ 'inquiry.title' | t }}</h2>
              <input class="field" name="travelers" type="number" value="2" />
              <input class="field" name="proposedPrice" placeholder="350.00" />
              <input class="field" name="notes" [placeholder]="'inquiry.note' | t" />
              <button class="primary" type="submit">{{ 'inquiry.send' | t }}</button>
              <p class="tiny">{{ 'inquiry.noSeats' | t }}</p>
            </form>
          }
          <button class="ghost" type="button" (click)="reporting.set(true)">{{ 'group.report' | t }}</button>
          @if (reporting()) {
            <div class="sheet-backdrop" (click)="reporting.set(false)"></div>
            <form class="sheet stack" (submit)="report($event)">
              <div class="spread">
                <h2 style="margin:0">{{ 'group.report' | t }}</h2>
                <button class="icon-btn" type="button" (click)="reporting.set(false)" [attr.aria-label]="'common.close' | t"><ion-icon name="close-outline"></ion-icon></button>
              </div>
              <textarea class="field" name="reason" minlength="3" required></textarea>
              <button class="primary" type="submit">{{ 'group.report' | t }}</button>
            </form>
          }
        </div>
        </div>
        }
      } @else if (error()) {
        <div class="page error-box stack">
          <p>{{ error() }}</p>
          <button class="primary" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
        </div>
      } @else {
        <div class="page"><div class="skel skel-hero"></div></div>
      }
    </ion-content>
  `,
})
export class GroupDetailPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  readonly group = signal<GroupDetail | null>(null);
  readonly messages = signal<{ id: string; body: string; system: boolean; createdAt: string; sender: { firstName: string; mine: boolean } | null }[]>([]);
  readonly error = signal('');
  readonly notice = signal('');
  readonly reporting = signal(false);
  readonly info = signal(false);

  constructor() {
    this.reload();
    const timer = window.setInterval(() => {
      const item = this.group();
      if (item?.isMember) this.loadMessages(item.id);
    }, 8000);
    this.destroy.onDestroy(() => window.clearInterval(timer));
  }

  reload() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.group(id).subscribe({
      next: (group) => {
        this.group.set(group);
        if (group.isMember) this.loadMessages(group.id);
      },
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }

  loadMessages(id: string) {
    this.api.groupMessages(id).subscribe({
      next: (page) => {
        this.messages.set(page.messages);
        queueMicrotask(() => document.querySelector('.wa-thread')?.scrollTo(0, 999999));
      },
      error: () => undefined,
    });
  }

  join(event: Event) {
    event.preventDefault();
    const item = this.group();
    if (!item) return;
    const message = String(new FormData(event.target as HTMLFormElement).get('message') ?? '');
    this.api.joinGroup(item.id, message).subscribe({
      next: (result) => { this.notice.set(result.status); this.reload(); },
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }

  leave() {
    const item = this.group();
    if (!item) return;
    this.api.leaveGroup(item.id).subscribe({ next: () => this.reload() });
  }

  decide(requestId: string, status: string) {
    const item = this.group();
    if (!item) return;
    this.api.decideJoin(item.id, requestId, status).subscribe({ next: () => this.reload() });
  }

  answerContact(id: string, status: string) {
    this.api.decideContact(id, status).subscribe({ next: () => this.reload(), error: (failure: ApiFailure) => this.error.set(failure.message) });
  }

  vote(proposalId: string) {
    const item = this.group();
    if (!item) return;
    this.api.voteTour(item.id, proposalId).subscribe({ next: () => this.reload() });
  }

  select(proposalId: string) {
    const item = this.group();
    if (!item) return;
    this.api.selectTour(item.id, proposalId).subscribe({ next: () => this.reload() });
  }

  voteDate(pollId: string, optionId: string) {
    const item = this.group();
    if (!item) return;
    this.api.votePoll(item.id, pollId, optionId).subscribe({ next: () => this.reload() });
  }

  closeDate(pollId: string, optionId: string) {
    const item = this.group();
    if (!item) return;
    this.api.closePoll(item.id, pollId, optionId).subscribe({ next: () => this.reload() });
  }

  poll(event: Event) {
    event.preventDefault();
    const item = this.group();
    if (!item) return;
    const data = new FormData(event.target as HTMLFormElement);
    const options = String(data.get('options') ?? '').split(',').map((part) => part.trim()).filter(Boolean);
    this.api.createPoll(item.id, String(data.get('question') ?? ''), options).subscribe({ next: () => this.reload(), error: (failure: ApiFailure) => this.error.set(failure.message) });
  }

  send(event: Event) {
    event.preventDefault();
    const item = this.group();
    if (!item) return;
    const form = event.target as HTMLFormElement;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body) return;
    this.api.sendGroupMessage(item.id, body).subscribe({ next: () => { form.reset(); this.loadMessages(item.id); } });
  }

  propose(event: Event) {
    event.preventDefault();
    const item = this.group();
    if (!item) return;
    const data = new FormData(event.target as HTMLFormElement);
    this.api.proposeTour(item.id, {
      title: String(data.get('title') ?? ''),
      operatorName: String(data.get('operatorName') ?? ''),
      destinationName: item.destinationName,
      pricePerPerson: String(data.get('pricePerPerson') ?? ''),
      durationDays: Number(data.get('durationDays') ?? 1),
      included: String(data.get('included') ?? ''),
      excluded: String(data.get('excluded') ?? ''),
      custom: true,
    }).subscribe({ next: () => this.reload(), error: (failure: ApiFailure) => this.error.set(failure.message) });
  }

  contact(event: Event) {
    event.preventDefault();
    const item = this.group();
    if (!item) return;
    const message = String(new FormData(event.target as HTMLFormElement).get('message') ?? '');
    this.api.contactOrganizer(item.id, message).subscribe({
      next: () => this.notice.set('PENDING'),
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }

  inquire(event: Event) {
    event.preventDefault();
    const item = this.group();
    if (!item) return;
    const data = new FormData(event.target as HTMLFormElement);
    const contact = item.contactRequests.find((request) => request.status === 'ACCEPTED');
    const proposal = item.proposals.find((row) => row.id === item.summary.selectedProposalId) ?? item.proposals[0];
    this.api.sendInquiry(item.id, {
      contactRequestId: contact?.id,
      tourId: proposal?.tourId ?? undefined,
      proposalId: proposal?.id,
      travelers: Number(data.get('travelers') ?? 1),
      proposedPrice: String(data.get('proposedPrice') ?? '') || undefined,
      notes: String(data.get('notes') ?? ''),
    }).subscribe({
      next: (result) => this.notice.set(`${result.status} · seats reserved: ${result.seatsReserved}`),
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }

  report(event: Event) {
    event.preventDefault();
    const item = this.group();
    if (!item) return;
    const reason = String(new FormData(event.target as HTMLFormElement).get('reason') ?? '').trim();
    if (reason.length < 3) return;
    this.api.reportContent('GROUP', item.id, reason).subscribe({
      next: () => { this.reporting.set(false); this.notice.set('OPEN'); },
      error: (failure: ApiFailure) => this.error.set(failure.message),
    });
  }

  money(value: string | null) { return formatTjs(value); }
}

@Component({
  selector: 'app-tours-market',
  imports: [IonContent, IonIcon, RouterLink, TPipe, Photo],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'tabs.tours' | t }}</h1>
        <form class="search" (submit)="load($event)">
          <input name="q" [placeholder]="'home.search' | t" />
          <input name="maxPrice" [placeholder]="'filter.price' | t" />
        </form>
        @if (!rows().length) { <p>{{ 'explore.empty' | t }}</p> }
        @for (tour of rows(); track tour.id) {
          <article class="tour-card">
            <a class="media" [routerLink]="['/tabs/tour', tour.slug]"><app-photo [src]="tour.coverImageUrl" [alt]="tour.title"></app-photo></a>
            <div class="body">
              <h3>{{ tour.title }}</h3>
              <p class="muted">{{ tour.destination?.name || tour.destinationName }} · {{ 'common.days' | t: { count: tour.durationDays ?? 1 } }}</p>
              <p>{{ money(tour.pricePerPerson) }} {{ 'common.perPerson' | t }}</p>
              @if (tour.ratingCount) { <span class="chip">{{ tour.rating }} · {{ tour.ratingCount }}</span> }
              <div class="row">
                <a class="primary" [routerLink]="['/tabs/tour', tour.slug]">{{ 'reels.viewTour' | t }}</a>
                <button class="icon-btn" type="button" (click)="save(tour.id)"><ion-icon [name]="favorites.has('tour', tour.id) ? 'bookmark' : 'bookmark-outline'"></ion-icon></button>
              </div>
            </div>
          </article>
        }
      </div>
    </ion-content>
  `,
})
export class ToursMarketPage {
  private readonly api = inject(ApiService);
  readonly favorites = inject(FavoritesService);
  readonly rows = signal<TourCard[]>([]);
  constructor() { this.fetch(); void this.favorites.refresh(); }
  load(event: Event) {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.fetch({ q: String(data.get('q') ?? ''), maxPrice: String(data.get('maxPrice') ?? '') });
  }
  fetch(query: Record<string, string> = {}) {
    this.api.tours(query).subscribe((rows) => this.rows.set(rows));
  }
  save(id: string) { void this.favorites.toggle('tour', id); }
  money(value: string | null | undefined) { return formatTjs(value); }
}

@Component({
  selector: 'app-search',
  imports: [IonContent, RouterLink, TPipe],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'home.search' | t }}</h1>
        <form class="search" (submit)="run($event)"><input name="q" [value]="q()" /></form>
        <h2>{{ 'tabs.groups' | t }}</h2>
        @for (group of groups(); track group.id) { <a [routerLink]="['/tabs/group', group.id]">{{ group.name }} · {{ group.destinationName }}</a> }
        <h2>{{ 'tabs.tours' | t }}</h2>
        @for (tour of tours(); track tour.id) { <a [routerLink]="['/tabs/tour', tour.slug]">{{ tour.title }}</a> }
        <h2>{{ 'explore.places' | t }}</h2>
        @for (place of places(); track place.id) { <a [routerLink]="['/tabs/destination', place.slug]">{{ place.name }}</a> }
        <h2>{{ 'home.guides' | t }}</h2>
        @for (guide of guides(); track guide.id) { <a [routerLink]="['/tabs/guide', guide.id]">{{ guide.displayName }}</a> }
      </div>
    </ion-content>
  `,
})
export class SearchPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly q = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  readonly groups = signal<GroupCard[]>([]);
  readonly tours = signal<TourCard[]>([]);
  readonly places = signal<{ id: string; slug: string; name: string }[]>([]);
  readonly guides = signal<{ id: string; displayName: string }[]>([]);
  constructor() { this.fetch(this.q()); }
  run(event: Event) {
    event.preventDefault();
    this.fetch(String(new FormData(event.target as HTMLFormElement).get('q') ?? ''));
  }
  fetch(q: string) {
    this.q.set(q);
    this.api.socialSearch(q).subscribe((result) => this.groups.set(result.groups));
    this.api.tours({ q }).subscribe((rows) => this.tours.set(rows));
    this.api.destinations({ q }).subscribe((rows) => this.places.set(rows));
    this.api.guides(q).subscribe((rows) => this.guides.set(rows));
  }
}

@Component({
  selector: 'app-conversations',
  imports: [IonContent, RouterLink, TPipe],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'chat.title' | t }}</h1>
        @if (!rows().length) { <p>{{ 'chat.empty' | t }}</p> }
        @for (row of rows(); track row.id) {
          <a class="soft-card" [routerLink]="['/tabs/messages', row.id]"><div class="body"><strong>{{ row.with.join(', ') || row.groupName }}</strong><p>{{ row.preview }}</p></div></a>
        }
      </div>
    </ion-content>
  `,
})
export class ConversationsPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<ConversationCard[]>([]);
  constructor() { this.api.conversations().subscribe((rows) => this.rows.set(rows)); }
}

@Component({
  selector: 'app-conversation',
  imports: [IonContent, RouterLink, TPipe, DatePipe],
  template: `
    <ion-content>
      @if (thread(); as item) {
        <div class="page stack">
          <h1 class="display">{{ item.groupName || ('chat.title' | t) }}</h1>
          @if (item.groupId) { <a [routerLink]="['/tabs/group', item.groupId]">{{ 'chat.openGroup' | t }}</a> }
          @for (message of item.messages; track message.id) {
            <p><strong>{{ message.sender }}</strong> {{ message.body }} <span class="tiny">{{ message.createdAt | date: 'short' }}</span></p>
          }
          <form class="row" (submit)="send($event)">
            <input name="body" [placeholder]="'group.message' | t" />
            <button class="primary" type="submit">{{ 'reels.send' | t }}</button>
          </form>
        </div>
      }
    </ion-content>
  `,
})
export class ConversationPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly thread = signal<import('../core/models').ConversationDetail | null>(null);
  constructor() { this.reload(); }
  reload() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.conversation(id).subscribe((thread) => this.thread.set(thread));
  }
  send(event: Event) {
    event.preventDefault();
    const id = this.thread()?.id;
    if (!id) return;
    const form = event.target as HTMLFormElement;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body) return;
    this.api.sendDirect(id, body).subscribe(() => { form.reset(); this.reload(); });
  }
}

@Component({
  selector: 'app-inquiries',
  imports: [IonContent, RouterLink, TPipe],
  template: `
    <ion-content>
      <div class="page stack">
        <h1 class="display">{{ 'inquiry.title' | t }}</h1>
        <p class="tiny">{{ 'inquiry.noSeats' | t }}</p>
        @for (row of rows(); track row.id) {
          <article class="soft-card"><div class="body">
            <h3>{{ row.groupName }}</h3>
            <p>{{ row.tourTitle }} · {{ row.travelers }} · {{ row.status }}</p>
            @if (row.proposedPrice) { <p>{{ money(row.proposedPrice) }}</p> }
            <p class="tiny">{{ 'inquiry.reserved' | t }}: {{ row.seatsReserved }}</p>
            @if (row.incoming) {
              <div class="row">
                <button class="ghost" type="button" (click)="set(row.id, 'CONTACTED')">CONTACTED</button>
                <button class="primary" type="button" (click)="set(row.id, 'CONFIRMED')">CONFIRMED</button>
                <button class="ghost" type="button" (click)="set(row.id, 'CANCELLED')">CANCELLED</button>
              </div>
            }
            <a [routerLink]="['/tabs/group', row.groupId]">{{ 'chat.openGroup' | t }}</a>
          </div></article>
        }
      </div>
    </ion-content>
  `,
})
export class InquiriesPage {
  private readonly api = inject(ApiService);
  readonly rows = signal<InquiryCard[]>([]);
  constructor() { this.load(); }
  load() { this.api.inquiries().subscribe((rows) => this.rows.set(rows)); }
  set(id: string, status: string) { this.api.updateInquiry(id, status).subscribe(() => this.load()); }
  money(value: string | null) { return formatTjs(value); }
}
