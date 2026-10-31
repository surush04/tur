import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { AdminApi } from './admin';

interface Queue {
  videos: { id: string; caption: string; status: string; creator: string }[];
  reports: { id: string; targetType: string; reason: string; status: string }[];
  inquiries: { id: string; status: string; group: string; travelers: number }[];
  contacts: { id: string; status: string; group: string }[];
  groups: { id: string; name: string; visibility: string; members: number; status: string }[];
}

@Component({
  selector: 'app-moderation',
  template: `
    <h1>Social moderation</h1>
    <p>Counts and rows come from the database. A video stays hidden until it is published.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (queue(); as data) {
      <h2>Videos</h2>
      <table>
        @for (row of data.videos; track row.id) {
          <tr>
            <td>{{ row.caption }}<br>{{ row.creator }} · {{ row.status }}</td>
            <td class="row">
              <button class="primary" type="button" (click)="video(row.id, 'PUBLISHED')">Publish</button>
              <button class="ghost" type="button" (click)="video(row.id, 'HIDDEN')">Hide</button>
            </td>
          </tr>
        }
      </table>
      <h2>Reports</h2>
      <table>
        @for (row of data.reports; track row.id) {
          <tr>
            <td>{{ row.targetType }} · {{ row.reason }}</td>
            <td><button class="ghost" type="button" (click)="report(row.id)">Mark reviewed</button></td>
          </tr>
        }
      </table>
      <h2>Inquiries</h2>
      <table>@for (row of data.inquiries; track row.id) { <tr><td>{{ row.group }} · {{ row.travelers }} · {{ row.status }}</td></tr> }</table>
      <h2>Contact requests</h2>
      <table>@for (row of data.contacts; track row.id) { <tr><td>{{ row.group }} · {{ row.status }}</td></tr> }</table>
      <h2>Groups</h2>
      <table>@for (row of data.groups; track row.id) { <tr><td>{{ row.name }} · {{ row.visibility }} · {{ row.members }} · {{ row.status }}</td></tr> }</table>
    }
  `,
})
export class ModerationPage {
  private readonly api = inject(AdminApi);
  readonly queue = signal<Queue | null>(null);
  readonly error = signal('');
  constructor() { this.load(); }
  load() {
    this.api.get<Queue>('/social/admin/queue').subscribe({
      next: (queue) => this.queue.set(queue),
      error: (error: HttpErrorResponse) => this.error.set(error.error?.message ?? 'Could not load moderation records.'),
    });
  }
  video(id: string, status: string) {
    this.api.patch(`/social/admin/videos/${id}`, { status }).subscribe({ next: () => this.load(), error: (error: HttpErrorResponse) => this.error.set(error.error?.message ?? 'Update failed.') });
  }
  report(id: string) {
    this.api.patch(`/social/admin/reports/${id}`, { status: 'REVIEWED' }).subscribe({ next: () => this.load() });
  }
}
