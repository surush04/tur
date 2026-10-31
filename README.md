# Rohi Travel

Mobile travel catalog and booking-request app for Tajikistan, with a NestJS API and an Angular admin panel.

The catalog is demonstration data. It is not a live report of roads, weather, prices, or availability. Booking records are requests. No payment is collected.

## What is included

- Ionic Angular mobile app: home, explore, destination and tour details, map, favorites, trips, AI planner, companions, stays, guides, profile, settings, and Tajik, Russian, and English.
- NestJS API with JWT access and refresh tokens, roles `USER`, `GUIDE`, `PROVIDER`, and `ADMIN`.
- PostgreSQL schema through Prisma, including bookings that lock a departure row so two requests cannot take the same last seats.
- Angular admin panel for destinations, tour dates, booking status, users, provider submissions, companions, reviews, reports, and AI status.
- Prices are integer dirams on the server. The client cannot submit a total.

## Layout

```
backend/   NestJS API, Prisma schema, seed
mobile/    Ionic Angular app
admin/     Angular admin panel
```

## Requirements

- Node.js 22 or newer, and npm
- PostgreSQL 16

Docker Compose is set up in `docker-compose.yml`. On this computer Docker Desktop cannot start because the Windows Subsystem for Linux is not installed. The database that is running now was started with Prisma's local Postgres instead. After WSL is installed, Docker Compose is the simpler setup.

## Environment

```bash
cd backend
copy .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` | Access-token signing secret. Replace it before any shared deployment. |
| `JWT_ACCESS_TTL` | Access token lifetime, default `15m` |
| `JWT_REFRESH_TTL_DAYS` | Refresh token lifetime |
| `PORT` | API port. The mobile and admin `environment.ts` files must use the same port. |
| `CORS_ORIGINS` | Allowed browser origins |
| `AI_API_KEY` | Optional. Leave empty to use labeled demo planning. |
| `AI_BASE_URL` | OpenAI-compatible API base, default `https://api.openai.com/v1` |
| `AI_MODEL` | Model name sent by the server |
| `SEED_ADMIN_PASSWORD` | Password for `admin@rohi.local` |
| `SEED_DEMO_PASSWORD` | Password for the other seed accounts |
| `UPLOAD_DIR` | Local image folder, default `uploads` |

The API key stays on the server. The status endpoint reports whether a key is set, and never returns the key.

## Database with Docker

```bash
docker compose up -d
```

Use the `DATABASE_URL` from `.env.example`:

`postgresql://rohi:rohi_dev_password@localhost:5432/rohi_travel?schema=public`

## Database without Docker

```bash
cd backend
npx prisma dev -d --name rohi
```

`npx prisma dev ls` prints the TCP URL. Create the application database, then point `DATABASE_URL` at `rohi_travel` on that port:

```bash
$env:ADMIN_DATABASE_URL="postgres://postgres:postgres@localhost:PORT/template1?sslmode=disable"
node scripts/ensure-db.mjs
```

The local server used while building this checkout listens on port `51218`. That port can change. Read it from `npx prisma dev ls` if the API cannot connect.

## Migrate, seed, and run

From the repository root:

```bash
npm run install:all
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:mobile
npm run dev:admin
```

Or from each project:

```bash
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

```bash
cd mobile
npm start
```

```bash
cd admin
npm start
```

- API: `http://localhost:3010/api`
- OpenAPI: `http://localhost:3010/api/docs`
- Mobile: `http://127.0.0.1:4200`
- Admin: `http://127.0.0.1:4201`

Seed accounts, all using `Traveler!234` except the administrator:

| Email | Role |
| --- | --- |
| `admin@rohi.local` | ADMIN, password `RohiAdmin!234` |
| `traveler@rohi.local` | USER |
| `guide@rohi.local` | GUIDE |
| `host@rohi.local` | USER, owns the sample companion invitation |
| `provider@rohi.local` | PROVIDER |
| `applicant@rohi.local` | USER, owns the pending listing |

Contacts in the seed use `example.com`. Listings say they are unverified.

## Android

Capacitor is configured (`tj.rohi.travel`). Add the native project when the Android SDK is installed:

```bash
cd mobile
npm run cap:sync
npx cap add android
npx cap open android
```

The web build used by Capacitor is `dist/mobile/browser`.

## Tests performed

Backend unit tests, 29 October 2026:

```text
npm test
Test Suites: 5 passed, 5 total
Tests:       14 passed, 14 total
```

Those cover diram arithmetic, booking status rules, role changes, and the labeled demo itinerary.

API checks against the seeded database, all passed:

- health, home catalog, and destination search
- traveler login
- registration rejects a body that tries to set `role`
- a new account is `USER`
- a normal user receives 403 from `/api/admin/stats`
- admin statistics come from the database
- a booking request stores the server total (`350.00` × 2 = `700.00`), status `PENDING`, payment `NOT_COLLECTED`
- a request larger than the remaining seats is rejected
- demo planning returns `source: DEMO` and a disclaimer
- planning without `AI_API_KEY` and without demo mode returns 503 `AI_NOT_CONFIGURED`
- the map payload includes destination and tour markers

`npx nest build` succeeded. `npx ng build --configuration development` succeeded for the mobile app and the admin panel.

In the browser, the home screen loaded the catalog, a destination card opened Iskanderkul, and the admin dashboard showed 10 destinations, 8 tours, and 1 pending booking from the database. The AI card said the provider is not configured.

## Versions

- Angular 22 and Ionic 9. Ionic 9 exports standalone components from `@ionic/angular`.
- NestJS 11. NestJS 12 is published, but `@nestjs/config` 4 does not accept it yet.
- Prisma 7.10.1 with the PostgreSQL driver adapter. Prisma 8 is still a release candidate and is not used.
- Leaflet 1.9 with OpenStreetMap tiles. Development use should follow the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). There is no turn-by-turn navigation and no offline map pack.

## Social marketplace

Travelers, groups, and tour operators share one API.

- Reels are full-screen videos. The seed includes one real Wikimedia Commons clip of the Anzob tunnel (`Tajikistan Anzob tunnel 2024.webm`, Jubaba66, July 2024). Uploaded videos are stored under `backend/uploads` and are not treated as uploaded until that file exists. Traveler uploads stay `PENDING` until an administrator publishes them. Provider, guide, and admin uploads can be published immediately.
- Group chat refreshes from `GET /api/social/groups/:id/messages` about every 8 seconds. There is no WebSocket gateway in this version.
- A member has one tour vote per group. Voting again replaces that vote. Selecting a proposal or closing a date poll does not reserve seats.
- Operators can list public groups only. Private groups return 404 to non-members. Operators do not receive group chat. Contact starts a separate conversation after the organizer accepts.
- A group inquiry stores status history and never changes `bookedSeats`. Payment is still not collected.
- Unanswered contact requests older than 14 days are marked `EXPIRED` when that user loads their requests.
- An operator can send at most 5 contact requests per 24 hours.

## Limitations

- No payment provider is connected. A booking is a request an administrator confirms.
- Password reset email is not sent. Outside production, the forgot-password response can include a development token.
- Account deletion is a request flag. It does not erase the row.
- Weather is not connected.
- The AI planner uses the configured server provider, or an explicitly labeled demo built from the catalog. It does not invent live road times or confirmed availability.
- Guide, driver, and stay records in the seed are fictional and are never marked certified.
- Guest favorites stay in this browser. Signed-in favorites are stored per account. The favorites screen for a guest shows a count rather than the saved titles.
- Refresh tokens on the web are in `sessionStorage`. A production build should use the platform keystore. Access tokens stay in memory.
- OpenStreetMap tiles are for development traffic, not a high-volume production map.
- The Android project is not generated until the SDK is available.
- Group chat is polled, not delivered over WebSockets.
- The seeded reel is one Commons video. Other destinations do not have a clip until someone uploads one.
- Operator verification is still the existing unverified guide and provider records. The admin can suspend an account; that is separate from marking a guide certified.
