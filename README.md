# telehealth-backend

REST API for a telehealth platform built with Node.js, Express v5, Drizzle ORM, and Neon PostgreSQL. Supports patient registration, doctor discovery, appointment booking, video consultations, real-time notifications, and AI-powered symptom analysis.

## Tech Stack

| Package | Version | Notes |
|---|---|---|
| Node.js | 20+ LTS | Required |
| Express | 5.2.1 | Async errors propagate automatically — no try/catch in routes |
| TypeScript | 6.0.3 | Strict mode |
| Drizzle ORM | 0.45.2 | Type-safe query builder |
| drizzle-kit | 0.31.10 | Migrations CLI |
| @neondatabase/serverless | 1.1.0 | Neon PostgreSQL 17 driver |
| Zod | 4.4.3 | v4 — import paths differ from v3 |
| jsonwebtoken | 9.0.3 | JWT access + refresh tokens |
| bcryptjs | 3.0.3 | Password hashing |
| Pusher | 5.3.3 | Real-time notifications |
| Groq SDK | 1.2.1 | AI symptom recommendations |
| Cloudinary | 2.10.0 | Profile picture + document uploads |
| Multer | 2.1.1 | Multipart file handling |
| helmet | 8.2.0 | Security headers |
| cors | 2.8.6 | CORS |
| tsx | 4.22.3 | Dev watch mode |

## Architecture

Every feature module lives under `src/modules/<module>/` with exactly four files:

```
<module>.controller.ts   — route handlers only, no business logic
<module>.service.ts      — business logic and orchestration
<module>.repository.ts   — Drizzle ORM queries only
<module>.schema.ts       — Drizzle table definitions + Zod validators
```

All endpoints return a consistent response envelope:

```json
{ "success": true, "message": "...", "data": { ... } }
```

Errors are handled by a single error middleware that handles `AppError`, `ZodError`, JWT errors, and unknown exceptions. Route handlers never contain try/catch.

## Getting Started

### Prerequisites

- Node.js 20+ LTS
- A [Neon](https://neon.tech) PostgreSQL database (or any `postgres://` connection string)
- Pusher app credentials (for real-time notifications)
- Groq API key (for AI recommendations)
- Cloudinary account (for file uploads)

### Install

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env
# Fill in all values — see Environment Variables section below
```

### Database Setup

```bash
npm run db:generate   # generate migration files from schema
npm run db:migrate    # apply migrations to the database
npm run db:seed       # seed all tables with sample data
```

### Development Server

```bash
npm run dev           # starts tsx watch mode on src/index.ts
```

Server runs at `http://localhost:3000` by default.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for signing JWTs |
| `JWT_EXPIRES_IN` | No | JWT expiry (default: `7d`) |
| `PORT` | No | Server port (default: `3000`) |
| `NODE_ENV` | No | `development` or `production` |
| `CORS_ORIGIN` | No | Frontend origin (default: `http://localhost:5173`) |
| `PUSHER_APP_ID` | Yes | Pusher application ID |
| `PUSHER_KEY` | Yes | Pusher key |
| `PUSHER_SECRET` | Yes | Pusher secret |
| `PUSHER_CLUSTER` | Yes | Pusher cluster (e.g. `ap1`) |
| `GROQ_API_KEY` | Yes | Groq API key for AI recommendations |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |

## API Endpoints

Full specs are in [`docs/04-api-conventions.md`](docs/04-api-conventions.md) and the individual module docs in [`docs/modules/`](docs/modules/).

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Server liveness check |
| GET | `/health/db` | Database connectivity check |

### Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register as patient or doctor |
| POST | `/api/auth/login` | Login; returns access + refresh tokens |
| GET | `/api/auth/me` | Get current authenticated user |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token |
| POST | `/api/auth/logout` | Revoke current refresh token |
| POST | `/api/auth/logout-all` | Revoke all refresh tokens for user |

### Users — `/api/users`

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/:id` | Get user profile |
| PUT | `/api/users/:id` | Update name / phone |
| POST | `/api/users/:id/avatar` | Upload profile picture (multipart) |
| POST | `/api/users/:id/change-password` | Change password |

### Patients — `/api/patients`

| Method | Path | Description |
|---|---|---|
| GET | `/api/patients/:id` | Get patient profile |
| PUT | `/api/patients/:id` | Update medical info (DOB, weight, blood type, allergies, etc.) |
| POST | `/api/patients/:id/documents` | Upload medical document (multipart) |
| GET | `/api/patients/:id/documents` | List uploaded documents |
| GET | `/api/patients/:patientId/history` | Full patient history — doctor only |

### Doctors — `/api/doctors`

| Method | Path | Description |
|---|---|---|
| GET | `/api/doctors` | Paginated list with filters (specialization, search, fee, rating) |
| GET | `/api/doctors/specializations` | Distinct specialization list for dropdowns |
| GET | `/api/doctors/:id` | Doctor profile |
| PUT | `/api/doctors/:id` | Update profile (bio, license, fee, accepting patients) |
| GET | `/api/doctors/:id/availability` | Weekly recurring schedule |
| PUT | `/api/doctors/:id/availability` | Set weekly availability — doctor only |
| GET | `/api/doctors/:id/slots?date=YYYY-MM-DD` | Available 30-min slots for a date |
| GET | `/api/doctors/:id/blocked-slots` | List blocked time ranges |
| POST | `/api/doctors/:id/blocked-slots` | Block a time range — doctor only |
| DELETE | `/api/doctors/:id/blocked-slots/:slotId` | Remove blocked slot — doctor only |
| GET | `/api/doctors/:id/reviews` | List patient reviews |
| POST | `/api/doctors/:id/reviews` | Submit review (completed appointments only) — patient only |

### Appointments — `/api/appointments`

| Method | Path | Description |
|---|---|---|
| POST | `/api/appointments` | Book appointment with conflict detection — patient only |
| GET | `/api/appointments` | Role-filtered list (pagination, status, date range) |
| GET | `/api/appointments/limit-check?doctorId=X` | Check pending appointment limit — patient only |
| GET | `/api/appointments/patients/search?q=...` | Search patients by name / medical info — doctor only |
| GET | `/api/appointments/:id` | Appointment details |
| PATCH | `/api/appointments/:id/status` | Update status (confirmed / completed) |
| PATCH | `/api/appointments/:id/join` | Record join timestamp |
| PATCH | `/api/appointments/:id/reschedule` | Cancel + rebook with conflict detection — patient only |
| DELETE | `/api/appointments/:id` | Cancel appointment with optional reason |
| GET | `/api/appointments/:id/calendar` | Download iCal (.ics) file |
| POST | `/api/appointments/:id/chat` | Send consultation chat message |
| GET | `/api/appointments/:id/chat` | Load consultation chat history |

### Consultation Notes — `/api/appointments/:appointmentId/notes`

| Method | Path | Description |
|---|---|---|
| GET | `/api/appointments/:appointmentId/notes` | Get consultation notes |
| POST | `/api/appointments/:appointmentId/notes` | Create or update notes (upsert) — doctor only |

### Prescriptions — `/api/appointments/:appointmentId/prescriptions`

| Method | Path | Description |
|---|---|---|
| GET | `/api/appointments/:appointmentId/prescriptions` | List prescriptions |
| POST | `/api/appointments/:appointmentId/prescriptions` | Add prescription — doctor only |
| DELETE | `/api/appointments/:appointmentId/prescriptions/:rxId` | Remove prescription — doctor only |

### Notifications — `/api/notifications`

| Method | Path | Description |
|---|---|---|
| GET | `/api/notifications` | Paginated notifications with unread count |
| PATCH | `/api/notifications/read-all` | Mark all as read |
| PATCH | `/api/notifications/:id/read` | Mark single notification as read |
| DELETE | `/api/notifications/:id` | Delete notification |

Real-time delivery via Pusher public channels (`user-{userId}`). Triggered on appointment booked, confirmed, cancelled, and completed events.

### AI — `/api/ai`

| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/recommend` | Doctor recommendations from symptoms (Groq) — patient only |
| POST | `/api/ai/recommend/stream` | SSE streaming recommendations — patient only |
| GET | `/api/ai/history` | Past AI recommendation logs — patient only |

## Database Schema

| Table | Description |
|---|---|
| `users` | Core identity — email, password hash, account status |
| `refresh_tokens` | Refresh token store with revocation support |
| `roles` | RBAC roles (`patient`, `doctor`) |
| `permissions` | Granular permission definitions |
| `role_permissions` | Role ↔ permission junction |
| `user_roles` | User ↔ role junction |
| `doctor_profiles` | Doctor extended profile — specialization, fee, bio, license |
| `doctor_availability` | Weekly recurring schedule (per day-of-week, start/end time) |
| `doctor_blocked_slots` | One-off or recurring blocked time ranges |
| `patient_profiles` | Patient extended profile — DOB, medical history, insurance |
| `patient_documents` | Uploaded medical document records |
| `appointments` | Bookings — status, Jitsi room, join timestamps, cancellation info |
| `consultation_notes` | Doctor's notes per appointment (chief complaint, diagnosis) |
| `prescriptions` | Medications prescribed per appointment |
| `reviews` | Patient reviews and ratings per completed appointment |
| `chat_messages` | In-consultation text chat history |
| `notifications` | Persistent notification records with read status |
| `ai_recommendation_logs` | AI symptom analysis history per patient |

Full schema definitions with column types and indexes: [`docs/03-database-design.md`](docs/03-database-design.md)

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run db:generate` | Generate Drizzle migration files from schema changes |
| `npm run db:migrate` | Apply pending migrations to the database |
| `npm run db:migrate:kit` | Apply migrations via drizzle-kit |
| `npm run db:seed` | Run all seed files in order |
| `npm run db:truncate` | Truncate all tables (keeps schema) |
| `npm run db:reset` | Full reset — truncate + re-seed |
| `npm run db:studio` | Open Drizzle Studio (visual DB browser) |
| `npm test` | Run Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

Individual seed scripts are also available: `seed:roles`, `seed:permissions`, `seed:role-permissions`, `seed:users`, `seed:user-roles`, `seed:doctors`, `seed:patients`, `seed:appointments`, `seed:notes`, `seed:prescriptions`, `seed:reviews`, `seed:ai-logs`, `seed:blocked-slots`, `seed:chat-messages`.

## Project Structure

```
src/
├── config/
│   ├── db.ts              # Drizzle + Neon setup
│   ├── env.ts             # Validated environment config
│   ├── pusher.ts          # Pusher client
│   ├── groq.ts            # Groq LLM client
│   └── cloudinary.ts      # Cloudinary client
├── db/
│   ├── migrate.ts
│   ├── seed.ts
│   ├── reset.ts
│   ├── truncate.ts
│   └── seeds/             # 15 ordered seed files
├── modules/
│   ├── auth/
│   ├── users/
│   ├── patients/
│   ├── doctors/
│   ├── appointments/
│   ├── consultations/
│   ├── prescriptions/
│   ├── notifications/
│   └── ai/                # No repository — calls doctors service directly
├── shared/
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   └── types/
│       └── index.ts       # AppError class, AuthUser interface
└── index.ts               # Express app + route mounting
```

## Further Documentation

Architecture decisions, module contracts, API conventions, and UI guidelines are documented in [`docs/`](docs/).
