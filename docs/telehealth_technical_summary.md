# Telehealth MVP — Technical Constraints & Decisions Summary

**Project:** Whitecloak Launchpad Builder Round (May 26–30, 2026)
**Track:** Software Engineer
**Status:** Foundation constraints finalized, ready for Day 1 implementation

---

## Core Decisions Finalized

### Database: Soft Delete Strategy
- **`deleted_at TIMESTAMP NULL`** added to `users` table only
- **`is_active BOOLEAN DEFAULT true`** kept for admin deactivation (distinct from deletion)
- **Auth middleware filters both:** `WHERE is_active = true AND deleted_at IS NULL`
- Medical records (appointments, notes, prescriptions) are **never deleted** — they're permanent

**Rationale:** Soft delete preserves referential integrity and patient medical history. Hard deletes rejected for MVP.

### Timezone Handling
- All `timestamp` columns stored as **UTC only**
- No `timezone` column on `users` table for MVP
- Frontend responsible for client-side conversion via `toLocaleDateString()` / `toLocaleTimeString()`

### JWT Authentication
- **Access token only** (no refresh token)
- **Expiry:** 7 days (`JWT_EXPIRES_IN=7d`)
- **Payload:** `{ sub: userId, email, roles: string[], iat, exp }`
- **No token rotation, blacklisting, or refresh logic**

### Appointment Conflict Prevention
- **Service layer validation only** — no DB unique constraint
- Before insert: query existing non-cancelled appointments for that doctor at that time
- If found: `throw AppError('Time slot already booked', 409)`
- If not found: proceed with INSERT (inside transaction)

### Database Transactions — Exactly 3 Cases

1. **Appointment Booking**
   ```
   BEGIN
     INSERT appointments
     INSERT notifications (patient + doctor)
   COMMIT
   ```

2. **User Registration + Role Assignment**
   ```
   BEGIN
     INSERT users
     INSERT user_roles
     INSERT patients OR doctors profile scaffold
   COMMIT
   ```

3. **Consultation Notes + Status Update**
   ```
   BEGIN
     INSERT consultation_notes
     UPDATE appointments SET status = 'completed' (optional)
   COMMIT
   ```

---

## Locked Tech Stack (Immutable)

### Backend
- **Node.js** (LTS 20+)
- **Express v5.2.1** (async errors propagate automatically — no try/catch needed in route handlers)
- **TypeScript v6.0.3** (strict mode)
- **PostgreSQL 17 on Neon.tech** (@neondatabase/serverless driver)
- **Drizzle ORM v0.45.2** + drizzle-kit v0.31.10
- **Zod v4.4.3** (NOT v3 — import paths differ)
- **JWT (jsonwebtoken v9.0.3) + bcryptjs v3.0.3**
- **Module system:** CommonJS
- **Validation:** Zod v4 schemas

### Frontend
- **React v19.2.6 + React DOM v19.2.6**
- **Vite v8.0.12** (build tool)
- **TypeScript v6.0.2** (strict mode)
- **Tailwind CSS v4.3.0** (CSS-based config in `index.css`, NO `tailwind.config.js`)
- **Shadcn v4.8.0 + radix-ui v1.4.3** (unified package, NOT individual `@radix-ui/react-*`)
- **TanStack Query** (server state management)
- **React Context** (auth state only, AuthProvider)
- **Module system:** ESM
- **Icons:** lucide-react v1.16.0
- **Font:** @fontsource-variable/geist v5.2.9
- **State:** local `useState` for UI-only, no Redux

### External Services
- **Jitsi Meet** (video — embedded via @jitsi/react-sdk, room name = appointmentId)
- **Pusher or Ably** (real-time notifications)
- **Anthropic API** (doctor recommendation from symptoms)
- **Cloudinary** (profile picture uploads)

### Deployment
- **Frontend:** Vercel
- **Backend:** Render or Railway
- **Database:** Neon.tech PostgreSQL
- **Version Control:** GitHub (two separate repos)

---

## Architecture Patterns (Ground Truth)

### Backend Module Pattern
```
src/modules/<module>/
├── <module>.controller.ts    # Route handlers, parse request, call service, return response
├── <module>.service.ts       # Business logic, orchestration
├── <module>.repository.ts    # Drizzle ORM queries only
└── <module>.schema.ts        # Drizzle table definitions + Zod validators
```

**Flow:** Controller → Service → Repository → Database

**Rules:**
- No business logic in controllers
- No `try/catch` in Express v5 route handlers (async errors propagate automatically)
- All DB access through repositories only
- All error handling via `AppError` class

### Frontend Feature Pattern
```
src/features/<feature>/
├── api/                      # Axios call functions (not hooks)
├── components/               # Feature-scoped components
├── hooks/                    # useQuery/useMutation wrappers
├── types/                    # TypeScript interfaces
├── patient/                  # Patient-specific pages
└── doctor/                   # Doctor-specific pages
```

**Flow:** Pages → Features → Shared Components → API Services → Backend

**Rules:**
- No API calls inside components — use hooks
- API functions return raw `data` from response envelope
- Hooks add query/mutation behavior via TanStack Query
- No cross-feature imports of components (shared components live in `src/shared/`)

---

## Response Envelope (All Endpoints)

### Success
```json
{
  "success": true,
  "message": "Human-readable description",
  "data": { }  // object for single resource, array for collections, never null
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error description",
  "errors": []  // array of field-level validation errors, empty for general errors
}
```

### HTTP Status Codes
- `200` — Successful GET, PUT/PATCH, DELETE
- `201` — Successful POST (resource created)
- `400` — Validation error, bad request
- `401` — Missing or invalid JWT
- `403` — Valid JWT but insufficient role/permission
- `404` — Resource not found
- `409` — Conflict (duplicate email, double booking, time slot taken)
- `500` — Unhandled server error

---

## Explicitly Excluded from MVP

❌ Soft delete for appointments/notes/prescriptions (medical records are permanent)
❌ Audit logging (who changed what, when)
❌ Data encryption (dev/demo only, assume plaintext)
❌ Rate limiting
❌ API versioning
❌ Password reset flow
❌ Email verification
❌ Doctor license validation
❌ Timezone column on users
❌ Refresh tokens / token rotation
❌ Prescriptions PDF export
❌ Recurring scheduling infrastructure
❌ Calendar sync
❌ Payment systems
❌ Advanced analytics
❌ Microservices / CQRS / event sourcing
❌ GraphQL
❌ Advanced WebSocket infrastructure
❌ AI agents (simple API call to Gemini only)
❌ Custom video system (Jitsi embed only)
❌ Redux / Zustand (Context + TanStack Query only)
❌ Test suite
❌ Docker for local dev

---

## Database Schema Summary

### Core Tables
- `users` (with `deleted_at` + `is_active`)
- `roles`, `permissions`, `role_permissions`, `user_roles` (RBAC)
- `patients` (1:1 with users)
- `doctors` (1:1 with users)
- `doctor_availability` (recurring weekly slots)
- `doctor_blocked_slots` (one-off unavailable periods)
- `appointments` (booking with status enum)
- `consultation_notes` (1:1 with appointments)
- `prescriptions` (1:N with appointments)
- `notifications` (persisted notification history)

**All tables use UUID PKs, UTC timestamps, Drizzle-managed.**

---

## Implementation Strategy

### Day 1 — Foundation
- Backend scaffold + Neon DB live + auth working end-to-end
- Frontend scaffold + router + auth context + shared components

### Day 2 — Core Data
- Doctor discovery + patient profiles
- Appointment CRUD

### Day 3 — Consultation Flow
- Appointment booking UI + status management
- Jitsi integration

### Day 4 — Supporting Features
- Doctor availability management
- Real-time notifications (Pusher)
- AI recommendation (Google Gemini API)

### Day 5 — Polish + Deploy
- Bug fixes, UI refinement, empty states, loading states
- Deploy to Vercel + Render/Railway
- Video demo + submission

---

## Critical Implementation Notes

### Express v5
```ts
// ✅ CORRECT — async errors propagate automatically
router.post('/', async (req, res) => {
  const data = await someService()  // error throws automatically
  res.json(data)
})

// ❌ WRONG (Express v4 pattern)
router.post('/', async (req, res, next) => {
  try {
    const data = await someService()
    res.json(data)
  } catch (err) {
    next(err)  // unnecessary in v5
  }
})
```

### Zod v4
```ts
// ✅ CORRECT
import { z } from 'zod'
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Error format changed in v4 — use .flatten() in error middleware
```

### Tailwind CSS v4
```css
/* ✅ CORRECT — CSS-based config in index.css */
@import "tailwindcss";
@theme {
  --color-primary: #0ea5e9;
  --font-sans: "Geist Variable", sans-serif;
}

/* ❌ WRONG — no tailwind.config.js */
```

### Radix UI
```ts
// ✅ CORRECT — unified package
import * as Dialog from 'radix-ui/react-dialog'

// ❌ WRONG — individual scoped packages
import * as Dialog from '@radix-ui/react-dialog'
```

---

## Naming Conventions

### Backend
- Files: kebab-case (`appointments.service.ts`)
- Classes: PascalCase (`AppointmentService`)
- Functions: camelCase (`createAppointment`)
- DB columns: snake_case (`scheduled_at`)
- Drizzle tables: camelCase (`appointments`)
- Zod schemas: camelCase + suffix (`createAppointmentSchema`)
- Routes: kebab-case (`/appointments/:id/blocked-slots`)

### Frontend
- Components: PascalCase (`AppointmentCard.tsx`)
- Hooks/API/Utils: camelCase (`useAppointments.ts`)
- Pages: PascalCase (`AppointmentListPage.tsx`)
- TypeScript types: PascalCase (`Appointment`, `CreateAppointmentDto`)
- Query keys: factory function (`QUERY_KEYS.appointments.all()`)

---

## RBAC Model

**Extensible by design — no hardcoding, all from DB:**

Seeded roles: `patient`, `doctor`

New roles (e.g., `admin`) added via single DB insert — zero code changes.

Auth middleware reads roles at request time and attaches to `req.user.roles`.

---

## Git & Deployment

### Repositories
- `telehealth-backend` — Express API
- `telehealth-frontend` — React SPA
- Both public on personal GitHub
- MIT License on both

### Environment Variables

**Backend (.env):**
```
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
GEMINI_API_KEY=
CLOUDINARY_URL=
CORS_ORIGIN=
PORT=3000
```

**Frontend (.env):**
```
VITE_API_URL=
VITE_PUSHER_KEY=
VITE_PUSHER_CLUSTER=
VITE_JITSI_DOMAIN=meet.jit.si
```

---

## Scoring Weights (Remember)

- **Functionality & Scope:** 40%
- **Design & Product Sense:** 40% ← UI/UX decisions matter equally
- **Code Quality & Adherence:** 10%
- **Presentation & Communication:** 10%

**Design is NOT an afterthought. Every UI decision is evaluated.**

---

## Next Steps

Ready for **Day 1 Implementation Contract** when you are. Haiku will receive:
- Exact file list for scaffold
- Function signatures (service + repository methods)
- Zod schema fields
- Endpoint paths and request/response shapes
- Database migration instructions
