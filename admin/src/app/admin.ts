import { JsonPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, Injectable, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OperatorFunction, map } from 'rxjs';
import { environment } from '../environments/environment';

interface Envelope<T> { data: T }

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class App {}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <form class="login" [formGroup]="form" (ngSubmit)="submit()">
      <h1>Rohi Travel</h1>
      <p>Administrator sign-in</p>
      <input formControlName="email" type="email" placeholder="Email" />
      <input formControlName="password" type="password" placeholder="Password" />
      @if (error()) { <p class="error">{{ error() }}</p> }
      <button class="primary" type="submit">Sign in</button>
    </form>
  `,
})
export class LoginPage {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['admin@rohi.local', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    this.http.post<Envelope<{ accessToken: string; refreshToken: string; user: { role: string } }>>(`${environment.apiUrl}/auth/login`, this.form.getRawValue()).subscribe({
      next: (response) => {
        if (response.data.user.role !== 'ADMIN') {
          this.error.set('This account is not an administrator.');
          return;
        }
        sessionStorage.setItem('rohi_admin_access', response.data.accessToken);
        sessionStorage.setItem('rohi_admin_refresh', response.data.refreshToken);
        void this.router.navigateByUrl('/dashboard');
      },
      error: (error: HttpErrorResponse) => this.error.set(messageOf(error)),
    });
  }
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <nav>
        <strong>Rohi admin</strong>
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/destinations" routerLinkActive="active">Destinations</a>
        <a routerLink="/tours" routerLinkActive="active">Tours</a>
        <a routerLink="/bookings" routerLinkActive="active">Bookings</a>
        <a routerLink="/users" routerLinkActive="active">Users</a>
        <a routerLink="/listings" routerLinkActive="active">Listings</a>
        <a routerLink="/companions" routerLinkActive="active">Companions</a>
        <a routerLink="/reviews" routerLinkActive="active">Reviews</a>
        <a routerLink="/reports" routerLinkActive="active">Reports</a>
        <a routerLink="/moderation" routerLinkActive="active">Moderation</a>
        <button class="ghost" type="button" (click)="logout()">Log out</button>
      </nav>
      <main><router-outlet></router-outlet></main>
    </div>
    @if (confirm.message()) {
      <div class="modal">
        <div class="card">
          <p>{{ confirm.message() }}</p>
          <div class="row">
            <button class="primary" type="button" (click)="confirm.yes()">Confirm</button>
            <button class="ghost" type="button" (click)="confirm.no()">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShellPage {
  private readonly router = inject(Router);
  readonly confirm = inject(ConfirmService);
  logout() {
    sessionStorage.removeItem('rohi_admin_access');
    void this.router.navigateByUrl('/login');
  }
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly message = signal('');
  private resolver: ((value: boolean) => void) | null = null;
  ask(message: string) {
    this.message.set(message);
    return new Promise<boolean>((resolve) => { this.resolver = resolve; });
  }
  yes() { this.finish(true); }
  no() { this.finish(false); }
  private finish(value: boolean) {
    this.message.set('');
    this.resolver?.(value);
    this.resolver = null;
  }
}

@Component({
  selector: 'app-dashboard',
  imports: [JsonPipe],
  template: `
    <h1>Dashboard</h1>
    @if (loading()) { <p>Loading records…</p> }
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (stats(); as data) {
      <div class="stats">
        @for (item of cards(data); track item.label) {
          <article class="card"><p>{{ item.label }}</p><h2>{{ item.value }}</h2></article>
        }
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Bookings by status</h3>
        <pre>{{ data['bookingsByStatus'] | json }}</pre>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>AI provider</h3>
        @if (ai(); as status) {
          <p>{{ status.configured ? 'Configured' : 'Not configured' }} · {{ status.model }} · {{ status.host || 'no host' }}</p>
        }
      </div>
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(AdminApi);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly stats = signal<Record<string, unknown> | null>(null);
  readonly ai = signal<{ configured: boolean; model: string; host: string } | null>(null);
  constructor() {
    this.api.get<Record<string, unknown>>('/admin/stats').subscribe({
      next: (data) => { this.stats.set(data); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.error.set(messageOf(error)); this.loading.set(false); },
    });
    this.api.get<{ configured: boolean; model: string; host: string }>('/admin/ai').subscribe((data) => this.ai.set(data));
  }
  cards(data: Record<string, unknown>) {
    return ['users', 'destinations', 'tours', 'bookings', 'stays', 'guides', 'openCompanions', 'reviews', 'groups', 'videos', 'inquiries', 'openReports', 'pendingListings']
      .map((key) => ({ label: key, value: String(data[key] ?? 0) }));
  }
}

@Component({
  selector: 'app-destinations',
  imports: [ReactiveFormsModule],
  template: `
    <h1>Destinations</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <form class="card" style="display:grid;gap:8px;margin-bottom:16px" [formGroup]="form" (ngSubmit)="save()">
      <strong>{{ editing() ? 'Edit destination' : 'New destination' }}</strong>
      <input formControlName="name" placeholder="Name" />
      <div class="row">
        <select formControlName="region"><option>SUGHD</option><option>DUSHANBE</option><option>DRS</option><option>KHATLON</option><option>GBAO</option></select>
        <select formControlName="category"><option>LAKES</option><option>MOUNTAINS</option><option>CITIES</option><option>CULTURE</option><option>ROAD</option><option>NATURE</option></select>
      </div>
      <input formControlName="latitude" placeholder="Latitude" />
      <input formControlName="longitude" placeholder="Longitude" />
      <textarea formControlName="summary" placeholder="English summary"></textarea>
      <textarea formControlName="description" placeholder="English description"></textarea>
      <input formControlName="activities" placeholder="lakes, photography" />
      <input formControlName="coverImageUrl" placeholder="Image URL" />
      <label>Upload JPEG, PNG, or WebP<input type="file" accept="image/jpeg,image/png,image/webp" (change)="uploadCover($event)" /></label>
      <label><input type="checkbox" formControlName="published" /> Published</label>
      <div class="row">
        <button class="primary" type="submit">Save</button>
        <button class="ghost" type="button" (click)="reset()">Clear</button>
      </div>
    </form>
    <table>
      @for (row of rows(); track row.id) {
        <tr>
          <td><strong>{{ row.name }}</strong><br>{{ row.region }} · {{ row.published ? 'Published' : 'Unpublished' }}</td>
          <td class="row">
            <button class="ghost" type="button" (click)="edit(row)">Edit</button>
            <button class="ghost" type="button" (click)="toggle(row)">{{ row.published ? 'Unpublish' : 'Publish' }}</button>
            <button class="ghost" type="button" (click)="remove(row)">Delete</button>
          </td>
        </tr>
      }
    </table>
  `,
})
export class DestinationsPage {
  private readonly api = inject(AdminApi);
  private readonly confirm = inject(ConfirmService);
  readonly rows = signal<DestinationRow[]>([]);
  readonly error = signal('');
  readonly editing = signal<string | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    region: ['SUGHD'],
    category: ['LAKES'],
    latitude: ['38.573000'],
    longitude: ['68.786000'],
    summary: ['', Validators.required],
    description: ['', Validators.required],
    activities: ['culture'],
    coverImageUrl: [''],
    published: [false],
  });

  constructor() { this.load(); }
  load() {
    this.api.get<DestinationRow[]>('/destinations/manage').subscribe({
      next: (rows) => this.rows.set(rows),
      error: (error: HttpErrorResponse) => this.error.set(messageOf(error)),
    });
  }
  private snapshot: DestinationRow | null = null;
  edit(row: DestinationRow) {
    this.editing.set(row.id);
    this.snapshot = row;
    this.form.patchValue({
      name: row.name,
      region: row.region,
      category: row.category,
      latitude: row.latitude ?? '',
      longitude: row.longitude ?? '',
      summary: row.summary,
      description: row.description ?? row.summary,
      activities: (row.activities ?? []).join(', '),
      coverImageUrl: row.coverImageUrl ?? '',
      published: row.published,
    });
  }
  reset() { this.editing.set(null); this.snapshot = null; this.form.reset({ region: 'SUGHD', category: 'LAKES', latitude: '38.573000', longitude: '68.786000', published: false }); }
  save() {
    const value = this.form.getRawValue();
    const row = this.snapshot;
    const cover = value.coverImageUrl.trim();
    const kept = (row?.images ?? []).filter((image) => image.url !== cover);
    const body = {
      name: value.name,
      region: value.region,
      category: value.category,
      latitude: value.latitude,
      longitude: value.longitude,
      activities: value.activities.split(',').map((item) => item.trim()).filter(Boolean),
      coverImageUrl: cover || undefined,
      published: value.published,
      featured: row?.featured ?? false,
      trending: row?.trending ?? false,
      weekend: row?.weekend ?? false,
      budgetFriendly: row?.budgetFriendly ?? false,
      suggestedDays: row?.suggestedDays ?? undefined,
      bestPeriod: row?.bestPeriod ?? undefined,
      budgetEstimateMin: row?.budgetEstimateMin ?? undefined,
      budgetEstimateMax: row?.budgetEstimateMax ?? undefined,
      budgetNote: row?.budgetNote ?? undefined,
      copy: { en: { summary: value.summary, description: value.description } },
      images: cover
        ? [{ url: cover, alt: value.name, credit: kept[0]?.credit || row?.images?.[0]?.credit || 'Administrator upload or permitted URL' }, ...kept]
        : kept,
    };
    const request = this.editing()
      ? this.api.patch(`/destinations/${this.editing()}`, body)
      : this.api.post('/destinations', body);
    request.subscribe({ next: () => { this.reset(); this.load(); }, error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) });
  }
  uploadCover(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload(file).subscribe({
      next: (data) => this.form.patchValue({ coverImageUrl: data.url }),
      error: (error: HttpErrorResponse) => this.error.set(messageOf(error)),
    });
  }
  toggle(row: DestinationRow) {
    this.api.patch(`/destinations/${row.id}`, this.bodyFrom(row, !row.published)).subscribe({ next: () => this.load(), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) });
  }
  async remove(row: DestinationRow) {
    if (!(await this.confirm.ask(`Delete ${row.name}? Bookings will block this.`))) return;
    this.api.delete(`/destinations/${row.id}`).subscribe({ next: () => this.load(), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) });
  }
  private bodyFrom(row: DestinationRow, published: boolean) {
    return {
      name: row.name,
      region: row.region,
      category: row.category,
      latitude: row.latitude || '38.573000',
      longitude: row.longitude || '68.786000',
      activities: row.activities ?? [],
      published,
      featured: row.featured ?? false,
      trending: row.trending ?? false,
      weekend: row.weekend ?? false,
      budgetFriendly: row.budgetFriendly ?? false,
      suggestedDays: row.suggestedDays ?? undefined,
      bestPeriod: row.bestPeriod ?? undefined,
      budgetEstimateMin: row.budgetEstimateMin ?? undefined,
      budgetEstimateMax: row.budgetEstimateMax ?? undefined,
      budgetNote: row.budgetNote ?? undefined,
      coverImageUrl: row.coverImageUrl ?? undefined,
      copy: { en: { summary: row.summary, description: row.description || row.summary } },
      images: row.images ?? [],
    };
  }
}

interface DestinationRow {
  id: string;
  name: string;
  region: string;
  category: string;
  summary: string;
  description?: string;
  latitude?: string | null;
  longitude?: string | null;
  activities?: string[];
  coverImageUrl?: string | null;
  published: boolean;
  featured?: boolean;
  trending?: boolean;
  weekend?: boolean;
  budgetFriendly?: boolean;
  suggestedDays?: number | null;
  bestPeriod?: string | null;
  budgetEstimateMin?: string | null;
  budgetEstimateMax?: string | null;
  budgetNote?: string | null;
  images?: { url: string; alt: string; credit?: string | null }[];
}

@Component({
  selector: 'app-tours',
  template: `
    <h1>Tours and capacity</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <table>
      @for (row of rows(); track row.id) {
        <tr>
          <td>{{ row.title }}<br>{{ row.pricePerPerson }} TJS · {{ row.published ? 'Published' : 'Draft' }}</td>
          <td>
            <button class="ghost" type="button" (click)="open(row)">Dates</button>
          </td>
        </tr>
      }
    </table>
    @if (current(); as tour) {
      <form class="card" style="margin-top:16px;display:grid;gap:8px" (submit)="addDate($event, tour.id)">
        <strong>{{ tour.title }}</strong>
        <input name="startDate" type="date" required />
        <input name="endDate" type="date" required />
        <input name="capacity" type="number" min="1" value="8" required />
        <button class="primary" type="submit">Add date</button>
      </form>
    }
  `,
})
export class ToursPage {
  private readonly api = inject(AdminApi);
  readonly rows = signal<{ id: string; title: string; pricePerPerson: string; published: boolean }[]>([]);
  readonly current = signal<{ id: string; title: string } | null>(null);
  readonly error = signal('');
  constructor() {
    this.api.get<{ id: string; title: string; pricePerPerson: string; published: boolean }[]>('/tours/manage').subscribe({
      next: (rows) => this.rows.set(rows),
      error: (error: HttpErrorResponse) => this.error.set(messageOf(error)),
    });
  }
  open(row: { id: string; title: string }) { this.current.set(row); }
  addDate(event: Event, tourId: string) {
    event.preventDefault();
    const data = new FormData(event.target as HTMLFormElement);
    this.api.post(`/tours/${tourId}/dates`, {
      startDate: data.get('startDate'),
      endDate: data.get('endDate'),
      capacity: Number(data.get('capacity')),
      status: 'OPEN',
    }).subscribe({ next: () => this.error.set(''), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) });
  }
}

@Component({
  selector: 'app-bookings',
  template: `
    <h1>Booking requests</h1>
    <p>Status changes are saved in the database. No payment is marked as collected.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <table>
      @for (row of rows(); track row.id) {
        <tr>
          <td>{{ row.reference }}<br>{{ row.userName }} · {{ row.tour.title }}<br>{{ row.startDate }} · {{ row.totalPrice }} {{ row.currency }}</td>
          <td>
            <select [value]="row.status" (change)="set(row.id, $any($event.target).value)">
              <option>PENDING</option><option>CONFIRMED</option><option>CANCELLED</option><option>COMPLETED</option>
            </select>
            <div>{{ row.paymentStatus }}</div>
          </td>
        </tr>
      }
    </table>
  `,
})
export class BookingsPage {
  private readonly api = inject(AdminApi);
  readonly rows = signal<{ id: string; reference: string; status: string; userName: string; totalPrice: string; currency: string; startDate: string; paymentStatus: string; tour: { title: string } }[]>([]);
  readonly error = signal('');
  constructor() { this.load(); }
  load() {
    this.api.get<{ id: string; reference: string; status: string; userName: string; totalPrice: string; currency: string; startDate: string; paymentStatus: string; tour: { title: string } }[]>('/bookings/manage').subscribe({
      next: (rows) => this.rows.set(rows),
      error: (error: HttpErrorResponse) => this.error.set(messageOf(error)),
    });
  }
  set(id: string, status: string) {
    this.api.patch(`/bookings/${id}/status`, { status }).subscribe({ next: () => this.load(), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) });
  }
}

@Component({
  selector: 'app-users',
  template: `
    <h1>Users</h1>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <table>
      @for (row of rows(); track row.id) {
        <tr>
          <td>{{ row.firstName }} {{ row.lastName }}<br>{{ row.email }} @if (row.deletionRequestedAt) { · deletion requested } @if (row.suspendedAt) { · suspended }</td>
          <td>
            <select [value]="row.role" (change)="set(row.id, $any($event.target).value)">
              <option>USER</option><option>GUIDE</option><option>PROVIDER</option><option>ADMIN</option>
            </select>
            <button class="ghost" type="button" (click)="suspend(row.id, !row.suspendedAt)">{{ row.suspendedAt ? 'Reinstate' : 'Suspend' }}</button>
          </td>
        </tr>
      }
    </table>
  `,
})
export class UsersPage {
  private readonly api = inject(AdminApi);
  readonly rows = signal<{ id: string; email: string; firstName: string; lastName: string; role: string; deletionRequestedAt: string | null; suspendedAt: string | null }[]>([]);
  readonly error = signal('');
  constructor() { this.load(); }
  load() { this.api.get<never[]>('/admin/users').subscribe({ next: (rows) => this.rows.set(rows as never), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) }); }
  set(id: string, role: string) { this.api.patch(`/admin/users/${id}/role`, { role }).subscribe({ next: () => this.load(), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) }); }
  suspend(id: string, suspended: boolean) { this.api.patch(`/admin/users/${id}/suspension`, { suspended }).subscribe({ next: () => this.load(), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) }); }
}

@Component({
  selector: 'app-listings',
  template: `
    <h1>Provider submissions</h1>
    <p>Approval publishes an unverified listing. It is never marked certified.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    <table>
      @for (row of rows(); track row.id) {
        <tr>
          <td>{{ row.name }} · {{ row.kind }} · {{ row.status }}<br>{{ row.description }}</td>
          <td class="row">
            <button class="primary" type="button" (click)="review(row.id, 'PUBLISHED')">Approve</button>
            <button class="ghost" type="button" (click)="review(row.id, 'REJECTED')">Reject</button>
          </td>
        </tr>
      }
    </table>
  `,
})
export class ListingsPage {
  private readonly api = inject(AdminApi);
  readonly rows = signal<{ id: string; name: string; kind: string; status: string; description: string }[]>([]);
  readonly error = signal('');
  constructor() { this.api.get<never[]>('/provider-listings/manage').subscribe({ next: (rows) => this.rows.set(rows as never), error: (error: HttpErrorResponse) => this.error.set(messageOf(error)) }); }
  review(id: string, status: string) {
    this.api.patch(`/admin/provider-listings/${id}`, { status, reviewNote: status }).subscribe({
      next: () => location.reload(),
      error: (error: HttpErrorResponse) => this.error.set(messageOf(error)),
    });
  }
}

@Component({
  selector: 'app-companions',
  template: `
    <h1>Companion moderation</h1>
    <table>
      @for (row of rows(); track row.id) {
        <tr>
          <td>{{ row.title }} · {{ row.status }} · {{ row.hostEmail }}</td>
          <td><button class="ghost" type="button" (click)="cancel(row.id)">Close invitation</button></td>
        </tr>
      }
    </table>
  `,
})
export class CompanionsAdminPage {
  private readonly api = inject(AdminApi);
  readonly rows = signal<{ id: string; title: string; status: string; hostEmail: string }[]>([]);
  constructor() { this.api.get<never[]>('/companions/manage/all').subscribe((rows) => this.rows.set(rows as never)); }
  cancel(id: string) { this.api.post(`/companions/${id}/cancel`, {}).subscribe(() => location.reload()); }
}

@Component({
  selector: 'app-reviews',
  template: `
    <h1>Reviews</h1>
    <table>
      @for (row of rows(); track row.id) {
        <tr>
          <td>{{ row.rating }}/5 · {{ row.status }}<br>{{ row.comment }}</td>
          <td><button class="ghost" type="button" (click)="hide(row.id)">{{ row.status === 'HIDDEN' ? 'Publish' : 'Hide' }}</button></td>
        </tr>
      }
    </table>
  `,
})
export class ReviewsPage {
  private readonly api = inject(AdminApi);
  readonly rows = signal<{ id: string; rating: number; comment: string; status: string }[]>([]);
  constructor() { this.load(); }
  load() { this.api.get<never[]>('/reviews/manage').subscribe((rows) => this.rows.set(rows as never)); }
  hide(id: string) {
    const row = this.rows().find((item) => item.id === id);
    this.api.patch(`/reviews/${id}`, { status: row?.status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN' }).subscribe(() => this.load());
  }
}

@Component({
  selector: 'app-reports',
  template: `
    <h1>Reports</h1>
    <table>
      @for (row of rows(); track row.id) {
        <tr><td>{{ row.reason }}<br>{{ row.reporter }} reported {{ row.reported }}</td><td>{{ row.details }}</td></tr>
      }
    </table>
  `,
})
export class ReportsPage {
  private readonly api = inject(AdminApi);
  readonly rows = signal<{ id: string; reason: string; details?: string; reporter: string; reported: string }[]>([]);
  constructor() { this.api.get<never[]>('/admin/reports').subscribe((rows) => this.rows.set(rows as never)); }
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private headers() {
    return { Authorization: `Bearer ${sessionStorage.getItem('rohi_admin_access') ?? ''}` };
  }
  get<T>(path: string) { return this.http.get<Envelope<T>>(`${environment.apiUrl}${path}`, { headers: this.headers() }).pipe(mapData<T>()); }
  post<T>(path: string, body: unknown) { return this.http.post<Envelope<T>>(`${environment.apiUrl}${path}`, body, { headers: this.headers() }).pipe(mapData<T>()); }
  patch<T>(path: string, body: unknown) { return this.http.patch<Envelope<T>>(`${environment.apiUrl}${path}`, body, { headers: this.headers() }).pipe(mapData<T>()); }
  delete<T>(path: string) { return this.http.delete<Envelope<T>>(`${environment.apiUrl}${path}`, { headers: this.headers() }).pipe(mapData<T>()); }
  upload(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<Envelope<{ url: string }>>(`${environment.apiUrl}/uploads/image`, body, { headers: this.headers() }).pipe(mapData<{ url: string }>());
  }
}

function mapData<T>(): OperatorFunction<Envelope<T>, T> {
  return map((response) => response.data);
}

function messageOf(error: HttpErrorResponse) {
  const payload = error.error as { message?: string | string[] } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(' ');
  return payload?.message || 'Request failed.';
}
