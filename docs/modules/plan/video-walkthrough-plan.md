# 15-Minute Telehealth App Video Recording Plan

## Context
A recorded walkthrough of the telehealth app covering the live app demo, codebase overview, and technical limitations with future plans. Target length: ≤15 minutes.

---

## Segment Breakdown

### Segment 1 — Introduction (0:00–1:00) · ~1 min
- What is the app? A full telemedicine MVP with two roles: **Patient** and **Doctor**
- Core problem it solves: booking, video consultations, AI symptom checking
- Quick list of major features (bullet, no deep dive yet):
  - Auth, doctor discovery, appointment booking
  - Jitsi video consultations, consultation notes & prescriptions
  - AI symptom checker (Groq), real-time notifications (Pusher)

---

### Segment 2 — App Walkthrough (1:00–8:30) · ~7:30 min

#### A. Landing & Auth (1:00–2:00)
- Show the landing page (`/`)
- Register as a **patient** (role selection in register form)
- Log in — observe JWT stored, redirect to patient dashboard

#### B. Patient Flow (2:00–5:00)
1. **Dashboard** (`/patient/dashboard`) — today's appointments, quick stats
2. **Doctor Discovery** (`/patient/doctors`) — filters (specialization, fee, rating), doctor cards
3. **AI Symptom Checker** — expand panel on doctor list page, enter symptoms, watch streamed recommendations from Groq
4. **Doctor Profile** (`/patient/doctors/:id`) — bio, availability, rating
5. **Book Appointment** (`/patient/appointments/book`) — select slot, reason for visit, submit → pending status
6. **Appointment List** (`/patient/appointments`) — filter tabs (pending / confirmed / completed / cancelled)
7. **Appointment Detail** (`/patient/appointments/:id`) — view details, prescriptions panel
8. **Consultation Preview** → **Consultation Room** — Jitsi embed (join eligibility window: 5 min before → 15 min after end)

#### C. Doctor Flow (5:00–7:30)
1. **Dashboard** (`/doctor/dashboard`) — today's schedule
2. **Availability** (`/doctor/availability`) — set working hours, block individual slots
3. **Appointment List** (`/doctor/appointments`) — confirm a pending appointment
4. **Appointment Detail** (`/doctor/appointments/:id`) — add consultation notes (chief complaint, diagnosis), add prescriptions
5. **Patient Medical History** (`/doctor/patients/:patientId`) — see past appointments & medical profile (weight, height, blood type)

#### D. Real-time Notifications (7:00–7:30)
- Trigger a status change; show notification bell update live via Pusher

#### E. Profile & Settings (7:30–8:30)
- Update profile picture (Cloudinary upload)
- Settings page — account security; mention session tab is a known placeholder

---

### Segment 3 — Code Overview (8:30–12:30) · ~4 min

#### Architecture in 30 seconds (8:30–9:00)
- **Frontend:** React 19 + Vite, Tailwind CSS v4, TanStack Query, React Router v7, React Hook Form + Zod
- **Backend:** Node + Express v5, Drizzle ORM, PostgreSQL (Neon), JWT auth, Pusher, Cloudinary, Groq AI
- Monorepo: `telehealth-frontend/` + `telehealth-backend/` + root `e2e/`

#### Frontend structure (9:00–10:00)
- Feature-driven modules: `src/features/<feature>/api | components | hooks | types`
- Show one example: `src/features/appointments/` — api call → hook → component
- Shared layer: `src/shared/ui/`, `src/shared/lib/api.ts` (JWT auto-refresh interceptor)
- AuthContext + TanStack Query = no Redux needed

#### Backend structure (10:00–11:00)
- Module pattern: `controller → service → repository → schema`
- Show one example: `src/modules/appointments/`
- Express v5 async error propagation (no try/catch in handlers)
- Drizzle ORM — no raw SQL, migrations via drizzle-kit
- Consistent API envelope: `{ success, message, data }`

#### Key integrations (11:00–12:30)
- **Jitsi:** `JitsiRoom.tsx` — `@jitsi/react-sdk`, room name derived from appointmentId
- **Pusher:** backend triggers on appointment events → frontend subscribes → invalidates TanStack Query cache
- **Groq AI:** streaming response, token-by-token render, JSON parser fallback
- **Cloudinary:** avatar upload via Multer → Cloudinary SDK in `users` module

---

### Segment 4 — Technical Limitations & Future Plans (12:30–14:30) · ~2 min

| Limitation | Why It Exists | Future Plan |
|---|---|---|
| **Pusher public channels** | Faster to ship for MVP; no auth endpoint needed | Migrate to Pusher private/presence channels with `/api/auth/pusher` endpoint for proper per-user security |
| **Client-side join eligibility** | Simpler for MVP; no need for backend state | Move eligibility check to backend (`GET /api/appointments/:id/join-eligibility`) to prevent bypass |
| **No session management API** | `/api/auth/sessions` not yet implemented; `SessionsTabContent.tsx` has a TODO | Implement token registry (store refresh tokens in DB with device/IP metadata, allow revocation per session) |
| **No email notifications** | Pusher only; SMTP not configured | Integrate Nodemailer/Resend for appointment reminders (confirmed, upcoming 1h before) |
| **No PDF prescription export** | Bonus feature deferred | Add `pdf-lib` or `puppeteer`-based PDF generation endpoint (`GET /api/appointments/:id/prescriptions/pdf`) |
| **No real-time chat** | Out of scope for MVP | Add Pusher private channel DM between patient & doctor for pre/post consultation messaging |
| **No rate limiting (API-wide)** | Only booking limit exists | Add `express-rate-limit` middleware globally + per-route limits on auth endpoints |
| **Accessibility (a11y)** | Radix UI provides basics; no audit done | Conduct axe-core audit, add comprehensive ARIA labels, keyboard navigation for consultation room controls |

---

### Segment 5 — Closing (14:30–15:00) · ~30 sec
- Recap: full-stack telemedicine app with modern stack
- Testing: 630+ tests, Playwright e2e coverage for all core flows
- Thank you / call to action

---

## Recording Tips
- **Screen resolution:** 1920×1080, browser zoom at 100%
- **Demo data:** Seed the DB before recording (`npm run db:seed` in backend)
- **Browser:** Open two windows side-by-side (patient + doctor) for real-time notification demo
- **Code segments:** Use VS Code with the folder open; show file tree + relevant file side-by-side
- **Timing:** Use a timer widget; aim for segments to end on time — cut details if running long
