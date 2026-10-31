import { apiUrl } from './config';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  interests?: string[];
  preferredRegions?: string[];
  language: string;
  role: string;
  city?: string | null;
  showProfilePublicly: boolean;
  notifyBookings: boolean;
  notifyCompanions: boolean;
  notifyMarketing: boolean;
  telegramHandle?: string | null;
  whatsappHandle?: string | null;
};

export type Destination = {
  id: string;
  slug: string;
  name: string;
  region: string;
  category: string;
  summary: string;
  description?: string;
  coverImageUrl?: string | null;
  tourCount?: number;
  tours?: TourCard[];
};

export type TourCard = {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  destinationName?: string;
  destination?: { name: string; slug?: string; region?: string };
  region?: string;
  category?: string;
  difficulty?: string;
  durationDays?: number;
  pricePerPerson?: string | null;
  coverImageUrl?: string | null;
};

export type TourDetail = TourCard & {
  description?: string;
  included?: string[] | string;
  meetingPoint?: string;
  dates?: { id: string; startDate: string; endDate: string; remaining: number; capacity: number }[];
  owner?: { name: string; telegram?: string | null; whatsapp?: string | null; phone?: string | null } | null;
};

export type StayCard = {
  id: string;
  slug: string;
  name: string;
  region?: string;
  summary?: string;
  description?: string;
  priceRangeMin?: string | null;
  priceRangeMax?: string | null;
  coverImageUrl?: string | null;
  contactPhone?: string | null;
};

export type GuideCard = {
  id: string;
  displayName: string;
  region: string;
  bio?: string;
  priceNote?: string | null;
  coverImageUrl?: string | null;
  contactPhone?: string | null;
  verified?: boolean;
};

export type HomePayload = {
  popular: Destination[];
  categories: string[];
  tours: TourCard[];
};

export type Reel = {
  id: string;
  caption: string;
  destinationName: string;
  region: string;
  posterUrl: string;
  videoUrl: string;
  tourSlug: string | null;
  tourTitle: string | null;
  creator: string;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
};

export type GroupCard = {
  id: string;
  name: string;
  coverImageUrl: string | null;
  destinationName: string;
  region: string;
  description: string;
  departureDate: string | null;
  budgetPerPerson: string | null;
  desiredSize: number;
  memberCount: number;
};

export type GroupDetail = GroupCard & {
  rules: string | null;
  isMember: boolean;
  isOrganizer: boolean;
  organizer: { firstName: string };
  members: { userId: string; firstName: string; role: string }[];
};

export type GroupMessage = {
  id: string;
  body: string;
  system: boolean;
  createdAt: string;
  sender: { firstName: string; mine: boolean } | null;
};

export type BookingRecord = {
  id: string;
  reference: string;
  status: string;
  travelers: number;
  totalPrice: string | null;
  currency: string;
  paymentNote: string;
  startDate: string;
  endDate: string;
  tour: { slug: string; title: string; destinationName: string };
};

type AuthPayload = { user: SessionUser; accessToken: string; refreshToken: string };

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshing: Promise<void> | null = null;
let onSession: ((payload: AuthPayload | null) => void) | null = null;

export function bindSession(listener: (payload: AuthPayload | null) => void) {
  onSession = listener;
}

export function currentToken() {
  return accessToken;
}

function apply(payload: AuthPayload | null) {
  accessToken = payload?.accessToken ?? null;
  refreshToken = payload?.refreshToken ?? null;
  onSession?.(payload);
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as { data?: T; message?: string | string[]; code?: string }) : {};
  if (!response.ok) {
    const message = Array.isArray(payload.message) ? payload.message.join(' ') : payload.message || 'Error';
    throw new ApiError(response.status, message, payload.code);
  }
  return (payload.data ?? payload) as T;
}

async function refresh() {
  if (!refreshToken) throw new ApiError(401, 'AUTH');
  if (!refreshing) {
    const token = refreshToken;
    refreshing = (async () => {
      const response = await fetch(`${apiUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      apply(await parse<AuthPayload>(response));
    })().finally(() => {
      refreshing = null;
    });
  }
  await refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const send = async () => {
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    try {
      return await fetch(`${apiUrl()}${path}`, { ...init, headers });
    } catch {
      throw new ApiError(0, 'offline');
    }
  };
  let response = await send();
  if (response.status === 401 && auth && refreshToken && !path.startsWith('/auth/')) {
    await refresh();
    response = await send();
  }
  return parse<T>(response);
}

export async function restore(token: string | null) {
  refreshToken = token;
  accessToken = null;
  if (!token) return null;
  await refresh();
  const user = await request<SessionUser>('/users/me');
  return user;
}

export async function login(email: string, password: string) {
  const payload = await request<AuthPayload>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  apply(payload);
  return payload.user;
}

export async function register(body: { email: string; password: string; firstName: string; lastName: string; language: string }) {
  const payload = await request<AuthPayload>('/auth/register', { method: 'POST', body: JSON.stringify(body) }, false);
  apply(payload);
  return payload.user;
}

export async function forgot(email: string) {
  return request<{ message: string; devResetToken?: string }>('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }, false);
}

export async function resetPassword(token: string, password: string) {
  await request('/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) }, false);
}

export async function logout() {
  const token = refreshToken;
  apply(null);
  if (token) {
    await request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: token }) }, false).catch(() => undefined);
  }
}

export function home() {
  return request<HomePayload>('/destinations/home');
}

export function destinations(query: Record<string, string | undefined> = {}) {
  return request<Destination[]>(`/destinations${qs(query)}`);
}

export function destination(slug: string) {
  return request<Destination>(`/destinations/${slug}`);
}

export function tours(query: Record<string, string | undefined> = {}) {
  return request<TourCard[]>(`/tours${qs(query)}`);
}

export function tour(slug: string) {
  return request<TourDetail>(`/tours/${slug}`);
}

export function stays() {
  return request<StayCard[]>('/accommodations');
}

export function stay(slug: string) {
  return request<StayCard>(`/accommodations/${slug}`);
}

export function guides() {
  return request<GuideCard[]>('/guides');
}

export function guide(id: string) {
  return request<GuideCard>(`/guides/${id}`);
}

export function reels() {
  return request<Reel[]>('/social/videos');
}

export function likeReel(id: string) {
  return request<{ liked: boolean; count: number }>(`/social/videos/${id}/like`, { method: 'POST', body: '{}' });
}

export function saveReel(id: string) {
  return request<{ saved: boolean }>(`/social/videos/${id}/save`, { method: 'POST', body: '{}' });
}

export function groups() {
  return request<GroupCard[]>('/social/groups');
}

export function group(id: string) {
  return request<GroupDetail>(`/social/groups/${id}`);
}

export function createGroup(body: unknown) {
  return request<{ id: string }>('/social/groups', { method: 'POST', body: JSON.stringify(body) });
}

export function joinGroup(id: string, message?: string) {
  return request(`/social/groups/${id}/join`, { method: 'POST', body: JSON.stringify({ message }) });
}

export function groupMessages(id: string) {
  return request<{ messages: GroupMessage[] }>(`/social/groups/${id}/messages`);
}

export function sendGroupMessage(id: string, body: string) {
  return request(`/social/groups/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
}

export function favorites() {
  return request<{ id: string; tourId?: string | null; destinationId?: string | null; title: string; subtitle: string; image?: string | null; href: string }[]>('/favorites');
}

export function addFavorite(body: { tourId?: string; destinationId?: string; accommodationId?: string; guideId?: string }) {
  return request<{ id: string }>('/favorites', { method: 'POST', body: JSON.stringify(body) });
}

export function removeFavorite(id: string) {
  return request(`/favorites/${id}`, { method: 'DELETE' });
}

export function bookings() {
  return request<BookingRecord[]>('/bookings/mine');
}

export function booking(id: string) {
  return request<BookingRecord>(`/bookings/${id}`);
}

export function createBooking(body: unknown) {
  return request<BookingRecord>('/bookings', { method: 'POST', body: JSON.stringify(body) });
}

export function updateProfile(body: unknown) {
  return request<SessionUser>('/users/me', { method: 'PATCH', body: JSON.stringify(body) });
}

export function setMode(mode: 'traveler' | 'owner') {
  return request<SessionUser>('/users/me/mode', { method: 'POST', body: JSON.stringify({ mode }) });
}

export function requestDeletion() {
  return request<{ message: string }>('/users/me/deletion-request', { method: 'POST', body: '{}' });
}

export function notifications() {
  return request<{ id: string; title: string; body: string; readAt: string | null }[]>('/notifications');
}

export function readNotification(id: string) {
  return request(`/notifications/${id}/read`, { method: 'POST', body: '{}' });
}

export function conversations() {
  return request<{ id: string; preview: string; with: string[]; groupName: string | null }[]>('/social/conversations');
}

export function conversation(id: string) {
  return request<{ id: string; messages: { id: string; body: string; mine: boolean; sender: string }[] }>(`/social/conversations/${id}`);
}

export function sendDirect(id: string, body: string) {
  return request(`/social/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
}

export function messageOperator(tourId: string, body: string) {
  return request<{ id: string }>('/social/conversations', { method: 'POST', body: JSON.stringify({ tourId, body }) });
}

export function ownerDashboard() {
  return request<{
    views: number;
    tours: { id: string; title: string; published: boolean; viewCount: number; durationDays: number; pricePerPerson: string | null }[];
    videos: { id: string; caption: string; status: string }[];
    groups: { id: string; name: string; memberCount: number; desiredSize: number }[];
  }>('/owner/dashboard');
}

export function ownerTour(id: string) {
  return request<{
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
    coverImageUrl: string;
    imageUrls: string[];
  }>(`/owner/tours/${id}`);
}

export function saveOwnerTour(body: unknown, id?: string) {
  return request<{ id: string; slug: string }>(id ? `/owner/tours/${id}` : '/owner/tours', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  });
}

export function publishReel(body: unknown) {
  return request('/social/videos', { method: 'POST', body: JSON.stringify(body) });
}

export function companions() {
  return request<Record<string, unknown>[]>('/companions');
}

export function plan(body: unknown) {
  return request<{ title: string; source: string; days: { title: string; activities: { title: string; note?: string }[] }[] }>('/ai/plan', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function searchSocial(q: string) {
  return request<{ groups: GroupCard[]; videos: Reel[] }>(`/social/search${qs({ q })}`);
}

export async function uploadMedia(file: { uri: string; name: string; type: string }) {
  const body = new FormData();
  body.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return request<{ url: string; kind: string }>('/social/media', { method: 'POST', body });
}

function qs(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
