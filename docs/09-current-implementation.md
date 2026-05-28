# 09 — Current Implementation State

> Snapshot as of **2026-05-28**. This is a ground-truth record of what is **actually built and running**, not what was planned.

---

## System Overview

White Cloak is a full-stack telehealth consultation platform. It allows patients to discover doctors, book video consultations, receive AI-powered specialty recommendations, and view post-consultation prescriptions and notes. Doctors manage their schedules, confirm appointments, conduct Jitsi-based video calls, and document clinical notes.

---

## Technology Stack (actual, verified)

### Backend

| Concern | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express v5.2.1 (async error propagation, no try/catch in handlers) |
| Language | TypeScript v6.0.3, strict mode, CommonJS |
| Database | PostgreSQL 17 via Neon serverless |
| ORM | Drizzle ORM v0.45.2 |
| Migrations | drizzle-kit v0.31.10 |
| Auth | jsonwebtoken v9.0.3 + bcryptjs v3.0.3 |
| Validation | Zod v4.4.3 |
| File upload | multer v2.1.1 |
| Media storage | Cloudinary v2.10.0 |
| Real-time | Pusher v5.3.3 |
| AI | groq-sdk v1.2.1 (model: llama-3.1-8b-instant) |
| Security | helmet v8.2.0, cors v2.8.6 |
| Dev server | tsx v4.22.3 (watch mode) |

### Frontend

| Concern | Technology |
|---|---|
| Framework | React v19.2.6 |
| Build | Vite v8.0.12 |
| Language | TypeScript v6.0.2, strict mode, ESM |
| Styling | Tailwind CSS v4.3.0 (CSS-only config, no tailwind.config.js) |
| UI components | Shadcn v4.8.0 + radix-ui v1.4.3 unified package |
| Routing | React Router DOM v7.15.1 |
| Server state | TanStack Query v5.100.14 (staleTime: 5 min, retry: 1) |
| Forms | React Hook Form v7.76.1 + Zod v4.4.3 |
| HTTP client | Axios v1.16.1 (shared instance with JWT interceptor) |
| Real-time | Pusher JS v8.5.0 (public channels: `user-{userId}`) |
| Video | @jitsi/react-sdk v1.4.4 (domain: meet.jit.si) |
| Dates | date-fns v4.3.0, react-day-picker v10.0.1 |
| Notifications (UI) | sonner v2.0.7 (toast) |

---

## Backend — Module Structure

Each module follows the strict 4-file pattern. No exceptions exist in the current codebase.

```
src/
├── index.ts                         — Express app, route registration, error middleware
├── config/
│   ├── db.ts                        — Drizzle + Neon pool connection
│   ├── env.ts                       — Zod-validated environment variables
│   ├── pusher.ts                    — Pusher server client
│   ├── groq.ts                      — Groq AI client
│   └── cloudinary.ts                — Cloudinary client
├── modules/
│   ├── auth/                        — register, login, JWT, profile scaffold
│   ├── users/                       — user profile, avatar upload
│   ├── patients/                    — patient profile, medical history
│   ├── doctors/                     — doctor profile, availability, slots, blocked slots, reviews
│   ├── appointments/                — booking, conflict detection, status transitions
│   ├── consultations/               — consultation notes (nested under appointments)
│   ├── prescriptions/               — prescriptions (nested under appointments)
│   ├── notifications/               — Pusher push + DB audit trail
│   └── ai/                         — Groq symptom-to-specialization (3 files only, no repository)
└── shared/
    ├── middleware/
    │   ├── auth.middleware.ts        — authenticate (JWT), requireRole()
    │   └── error.middleware.ts      — global AppError + ZodError handler
    └── types/index.ts               — AppError, AuthUser types
```

---

## Database Schema (all tables, current state)

### Identity & RBAC

**`users`** — credentials only
- `id` UUID PK, `email` unique, `passwordHash`, `isActive`, `isEmailVerified`, `lastLoginAt`, `createdAt`, `updatedAt`, `deletedAt`

**`roles`** — seeded (patient, doctor, admin)
- `id` UUID PK, `name` unique, `description`

**`permissions`** — fine-grained access (seeded)
- `id` UUID PK, `name` unique, `description`

**`user_roles`** — many-to-many junction
- `userId` FK → users, `roleId` FK → roles, `assignedAt`; PK (userId, roleId)

**`role_permissions`** — many-to-many junction
- `roleId` FK → roles, `permissionId` FK → permissions; PK (roleId, permissionId)

### Profiles

**`patient_profiles`** — 1:1 with users
- `id`, `userId` unique FK, `firstName`, `lastName`, `dateOfBirth`, `sex` (enum), `profilePictureUrl`
- `weightKg`, `heightCm`
- `phoneNumber`, `address`, `emergencyContactName`, `emergencyContactPhone`
- `bloodType` (enum: A+/A-/B+/B-/AB+/AB-/O+/O-/unknown), `allergies`, `currentMedications`, `pastMedicalConditions`, `familyMedicalHistory`

**`doctor_profiles`** — 1:1 with users
- `id`, `userId` unique FK, `firstName`, `lastName`, `profilePictureUrl`
- `specialization`, `bio`, `licenseNumber`, `yearsOfExperience`
- `consultationFee` (integer, in centavos), `isVerified`, `isAcceptingPatients`, `phoneNumber`

**`doctor_availability`** — weekly recurring schedule
- `id`, `doctorId` FK, `dayOfWeek` (enum: monday–sunday), `startTime`, `endTime`, `slotDurationMinutes` (default 30), `isActive`

**`doctor_blocked_slots`** — one-off unavailability
- `id`, `doctorId` FK, `blockedDate` timestamp, `startTime`, `endTime`, `reason`

**`reviews`** — patient rates a doctor post-appointment
- `id`, `appointmentId` unique FK, `patientId` FK, `doctorId` FK, `rating` (1–5), `comment`

### Appointments & Clinical Records

**`appointments`** — core booking entity
- `id`, `patientId` FK, `doctorId` FK
- `scheduledAt`, `endsAt` (both with timezone)
- `status` (enum: pending, confirmed, cancelled, completed, no_show)
- `jitsiRoomName` (generated: `telehealth-{appointmentId}`)
- `rescheduledFrom` (self-ref UUID), `cancellationReason`, `cancelledBy`, `cancelledAt`
- `patientNote`

**`consultation_notes`** — 1:1 per appointment, doctor-authored
- `id`, `appointmentId` unique FK, `doctorId` FK, `patientId` FK
- `chiefComplaint`, `diagnosis`, `notes`, `followUpDate`

**`prescriptions`** — many per appointment, doctor-authored
- `id`, `appointmentId` FK cascade, `doctorId` FK, `patientId` FK
- `medicationName`, `dosage`, `frequency`, `duration`, `instructions`

### Real-time

**`notifications`** — audit trail + Pusher delivery
- `id`, `userId` FK cascade, `type` (enum: appointment_booked, appointment_confirmed, appointment_cancelled, appointment_completed)
- `title`, `message`, `data` (JSONB), `isRead` (default false), `createdAt`

---

## API Endpoints (all implemented)

All responses use the envelope: `{ success: boolean, message: string, data: T }`

### Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | Public | Returns `{ status: "ok", timestamp }` |
| GET | `/health/db` | Public | Executes `SELECT 1` against Neon DB |

### Auth — `/api/auth`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Creates user + role + profile in DB transaction. Returns `{ token, user }` |
| POST | `/api/auth/login` | Public | Validates credentials, updates lastLoginAt. Returns `{ token, user }` |
| GET | `/api/auth/me` | JWT | Returns `{ id, email, roles, createdAt, lastLoginAt }` |

### Users — `/api/users`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/users/:id` | JWT | Full user with associated profile |
| PUT | `/api/users/:id` | JWT | Update firstName, lastName, phone, avatarUrl |
| POST | `/api/users/:id/avatar` | JWT | Cloudinary upload (multer, 5 MB, JPG/PNG/WebP) |

### Patients — `/api/patients`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/patients/:id` | JWT | Patient profile + full medical history |
| PUT | `/api/patients/:id` | JWT, patient | Update medical fields (blood type, allergies, weight, height, etc.) |

### Doctors — `/api/doctors`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/doctors` | JWT | Paginated list. Filters: `specialization, search, minFee, maxFee, minExperience, minRating, page, limit`. Returns computed stats: `averageRating`, `reviewCount`, `completedConsultationsCount` |
| GET | `/api/doctors/specializations` | JWT | Distinct specialization list from DB. **Must be registered before `/:id`** |
| GET | `/api/doctors/:id` | JWT | Full profile + computed stats |
| PUT | `/api/doctors/:id` | JWT, doctor | Update own profile (specialization, bio, fee, etc.) |
| GET | `/api/doctors/:id/slots` | JWT | Query: `?date=YYYY-MM-DD`. Returns available 30-min windows. Excludes booked + blocked |
| GET | `/api/doctors/:id/availability` | JWT | Weekly recurring schedule |
| PUT | `/api/doctors/:id/availability` | JWT, doctor | Overwrite weekly schedule (full replace) |
| GET | `/api/doctors/:id/blocked-slots` | JWT | One-off blocked date/time entries |
| POST | `/api/doctors/:id/blocked-slots` | JWT, doctor | Add blocked slot |
| DELETE | `/api/doctors/:id/blocked-slots/:slotId` | JWT, doctor | Remove blocked slot |
| GET | `/api/doctors/:id/reviews` | JWT | All reviews for doctor |
| POST | `/api/doctors/:id/reviews` | JWT, patient | Submit review (rating 1–5 + optional comment) |

### Appointments — `/api/appointments`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/appointments` | JWT, patient | Book appointment. Checks conflict, creates in transaction, fires Pusher notifications to both parties |
| GET | `/api/appointments` | JWT | Role-filtered list. Params: `status, page, limit` |
| GET | `/api/appointments/:id` | JWT | Detail. Authorization: requester must be the doctor or the patient |
| PATCH | `/api/appointments/:id/status` | JWT, doctor | State machine: pending → confirmed → completed |
| DELETE | `/api/appointments/:id` | JWT, any | Cancel with optional `cancellationReason` |

### Consultation Notes — nested under appointments

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/appointments/:appointmentId/notes` | JWT | Returns ConsultationNote or null |
| POST | `/api/appointments/:appointmentId/notes` | JWT, doctor | Upsert (create or update) |

### Prescriptions — nested under appointments

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/appointments/:appointmentId/prescriptions` | JWT | List all prescriptions |
| POST | `/api/appointments/:appointmentId/prescriptions` | JWT, doctor | Add prescription |
| DELETE | `/api/appointments/:appointmentId/prescriptions/:prescriptionId` | JWT, doctor | Remove prescription |

### Notifications — `/api/notifications`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/notifications` | JWT | Returns `{ notifications[], unreadCount }`. Latest 50. |
| PATCH | `/api/notifications/read-all` | JWT | Mark all read. **Registered before `/:id/read`** |
| PATCH | `/api/notifications/:id/read` | JWT | Mark single read |

### AI — `/api/ai`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/ai/recommend` | JWT, patient | Body: `{ symptoms: string }`. Returns up to 3 specializations, each with up to 3 matched doctors. Falls back to General Practitioner on parse failure |

---

## Frontend — All Implemented Routes

### Layouts

| Layout | Path scope | Description |
|---|---|---|
| `AuthLayout` | /login, /register | Centered card, no sidebar |
| `MainLayout` | All /patient/* and /doctor/* | Custom sidebar (left) + Header (top) |
| `ConsultationLayout` | /*/consultation/* | Full-screen, minimal chrome, no sidebar |

### Public Routes

| Path | Component | Notes |
|---|---|---|
| `/` | Redirect | → /login |
| `/login` | `LoginPage` | Email + password |
| `/register` | `RegisterPage` | Role selector (patient/doctor) + fields + optional specialization |

### Patient Routes (role-guarded)

| Path | Component | Key features |
|---|---|---|
| `/patient/dashboard` | `PatientDashboardPage` | Upcoming appointments, stats overview |
| `/patient/profile` | `PatientProfilePage` | Edit medical info, avatar upload |
| `/patient/doctors` | `DoctorListPage` | Doctor list with filters + SymptomChecker (AI) |
| `/patient/doctors/:id` | `DoctorProfilePage` | Doctor detail, availability calendar, book button |
| `/patient/appointments/book` | `BookAppointmentPage` | Doctor picker, date/slot selection, reason for visit |
| `/patient/appointments` | `AppointmentListPage` | All patient appointments, filterable by status |
| `/patient/appointments/:id` | `AppointmentDetailPage` | Detail + cancel + prescriptions + notes (if completed) |
| `/patient/consultation/:appointmentId` | `PatientConsultationPage` | Jitsi embed (eligibility-gated) |

### Doctor Routes (role-guarded)

| Path | Component | Key features |
|---|---|---|
| `/doctor/dashboard` | `DoctorDashboardPage` | Pending appointments, patient stats |
| `/doctor/profile` | `DoctorProfilePage` | Edit specialization, bio, fee, accepting patients toggle |
| `/doctor/appointments` | `DoctorAppointmentListPage` | All doctor appointments, filterable by status |
| `/doctor/appointments/:id` | `DoctorAppointmentDetailPage` | Confirm/complete + add notes + add/delete prescriptions |
| `/doctor/availability` | `DoctorAvailabilityPage` | Weekly schedule grid + blocked slot management |
| `/doctor/consultation/:appointmentId` | `DoctorConsultationPage` | Jitsi embed (eligibility-gated) |

### Route Guard: `/dashboard`
Redirects authenticated users to their role-appropriate dashboard (`/patient/dashboard` or `/doctor/dashboard`).

---

## Integration Map

### Auth Flow

```
POST /api/auth/register
  → Zod validate
  → bcrypt.hash(password, 12)
  → DB transaction:
      INSERT users
      INSERT user_roles
      INSERT patient_profiles OR doctor_profiles
  → sign JWT { sub, email, roles, exp: 7d }
  → return { token, user }

All protected requests:
  Authorization: Bearer <token>
  → auth.middleware.ts verifies JWT
  → attaches req.user = { id, email, roles }
```

### Appointment Booking Flow

```
POST /api/appointments
  → validate slot is future
  → check doctor is accepting patients
  → check no overlapping confirmed/pending appointments
  → check no blocked slot covers the time
  → INSERT appointment (with jitsiRoomName = "telehealth-{id}")
  → fire-and-forget: notificationsService.createAndPush(patientId, ...)
  → fire-and-forget: notificationsService.createAndPush(doctorId, ...)
  → return appointment with doctor + patient details
```

### Notification Flow (Pusher)

```
Backend:
  notificationsService.createAndPush(userId, type, title, message, data)
    → INSERT into notifications table
    → pusher.trigger(`user-${userId}`, type, payload)  // fire-and-forget

Frontend (NotificationBell):
  pusher.subscribe(`user-${userId}`)
  channel.bind_global(eventName, data)
    → queryClient.invalidateQueries(['notifications'])
  → GET /api/notifications
  → unreadCount badge updates, dropdown shows new item
```

### Jitsi Video Consultation

```
Room name = "telehealth-{appointmentId}"  (stored in appointments.jitsiRoomName at creation)

Client-side eligibility check (no backend enforcement):
  status === 'confirmed'
  AND now >= scheduledAt - 5 min
  AND now <= endsAt + 15 min

On success → render JitsiRoom with VITE_JITSI_DOMAIN (default: meet.jit.si)
On failure → toast + redirect to appointment detail
```

### AI Symptom Recommendation

```
POST /api/ai/recommend { symptoms }
  → SELECT DISTINCT specialization FROM doctor_profiles  (live DB list)
  → Groq API (llama-3.1-8b-instant, JSON mode)
      prompt: symptoms + available specialization list
  → parse JSON response
  → if parse fails → fallback: "General Practitioner"
  → for each recommended specialization → SELECT doctors (LIMIT 3)
  → return enriched recommendations

Frontend (SymptomChecker in DoctorListPage):
  → collapsible section (closed by default)
  → shows disclaimer: "This is a discovery tool only..."
  → on result: renders up to 3 specialization groups with DoctorCard list
```

### Cloudinary Avatar Upload

```
POST /api/users/:id/avatar  (multipart/form-data, field: "avatar")
  → multer (memory storage, 5 MB limit, JPG/PNG/WebP only)
  → cloudinary.uploader.upload(buffer, { folder: "avatars", ... })
  → update user profilePictureUrl in DB
  → return updated user
```

---

## Notification Event Types

| Type | Triggered when | Who gets it |
|---|---|---|
| `appointment_booked` | Patient books | Patient + Doctor |
| `appointment_confirmed` | Doctor confirms | Patient |
| `appointment_cancelled` | Either party cancels | The other party |
| `appointment_completed` | Doctor marks complete | Patient |

---

## Appointment State Machine

```
            ┌──────────────────────────────┐
            │                              │
  pending ──┤── (doctor) confirmed ─────── completed (terminal)
            │
            └── cancelled (terminal, either party)

no_show — terminal, set manually (not wired in UI yet)
```

---

## Known Bugs (as of 2026-05-28)

| Bug | Location | Impact | Fix |
|---|---|---|---|
| AI returns 0 doctors for a valid specialty | `ai.service.ts` | High — core required feature | Inject exact DB specialization strings into Groq prompt so AI uses the exact format |
| Specialization dropdown loses options after first selection | `BookAppointmentPage` + `DoctorFilter` | Medium — visible to graders | Fetch list from `/api/doctors/specializations`, don't use local filter state |
| Doctor profile back button routes to booking page | `DoctorProfilePage` (patient view) | Low-Medium | Replace `navigate(-1)` / hardcoded path with correct target |

---

## Deployment Gaps (not yet done)

- No `Dockerfile` or Docker Compose
- No Vercel / Fly.io / Render config for either backend or frontend
- No CI/CD pipeline
- Not pushed to any remote Git repository yet
- No environment variable secrets management (`.env` files are local only)

---

## Admin Module — Planned, Not Built

The `admin` role is seeded in the database (`roles` table). No endpoints, no UI, and no admin-specific middleware exist. Future scope includes:

- User management (list, deactivate/reactivate patients and doctors)
- Doctor verification toggle (`isVerified` flag)
- System-wide appointment overview and reporting
- Notification broadcast to all users
- AI recommendation log review

Nothing for admin will be built until core features and deployment are complete.

---

## Environment Variables Required

### Backend (`.env`)

```
DATABASE_URL         Neon PostgreSQL connection string
JWT_SECRET           256-bit signing key
JWT_EXPIRES_IN       Token lifetime (e.g. 7d)
PORT                 Server port (default 3000)
NODE_ENV             development | production
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
PUSHER_APP_ID
PUSHER_KEY
PUSHER_SECRET
PUSHER_CLUSTER
GROQ_API_KEY
CORS_ORIGIN          Allowed frontend origin
```

### Frontend (`.env.local`)

```
VITE_API_URL         Backend base URL (e.g. http://localhost:3000)
VITE_JITSI_DOMAIN    Jitsi server domain (default: meet.jit.si)
VITE_PUSHER_KEY
VITE_PUSHER_CLUSTER
```

---

## Seed Data Available

Run `npm run db:seed` from backend root to populate:
- 3 roles: patient, doctor, admin
- Permissions + role-permission assignments
- Test users: `patient1@example.com`, `doctor1@example.com` (password in seed file)
- Sample doctor profiles with weekly availability
- Sample appointments in various statuses
- Sample consultation notes and prescriptions
- Sample notifications
