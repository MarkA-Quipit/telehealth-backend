# 08 — Build Order

## Guiding Principle

Build in dependency order. A feature is only started when everything it depends on is done. Never build two interdependent features simultaneously.

The goal is a **deployable, demo-able application at the end of each day** — not a partially-built system that only works when all parts are done.

---

## Risk Register (read before starting)

| Risk | Mitigation |
|---|---|
| Jitsi SDK integration issues | Spike it on Day 1 with a test embed — don't wait until Day 4 |
| Pusher real-time wiring | Set up the Pusher account and test publish/subscribe on Day 1 |
| Neon DB cold starts in production | Use connection pooling mode in the Neon connection string |
| Drizzle migrations getting out of sync | Run `drizzle-kit generate` + `migrate` after every schema change |
| Tailwind v4 config issues | Validate `@theme {}` tokens render correctly before building pages |
| Radix UI import breakage | Verify unified `radix-ui` imports work after shadcn component add |
| Time overrun | Scope cut order: availability management → notifications → AI → Jitsi |

---

## Build Order Overview

```
Day 1:  Foundation (both repos scaffolded, DB live, auth working end-to-end)
Day 2:  Core data + doctor discovery (doctors, patients, appointments CRUD)
Day 3:  Appointment flow + consultation (booking UI, status management, Jitsi)
Day 4:  Supporting features (availability, notifications, AI recommendation)
Day 5:  Polish, integration, deployment, video demo
```

---

## Day 1 — Foundation

**Goal:** Both repos running locally. Auth works end-to-end. DB is live on Neon. Basic layout renders.

### Backend

**Order matters — each step depends on the previous.**

1. **Repo scaffold**
   - Init `telehealth-backend` with `package.json`, `tsconfig.json`
   - Install all locked dependencies (see `02-tech-stack.md`)
   - Set up `src/index.ts` with Express app, helmet, cors, JSON parser
   - Set up `src/config/env.ts` (typed env loader with Zod)
   - Set up `src/config/db.ts` (Neon + Drizzle connection)

2. **Database schema (all tables at once)**
   - Write all Drizzle table definitions in their respective `*.schema.ts` files
   - Run `drizzle-kit generate` and `drizzle-kit migrate`
   - Verify tables exist in Neon Studio
   - Run seed script: roles, permissions, role_permissions

3. **Shared infrastructure**
   - `src/shared/middleware/auth.middleware.ts` — JWT verify + role attach
   - `src/shared/middleware/error.middleware.ts` — AppError + Zod + fallback
   - `src/shared/types/index.ts` — AppError class, AuthUser interface, Request augmentation

4. **Auth module**
   - `auth.schema.ts` — Zod schemas: `registerSchema`, `loginSchema`
   - `auth.repository.ts` — `findByEmail`, `createUser`, `assignRole`
   - `auth.service.ts` — `register`, `login`, `getMe`
   - `auth.controller.ts` — POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`
   - Wire routes in `src/index.ts`
   - Test: register → login → get /me returns user with role

5. **Spike: Pusher connection test**
   - Create Pusher account, get credentials
   - Test trigger + subscribe in isolation (not wired to features yet)
   - Confirm real-time works before Day 4

### Frontend

1. **Repo scaffold**
   - Init `telehealth-frontend` with Vite + React + TypeScript
   - Install all locked dependencies
   - Set up `index.css` with Tailwind v4 `@import` and `@theme {}` tokens
   - Verify Geist font loads
   - Add shadcn, init `components.json`
   - Add core shadcn components: button, input, label, form, card, badge, avatar, dialog, sheet, toast, skeleton, tabs, separator, dropdown-menu

2. **Shared infrastructure**
   - `src/shared/lib/api.ts` — Axios instance with base URL + auth interceptor
   - `src/shared/lib/utils.ts` — `cn()` helper
   - `src/shared/constants/routes.ts` — route path constants
   - `src/shared/constants/queryKeys.ts` — TanStack Query key factories
   - `src/app/providers/QueryProvider.tsx` — TanStack Query client
   - `src/app/providers/AuthProvider.tsx` — JWT state, login, logout, currentUser

3. **Router setup**
   - `src/app/router/index.tsx` — all routes defined
   - `ProtectedRoute` — redirect to `/login` if no token
   - `RoleGuard` — redirect to role-default route if wrong role
   - Public routes: `/login`, `/register`
   - Placeholder pages for all protected routes (just renders route name)

4. **Layouts**
   - `AuthLayout.tsx` — centered card, logo, no nav
   - `MainLayout.tsx` — sidebar + header + `<Outlet />`
   - `Header.tsx` — logo, notification bell placeholder, user avatar + dropdown
   - `Sidebar.tsx` — role-aware nav links (patient / doctor)

5. **Auth feature**
   - `auth.api.ts` — `login()`, `register()`, `getMe()`
   - `LoginPage.tsx` — form, validation, error display, redirect on success
   - `RegisterPage.tsx` — form with role selector (patient/doctor), validation
   - Test: register → login → redirected to dashboard by role

**Day 1 done when:**
- [ ] `POST /api/auth/register` works for both roles
- [ ] `POST /api/auth/login` returns JWT
- [ ] `GET /api/auth/me` returns user with role
- [ ] Frontend login/register forms submit and redirect
- [ ] `MainLayout` renders with sidebar showing correct role-based nav links
- [ ] All DB tables exist in Neon

---

## Day 2 — Core Data + Doctor Discovery

**Goal:** Doctors and patients have profiles. Doctor list is browsable. Appointment creation works in the backend.

### Backend

1. **Users module**
   - `users.repository.ts` — `findById`, `updateById`
   - `users.service.ts` — `getUserById`, `updateUser`
   - `users.controller.ts` — GET `/api/users/:id`, PUT `/api/users/:id`
   - Cloudinary avatar upload: POST `/api/users/:id/avatar`

2. **Patients module**
   - `patients.schema.ts` — patient fields
   - `patients.repository.ts` — `findByUserId`, `upsert`
   - `patients.service.ts` — `getPatientProfile`, `updatePatientProfile`
   - `patients.controller.ts` — GET `/api/patients/:id`, PUT `/api/patients/:id`

3. **Doctors module**
   - `doctors.schema.ts` — doctor fields + availability + blocked slots
   - `doctors.repository.ts` — `findAll`, `findById`, `findByUserId`, `update`
   - `doctors.service.ts` — `listDoctors` (with filters), `getDoctorById`, `updateDoctorProfile`
   - `doctors.controller.ts` — GET `/api/doctors`, GET `/api/doctors/:id`, PUT `/api/doctors/:id`
   - Filters: `?specialization=`, `?search=`, `?page=`, `?limit=`

4. **Appointments module (backend only)**
   - `appointments.schema.ts` — appointment table + status enum + Zod schemas
   - `appointments.repository.ts` — `create`, `findById`, `findByPatient`, `findByDoctor`, `updateStatus`, `cancel`
   - `appointments.service.ts` — `createAppointment` (check for conflicts), `getAppointment`, `listAppointments`, `cancelAppointment`, `updateStatus`
   - `appointments.controller.ts` — POST, GET (list), GET (detail), PUT, DELETE, PATCH `/status`

### Frontend

1. **Patient profile page**
   - `PatientProfilePage.tsx` — form to edit: name, DOB, weight, height, blood type, allergies, medical history, emergency contact
   - Avatar upload via `AvatarUpload.tsx`
   - Saves via `PUT /api/patients/:id`

2. **Doctor profile page**
   - `DoctorProfilePage.tsx` — edit: bio, specialization, years of experience, consultation fee
   - Avatar upload

3. **Doctor discovery (patient-facing)**
   - `DoctorListPage.tsx` — grid of `DoctorCard.tsx` components
   - `DoctorFilter.tsx` — specialization dropdown + search input + debounce
   - `DoctorCard.tsx` — name, specialization, years of experience, accepting patients badge, "Book" button
   - `DoctorProfilePage.tsx` (patient view) — full doctor info + "Book Appointment" CTA
   - Pagination

4. **Dashboard pages (skeleton versions)**
   - `patient/dashboard` — upcoming appointments placeholder + quick actions
   - `doctor/dashboard` — today's schedule placeholder + stats

**Day 2 done when:**
- [ ] Doctor list renders with real data from API
- [ ] Doctor filter by specialization works
- [ ] Patient profile saves and reloads correctly
- [ ] Doctor profile saves and reloads correctly
- [ ] All appointment CRUD endpoints return correct responses

---

## Day 3 — Appointment Flow + Consultation

**Goal:** Patient can book, view, and cancel appointments. Doctor can confirm and complete them. Both can join a Jitsi session.

### Backend

1. **Doctor slots endpoint**
   - `GET /api/doctors/:id/slots?date=YYYY-MM-DD`
   - Logic: take weekly availability for that day → subtract booked appointments → subtract blocked slots → return open 30-min windows

2. **Consultation notes module**
   - Schema, repository, service, controller
   - POST/GET/PUT `/api/appointments/:id/notes`

3. **Prescriptions module**
   - Schema, repository, service, controller
   - POST/GET/DELETE `/api/appointments/:id/prescriptions`

### Frontend

1. **Appointment booking flow**
   - `BookAppointmentPage.tsx` — date picker → slot selector (`AvailabilityCalendar.tsx`) → reason field → confirm
   - `AvailabilityCalendar.tsx` — calls `GET /api/doctors/:id/slots?date=` on date change, renders time slots
   - On submit: `POST /api/appointments` → success toast → redirect to appointment list

2. **Appointment list pages**
   - `AppointmentListPage.tsx` (patient) — tabs: Upcoming / Past. `AppointmentCard.tsx` per row. Status badge.
   - `DoctorAppointmentListPage.tsx` (doctor) — all appointments, filter by status

3. **Appointment detail pages**
   - `AppointmentDetailPage.tsx` (patient) — date, time, doctor, status badge, join button (enabled when confirmed + within 15 min or during session), cancel button
   - `DoctorAppointmentDetailPage.tsx` — patient info, status controls (confirm, complete), notes editor, prescriptions form

4. **Consultation pages (Jitsi)**
   - `JitsiRoom.tsx` — `@jitsi/react-sdk` embed, `roomName = appointmentId`
   - `ConsultationPage.tsx` (patient) — full-area Jitsi embed + back button
   - `ConsultationPage.tsx` (doctor) — full-area Jitsi embed + back button

5. **Medical records (patient)**
   - Appointment history with consultation notes and prescriptions per appointment

**Day 3 done when:**
- [ ] Patient can book an appointment with a real doctor
- [ ] Doctor can confirm an appointment
- [ ] Join button appears and navigates to Jitsi room
- [ ] Jitsi room opens correctly for both roles
- [ ] Doctor can write notes and add prescriptions
- [ ] Patient can see their appointment history with notes/prescriptions

---

## Day 4 — Supporting Features

**Goal:** Availability management works. Real-time notifications fire. AI recommendation returns results.

### Backend

1. **Doctor availability management**
   - PUT `/api/doctors/:id/availability` — set weekly schedule (array of day + start/end)
   - POST `/api/doctors/:id/blocked-slots` — block a specific date/time
   - DELETE `/api/doctors/:id/blocked-slots/:slotId`

2. **Notifications module**
   - Schema, repository, service, controller
   - GET `/api/notifications`, PATCH `/:id/read`, PATCH `/read-all`
   - `notifications.service.ts` — `createAndPush(userId, type, title, message, data)` — persists to DB + triggers Pusher
   - Call `createAndPush` from `appointments.service.ts` on: create, confirm, cancel, status change

3. **AI module**
   - `ai.service.ts` — calls Google Gemini API with symptom text, returns specialization recommendations + matched doctors
   - POST `/api/ai/recommend` — patient only

### Frontend

1. **Doctor availability page**
   - `DoctorAvailabilityPage.tsx` — weekly grid (Mon–Sun) with start/end time inputs per day, toggle available/unavailable
   - Blocked slots: date picker + time range + add/remove

2. **Notifications**
   - `useNotifications.ts` — Pusher subscription on `private-user-{userId}` + TanStack Query for persisted list
   - `NotificationBell.tsx` — unread badge count + popover trigger
   - `NotificationList.tsx` — list with mark-read per item + mark all read

3. **AI recommendation**
   - `SymptomInput.tsx` — textarea + submit, shows loading state
   - On response: renders recommended specializations with reason + matched doctor cards linking to their profile
   - Lives in `DoctorListPage.tsx` as a tab or collapsible section

**Day 4 done when:**
- [ ] Doctor can set weekly availability
- [ ] Blocked slots remove those times from the booking calendar
- [ ] Booking an appointment sends a real-time notification to the doctor
- [ ] Notification bell shows unread count and list
- [ ] AI symptom input returns specialization recommendations with doctor links

---

## Day 5 — Polish + Deploy + Demo

**Goal:** App is deployed, accessible via public URL, demo video recorded, submission submitted.

### Morning: Bug fixes + polish

Priority order:
1. Fix any broken flows from Days 1–4
2. Empty states on all list pages
3. Loading skeletons on all data-fetching pages
4. Error states on forms (field-level and server-level)
5. Mobile responsiveness (sidebar → Sheet drawer on mobile)
6. Toast messages on all create/update/delete/cancel actions
7. Disabled states on join button (outside 15-min window)
8. Avatar fallback when no profile picture

### Afternoon: Deployment

**Backend (Render or Railway):**
1. Push `telehealth-backend` to GitHub
2. Create Render Web Service (or Railway project)
3. Set all environment variables
4. Confirm `/api/auth/me` returns 401 (server is up)
5. Run `drizzle-kit migrate` against production DB

**Frontend (Vercel):**
1. Push `telehealth-frontend` to GitHub
2. Import repo in Vercel
3. Set `VITE_API_URL` to production backend URL
4. Set other `VITE_*` env vars
5. Confirm login/register work against production backend

**Smoke test (production):**
- Register patient + doctor
- Patient books appointment with doctor
- Doctor confirms
- Both join Jitsi session
- Doctor writes notes + prescription
- Patient views medical records
- Notification bell shows unread

### Evening: Video demo + submission

**Video structure (max 15 minutes):**
1. App walkthrough as patient (2–3 min)
   - Register → browse doctors → AI recommendation → book appointment
   - Receive notification → join consultation → view records
2. App walkthrough as doctor (2–3 min)
   - Manage availability → view appointments → confirm → join → write notes + prescriptions
3. Code overview (4–5 min)
   - Backend: module pattern, auth middleware, Drizzle schema, API conventions
   - Frontend: feature structure, TanStack Query, AuthContext, Pusher subscription
4. Technical limitations + future plans (2–3 min)

**Submit at:** https://forms.gle/2QrDQ17KBhHqWqBK9

---

## Scope Cut Order

If time runs out, cut in this exact order (least to most core):

| Cut | What you lose | What you keep |
|---|---|---|
| 1. AI recommendation | Symptom → doctor search | All other features |
| 2. Pusher notifications | Real-time bell | Email-free, but bookings still work |
| 3. Doctor availability management | Doctors can't set their schedule | Bookings still work with all-day availability |
| 4. Blocked slots | Doctors can't block specific times | Still bookable |
| 5. Avatar upload | No profile pictures | Initials fallback |
| 6. Prescription PDF (bonus) | Never in scope | N/A |

**Never cut:**
- Auth (register + login)
- Doctor list + discovery
- Appointment booking
- Appointment status management (confirm / cancel / complete)
- Jitsi consultation session
- Consultation notes
- Prescriptions (form-based, no PDF)
- Medical records view (patient)

---

## Daily Checkpoint Template

At the end of each day, verify:

```
Day N Checkpoint
─────────────────
Backend:
  [ ] All endpoints for today's scope return correct responses
  [ ] No TypeScript errors
  [ ] Drizzle migrations applied

Frontend:
  [ ] All pages for today's scope render without console errors
  [ ] All forms submit and show correct feedback
  [ ] Loading and empty states present

Integration:
  [ ] Frontend → backend calls succeed in browser network tab
  [ ] Auth token flows correctly (login → protected route → API call)

Deploy-readiness:
  [ ] No hardcoded localhost URLs
  [ ] .env.example up to date
  [ ] No secrets committed
```
