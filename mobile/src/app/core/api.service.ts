import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { I18nService } from './i18n';
import {
  BookingRecord,
  ConversationCard,
  ConversationDetail,
  Destination,
  GroupCard,
  GroupDetail,
  GroupMessage,
  GuideCard,
  HomePayload,
  InquiryCard,
  PlanResult,
  Reel,
  SessionUser,
  StayCard,
  TourCard,
  TourDetail,
} from './models';

export interface ApiFailure {
  status: number;
  message: string;
  code?: string;
}

interface Envelope<T> {
  data: T;
  meta?: { page: number; pageSize: number; total: number };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  home() {
    return this.get<HomePayload>('/destinations/home');
  }

  destinations(query: Record<string, string | number | boolean | undefined>) {
    return this.get<Destination[]>('/destinations', query);
  }

  destination(slug: string) {
    return this.get<Destination>(`/destinations/${slug}`);
  }

  tours(query: Record<string, string | number | boolean | undefined>) {
    return this.get<TourCard[]>('/tours', query);
  }

  tour(slug: string) {
    return this.get<TourDetail>(`/tours/${slug}`);
  }

  mapPoints() {
    return this.get<{
      destinations: { id: string; slug: string; name: string; region: string; latitude: string; longitude: string; coverImageUrl?: string | null; kind: string }[];
      tours: { id: string; slug: string; name: string; region: string; latitude: string | null; longitude: string | null; coverImageUrl?: string | null; kind: string }[];
      accommodations: { id: string; slug: string; name: string; region?: string; latitude: string | null; longitude: string | null; coverImageUrl?: string | null; kind: string }[];
    }>('/destinations/map');
  }

  bookings() {
    return this.get<BookingRecord[]>('/bookings/mine');
  }

  booking(id: string) {
    return this.get<BookingRecord>(`/bookings/${id}`);
  }

  createBooking(body: unknown) {
    return this.post<BookingRecord>('/bookings', body);
  }

  cancelBooking(id: string) {
    return this.post<BookingRecord>(`/bookings/${id}/cancel`, {});
  }

  favorites() {
    return this.get<{ id: string; destinationId?: string | null; tourId?: string | null; accommodationId?: string | null; guideId?: string | null; title: string; subtitle: string; image?: string | null; href: string }[]>('/favorites');
  }

  addFavorite(body: { destinationId?: string; tourId?: string; accommodationId?: string; guideId?: string }) {
    return this.post<{ id: string }>('/favorites', body);
  }

  removeFavorite(id: string) {
    return this.http.delete(`${environment.apiUrl}/favorites/${id}`);
  }

  notifications() {
    return this.get<{ id: string; title: string; body: string; readAt: string | null; createdAt: string }[]>('/notifications');
  }

  readNotification(id: string) {
    return this.post(`/notifications/${id}/read`, {});
  }

  stays(q?: string) {
    return this.get<StayCard[]>('/accommodations', q ? { q } : {});
  }

  stay(slug: string) {
    return this.get<StayCard>(`/accommodations/${slug}`);
  }

  guides(q?: string) {
    return this.get<GuideCard[]>('/guides', q ? { q } : {});
  }

  guide(id: string) {
    return this.get<GuideCard>(`/guides/${id}`);
  }

  companions() {
    return this.get<Record<string, unknown>[]>('/companions');
  }

  companion(id: string) {
    return this.get<Record<string, unknown>>(`/companions/${id}`);
  }

  createCompanion(body: unknown) {
    return this.post('/companions', body);
  }

  joinCompanion(id: string, message: string) {
    return this.post(`/companions/${id}/join`, { message });
  }

  decideCompanion(id: string, requestId: string, status: 'ACCEPTED' | 'REJECTED') {
    return this.patch(`/companions/${id}/requests/${requestId}`, { status });
  }

  cancelCompanion(id: string) {
    return this.post(`/companions/${id}/cancel`, {});
  }

  reportUser(userId: string, reason: string) {
    return this.post('/companions/report', { userId, reason });
  }

  blockUser(userId: string) {
    return this.post('/companions/block', { userId });
  }

  plan(body: unknown) {
    return this.post<PlanResult>('/ai/plan', body);
  }

  aiStatus() {
    return this.get<{ configured: boolean; mode: string }>('/ai/status');
  }

  saveItinerary(body: unknown) {
    return this.post<{ id: string }>('/itineraries', body);
  }

  itinerary(id: string) {
    return this.get<PlanResult & { id: string; budgetTjs: string | null }>('/itineraries/' + id);
  }

  itineraries() {
    return this.get<{ id: string; title: string; source: string; totalEstimate: string | null }[]>('/itineraries');
  }

  removeActivity(itineraryId: string, activityId: string) {
    return this.http.delete(`${environment.apiUrl}/itineraries/${itineraryId}/activities/${activityId}`);
  }

  updateProfile(body: unknown) {
    return this.patch<SessionUser>('/users/me', body);
  }

  me() {
    return this.get<SessionUser>('/users/me');
  }

  setMode(mode: 'traveler' | 'owner') {
    return this.post<SessionUser>('/users/me/mode', { mode });
  }

  ownerDashboard() {
    return this.get<{
      views: number;
      tours: { id: string; slug: string; title: string; pricePerPerson: string | null; published: boolean; viewCount: number; durationDays: number }[];
      videos: { id: string; caption: string; status: string }[];
      groups: { id: string; name: string; memberCount: number; desiredSize: number }[];
    }>('/owner/dashboard');
  }

  ownerTour(id: string) {
    return this.get<{
      id: string;
      destinationId: string;
      title: string;
      summary: string;
      description: string;
      category: string;
      difficulty: string;
      durationDays: number;
      meetingPoint: string;
      included: string;
      pricePerPerson: string | null;
      contactPhone: string;
      published: boolean;
      coverImageUrl: string;
      imageUrls: string[];
    }>(`/owner/tours/${id}`);
  }

  saveOwnerTour(body: unknown, id?: string) {
    return id ? this.patch<{ id: string; slug: string }>(`/owner/tours/${id}`, body) : this.post<{ id: string; slug: string }>('/owner/tours', body);
  }

  deleteOwnerTour(id: string) {
    return this.del<{ ok: boolean; hidden: boolean }>(`/owner/tours/${id}`);
  }

  deleteOwnerVideo(id: string) {
    return this.del<{ ok: boolean }>(`/owner/videos/${id}`);
  }

  requestDeletion() {
    return this.post<{ ok: boolean; message: string }>('/users/me/deletion-request', {});
  }

  submitListing(body: unknown) {
    return this.post('/provider-listings', body);
  }

  review(body: unknown) {
    return this.post('/reviews', body);
  }

  socialSearch(q: string) {
    return this.get<{ groups: GroupCard[]; videos: Reel[] }>('/social/search', { q });
  }

  reels() {
    return this.get<Reel[]>('/social/videos');
  }

  myReels() {
    return this.get<Reel[]>('/social/videos/mine');
  }

  savedReels() {
    return this.get<Reel[]>('/social/videos/saved');
  }

  publishReel(body: unknown) {
    return this.post<Reel>('/social/videos', body);
  }

  likeReel(id: string) {
    return this.post<{ liked: boolean; count: number }>(`/social/videos/${id}/like`, {});
  }

  saveReel(id: string) {
    return this.post<{ saved: boolean }>(`/social/videos/${id}/save`, {});
  }

  reelComments(id: string) {
    return this.get<{ id: string; body: string; author: string; createdAt: string }[]>(`/social/videos/${id}/comments`);
  }

  commentReel(id: string, body: string) {
    return this.post(`/social/videos/${id}/comments`, { body });
  }

  groups(query: Record<string, string | undefined> = {}) {
    return this.get<GroupCard[]>('/social/groups', query);
  }

  myGroups() {
    return this.get<(GroupCard & { role: string })[]>('/social/groups/mine');
  }

  operatorGroups(query: Record<string, string | undefined> = {}) {
    return this.get<GroupCard[]>('/social/groups/operator', query);
  }

  createGroup(body: unknown) {
    return this.post<{ id: string }>('/social/groups', body);
  }

  group(id: string) {
    return this.get<GroupDetail>(`/social/groups/${id}`);
  }

  joinGroup(id: string, message?: string) {
    return this.post<{ status: string }>(`/social/groups/${id}/join`, { message });
  }

  leaveGroup(id: string) {
    return this.post(`/social/groups/${id}/leave`, {});
  }

  decideJoin(groupId: string, requestId: string, status: string) {
    return this.patch(`/social/groups/${groupId}/requests/${requestId}`, { status });
  }

  groupMessages(id: string) {
    return this.get<{ messages: GroupMessage[]; nextBefore: string | null }>(`/social/groups/${id}/messages`);
  }

  sendGroupMessage(id: string, body: string) {
    return this.post(`/social/groups/${id}/messages`, { body });
  }

  proposeTour(id: string, body: unknown) {
    return this.post(`/social/groups/${id}/proposals`, body);
  }

  voteTour(groupId: string, proposalId: string) {
    return this.post(`/social/groups/${groupId}/proposals/${proposalId}/vote`, {});
  }

  selectTour(groupId: string, proposalId: string) {
    return this.post(`/social/groups/${groupId}/proposals/${proposalId}/select`, {});
  }

  createPoll(id: string, question: string, options: string[]) {
    return this.post(`/social/groups/${id}/polls`, { question, options });
  }

  votePoll(groupId: string, pollId: string, optionId: string) {
    return this.post(`/social/groups/${groupId}/polls/${pollId}/vote`, { optionId });
  }

  closePoll(groupId: string, pollId: string, optionId: string) {
    return this.post(`/social/groups/${groupId}/polls/${pollId}/close`, { optionId });
  }

  contactOrganizer(groupId: string, message: string, tourId?: string) {
    return this.post(`/social/groups/${groupId}/contact`, { message, tourId });
  }

  decideContact(id: string, status: string) {
    return this.patch<{ status: string; conversationId?: string }>(`/social/contact-requests/${id}`, { status });
  }

  conversations() {
    return this.get<ConversationCard[]>('/social/conversations');
  }

  conversation(id: string) {
    return this.get<ConversationDetail>(`/social/conversations/${id}`);
  }

  sendDirect(id: string, body: string) {
    return this.post(`/social/conversations/${id}/messages`, { body });
  }

  messageOperator(tourId: string, body: string) {
    return this.post<{ id: string }>('/social/conversations', { tourId, body });
  }

  inquiries() {
    return this.get<InquiryCard[]>('/social/inquiries');
  }

  sendInquiry(groupId: string, body: unknown) {
    return this.post<{ id: string; status: string; seatsReserved: boolean }>(`/social/groups/${groupId}/inquiries`, body);
  }

  updateInquiry(id: string, status: string, note?: string) {
    return this.patch<InquiryCard>(`/social/inquiries/${id}`, { status, note });
  }

  reportContent(targetType: string, targetId: string, reason: string) {
    return this.post('/social/reports', { targetType, targetId, reason });
  }

  uploadMedia(file: File) {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<Envelope<{ url: string; kind: string }>>(`${environment.apiUrl}/social/media`, body).pipe(
      map((response) => response.data),
      catchError((error: unknown) => throwError(() => this.fail(error))),
    );
  }

  private get<T>(path: string, query: Record<string, string | number | boolean | undefined> = {}) {
    return this.http.get<Envelope<T>>(`${environment.apiUrl}${path}`, { params: this.params(query) }).pipe(
      map((response) => response.data),
      catchError((error: unknown) => throwError(() => this.fail(error))),
    );
  }

  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<Envelope<T>>(`${environment.apiUrl}${path}`, body).pipe(
      map((response) => response.data),
      catchError((error: unknown) => throwError(() => this.fail(error))),
    );
  }

  private del<T>(path: string): Observable<T> {
    return this.http.delete<Envelope<T>>(`${environment.apiUrl}${path}`).pipe(
      map((response) => response.data),
      catchError((error: unknown) => throwError(() => this.fail(error))),
    );
  }

  private patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<Envelope<T>>(`${environment.apiUrl}${path}`, body).pipe(
      map((response) => response.data),
      catchError((error: unknown) => throwError(() => this.fail(error))),
    );
  }

  private params(query: Record<string, string | number | boolean | undefined>) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return params;
  }

  private fail(error: unknown): ApiFailure {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as { message?: string | string[]; code?: string } | null;
      const message = Array.isArray(payload?.message) ? payload?.message.join(' ') : payload?.message;
      return { status: error.status, message: message || this.i18n.t('common.offline'), code: payload?.code };
    }
    return { status: 0, message: this.i18n.t('common.offline') };
  }
}
