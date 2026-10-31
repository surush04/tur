const base = 'http://127.0.0.1:3010/api';

async function call(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
}

function assert(name, condition, detail) {
  if (!condition) {
    console.error('FAIL', name, detail ?? '');
    process.exitCode = 1;
  } else {
    console.log('PASS', name);
  }
}

const health = await call('/health');
assert('health', health.status === 200 && health.body?.data?.ok !== false, health);

const home = await call('/destinations/home');
assert('home catalog', home.status === 200 && (home.body?.data?.popular?.length ?? 0) > 0, home.body?.data?.popular?.length);

const search = await call('/destinations?q=Iskanderkul');
assert('search', search.status === 200 && search.body?.data?.some((row) => row.slug === 'iskanderkul'), search.status);

const login = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'traveler@rohi.local', password: 'Traveler!234' }),
});
assert('traveler login', login.status === 201 || login.status === 200, login.status);
const token = login.body?.data?.accessToken;

const rejected = await call('/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    email: `rolecheck.${Date.now()}@example.com`,
    password: 'Traveler!234',
    firstName: 'Role',
    lastName: 'Check',
    role: 'ADMIN',
  }),
});
assert('register rejects a self-assigned role', rejected.status === 400, rejected.status);
const register = await call('/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    email: `rolecheck.${Date.now()}@example.com`,
    password: 'Traveler!234',
    firstName: 'Role',
    lastName: 'Check',
  }),
});
assert('new account is a normal user', register.body?.data?.user?.role === 'USER', register.body?.data?.user?.role ?? register.body);

const denied = await call('/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
assert('user cannot read admin stats', denied.status === 403, denied.status);

const admin = await call('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'admin@rohi.local', password: 'RohiAdmin!234' }),
});
const adminToken = admin.body?.data?.accessToken;
const stats = await call('/admin/stats', { headers: { Authorization: `Bearer ${adminToken}` } });
assert('admin stats from database', stats.status === 200 && stats.body?.data?.destinations >= 10, stats.body?.data);

const tour = await call('/tours/iskanderkul-day');
const date = tour.body?.data?.dates?.[0];
assert('tour has an open date', Boolean(date?.id), tour.status);
const capacity = date?.capacity ?? 0;

const book = await call('/bookings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    tourDateId: date.id,
    travelers: 2,
    contactName: 'Amina Karimova',
    contactEmail: 'amina@example.com',
    contactPhone: '+992900000000',
    travelerNames: [{ fullName: 'Amina Karimova' }, { fullName: 'Farid Karimov' }],
  }),
});
assert('booking ignores client price', book.status === 201 && book.body?.data?.totalPrice === '700.00' && book.body?.data?.status === 'PENDING' && book.body?.data?.paymentStatus === 'NOT_COLLECTED', book.body);

const over = await call('/bookings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    tourDateId: date.id,
    travelers: capacity,
    contactName: 'Amina Karimova',
    contactEmail: 'amina@example.com',
    contactPhone: '+992900000000',
    travelerNames: Array.from({ length: capacity }, (_, index) => ({ fullName: `Guest ${index + 1}` })),
  }),
});
assert('overbooking rejected', over.status === 400, over.status + ' ' + JSON.stringify(over.body));

const demo = await call('/ai/plan', {
  method: 'POST',
  body: JSON.stringify({
    demo: true,
    startLocation: 'Dushanbe',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 2,
    budgetTjs: '1500.00',
    interests: ['lakes', 'photography'],
  }),
});
assert('demo planner is labeled', demo.status === 201 && demo.body?.data?.source === 'DEMO' && typeof demo.body?.data?.disclaimer === 'string', demo.body?.data?.source);

const live = await call('/ai/plan', {
  method: 'POST',
  body: JSON.stringify({
    demo: false,
    startLocation: 'Dushanbe',
    travelers: 2,
    budgetTjs: '1500.00',
    interests: ['lakes'],
  }),
});
assert('missing AI key is not a fake plan', live.status === 503 && live.body?.code === 'AI_NOT_CONFIGURED', live.status + ' ' + JSON.stringify(live.body));

const map = await call('/destinations/map');
assert('map markers', (map.body?.data?.destinations?.length ?? 0) >= 10 && (map.body?.data?.tours?.length ?? 0) >= 1, map.body?.data?.destinations?.length);

const videos = await call('/social/videos');
assert('published reel is the Anzob clip', videos.status === 200 && videos.body?.data?.some((row) => String(row.caption).includes('Anzob')), videos.status);

const publicGroups = await call('/social/groups');
const weekend = publicGroups.body?.data?.find((row) => row.name === 'Iskanderkul weekend');
const leaked = publicGroups.body?.data?.find((row) => row.name === 'Private Pamir notes');
assert('public group is listed and the private group is not', Boolean(weekend?.id) && !leaked, publicGroups.status);

const host = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'host@rohi.local', password: 'Traveler!234' }) });
const hostToken = host.body?.data?.accessToken;
const mine = await call('/social/groups/mine', { headers: { Authorization: `Bearer ${hostToken}` } });
const secret = mine.body?.data?.find((row) => row.name === 'Private Pamir notes');
const provider = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'provider@rohi.local', password: 'Traveler!234' }) });
const providerToken = provider.body?.data?.accessToken;
const hidden = await call(`/social/groups/${secret?.id}`, { headers: { Authorization: `Bearer ${providerToken}` } });
assert('operator cannot open a private group', hidden.status === 404, hidden.status);
const deniedChat = await call(`/social/groups/${weekend.id}/messages`, { headers: { Authorization: `Bearer ${providerToken}` } });
assert('operator cannot read group chat', deniedChat.status === 403, deniedChat.status);
const operatorList = await call('/social/groups/operator', { headers: { Authorization: `Bearer ${providerToken}` } });
assert('operator discovery is public only', operatorList.status === 200 && operatorList.body?.data?.every((row) => row.visibility === 'PUBLIC') && !operatorList.body?.data?.some((row) => row.name === 'Private Pamir notes'), operatorList.status);
const travelerDenied = await call('/social/groups/operator', { headers: { Authorization: `Bearer ${token}` } });
assert('traveler cannot use operator discovery', travelerDenied.status === 403, travelerDenied.status);

const said = await call(`/social/groups/${weekend.id}/messages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${hostToken}` },
  body: JSON.stringify({ body: 'Saturday works if the road is open.' }),
});
assert('member can post in the group', said.status === 201, said.status);
const thread = await call(`/social/groups/${weekend.id}/messages`, { headers: { Authorization: `Bearer ${token}` } });
assert('organizer can read the discussion', thread.body?.data?.messages?.some((row) => row.body.includes('Saturday')), thread.status);

const detail = await call(`/social/groups/${weekend.id}`, { headers: { Authorization: `Bearer ${token}` } });
const proposalId = detail.body?.data?.proposals?.[0]?.id;
const vote = await call(`/social/groups/${weekend.id}/proposals/${proposalId}/vote`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
const voteAgain = await call(`/social/groups/${weekend.id}/proposals/${proposalId}/vote`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
const afterVote = await call(`/social/groups/${weekend.id}`, { headers: { Authorization: `Bearer ${token}` } });
const proposal = afterVote.body?.data?.proposals?.find((row) => row.id === proposalId);
assert('one vote per member', vote.status === 201 && voteAgain.status === 201 && proposal?.votes === 1 && afterVote.body?.data?.myVote === proposalId, proposal);

const contact = await call(`/social/groups/${weekend.id}/contact`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${providerToken}` },
  body: JSON.stringify({ message: 'We can run the catalog day tour for this group. No payment in the app.' }),
});
assert('operator contact request is pending', contact.status === 201 && contact.body?.data?.status === 'PENDING', contact.status);
const accepted = await call(`/social/contact-requests/${contact.body?.data?.id}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ status: 'ACCEPTED' }),
});
assert('organizer accepts contact', accepted.status === 200 && accepted.body?.data?.conversationId, accepted.status);
const reply = await call(`/social/conversations/${accepted.body.data.conversationId}/messages`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${providerToken}` },
  body: JSON.stringify({ body: 'Happy to answer questions here.' }),
});
assert('operator replies in the conversation', reply.status === 201, reply.status);

const beforeInquiry = await call('/tours/iskanderkul-day');
const seatsBefore = beforeInquiry.body?.data?.dates?.find((row) => row.id === date.id)?.bookedSeats;
const inquiry = await call(`/social/groups/${weekend.id}/inquiries`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ contactRequestId: contact.body.data.id, travelers: 2, proposedPrice: '350.00', notes: 'Please confirm before anyone travels.' }),
});
assert('inquiry does not claim a reservation', inquiry.status === 201 && inquiry.body?.data?.seatsReserved === false, inquiry.body?.data);
const updated = await call(`/social/inquiries/${inquiry.body.data.id}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${providerToken}` },
  body: JSON.stringify({ status: 'CONFIRMED', note: 'Confirmed as a request status only.' }),
});
const tourAgain = await call('/tours/iskanderkul-day');
const seatsAfter = tourAgain.body?.data?.dates?.find((row) => row.id === date.id)?.bookedSeats;
assert('confirmed inquiry does not hold seats', updated.body?.data?.status === 'CONFIRMED' && updated.body?.data?.seatsReserved === false && seatsAfter === seatsBefore, `${seatsBefore} -> ${seatsAfter}`);

const notes = await call('/notifications', { headers: { Authorization: `Bearer ${token}` } });
assert('organizer received a notification', notes.status === 200 && (notes.body?.data?.length ?? 0) > 1, notes.body?.data?.length);
