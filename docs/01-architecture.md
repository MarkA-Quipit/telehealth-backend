# 01 — Architecture

## System Overview

Two separate deployable services with a shared PostgreSQL database on Neon.

```
[Browser]
    │
    ├── GET /  →  [Frontend: Vercel]
    │                React + Vite + TailwindCSS
    │
    └── /api/* →  [Backend: Render/Railway]
                     Express v5 + TypeScript
                          │
                     [Neon PostgreSQL]
                          │
               ┌──────────┼──────────┐
          [Pusher/Ably]  [Jitsi]  [Google Gemini API]
         (notifications) (video)   (AI features)
```

## Repository Structure

Two separate GitHub repositories:
- `telehealth-frontend` — React SPA deployed to Vercel
- `telehealth-backend` — Express API deployed to Render or Railway

## Backend Architecture

### Request Flow

```
HTTP Request
  → Router
    → Middleware (auth, validation)
      → Controller  (parse request, call service, return response)
        → Service   (business logic, orchestration)
          → Repository  (database queries via Drizzle ORM)
            → Neon PostgreSQL
```

### Module Structure

Every backend domain lives under `src/modules/<module>/` with exactly four files:

```
<module>/
├── <module>.controller.ts   # Route handlers, request/response
├── <module>.service.ts      # Business logic, orchestration
├── <module>.repository.ts   # Drizzle ORM queries only
└── <module>.schema.ts       # Drizzle table definitions + Zod validators
```

### Modules

| Module | Responsibility |
|---|---|
| `auth` | Registration, login, JWT issuance |
| `users` | Shared user profile, RBAC lookups |
| `patients` | Patient profile, medical history |
| `doctors` | Doctor profile, specialization, availability |
| `appointments` | Booking, rescheduling, cancellation |

### Shared Infrastructure

```
src/shared/
├── middleware/
│   ├── auth.middleware.ts       # JWT verification, role injection
│   └── error.middleware.ts      # Express v5 error handler
└── types/
    └── index.ts                 # Shared TypeScript interfaces
```

### Express v5 Notes

- Async errors in route handlers propagate automatically — no `try/catch` needed per handler
- Error middleware signature: `(err, req, res, next)`
- Use `app.use(errorMiddleware)` as the last middleware

## Frontend Architecture

### Component Flow

```
Page
  → Feature Component (domain logic)
    → Shared Component (reusable UI)
      → API Service (axios + TanStack Query)
        → Backend
```

### Feature Structure

Every frontend domain lives under `src/features/<feature>/`:

```
<feature>/
├── api/          # Axios calls, query/mutation hooks
├── components/   # Feature-scoped components
├── hooks/        # Feature-scoped custom hooks
├── types/        # TypeScript interfaces for this feature
├── patient/      # Patient-specific pages/views
└── doctor/       # Doctor-specific pages/views
```

### Features

| Feature | Patient | Doctor |
|---|---|---|
| `auth` | Register, Login | Register, Login |
| `appointments` | Book, Reschedule, Cancel, History | Manage, View |
| `consultations` | Join session | Join + document session |
| `users` | Profile edit | Profile edit |
| `notifications` | Bell + list | Bell + list |
| `ai` | Symptom input, recommendations | — |

### State Management

- Server state: TanStack Query (queries + mutations)
- Auth state: React Context (`AuthProvider`)
- UI state: local `useState` per component
- No Redux unless explicitly requested

## RBAC Design

Roles are data-driven, not hardcoded in application logic.

```
roles           → role_permissions → permissions
  ↑
user_roles ← users
```

Seeded roles: `patient`, `doctor`

Adding new roles (e.g., `admin`) requires only a DB insert — zero code changes.

Auth middleware reads the user's role(s) from the database at request time and attaches them to `req.user`.

## External Services

| Service | Usage | Integration Point |
|---|---|---|
| Neon PostgreSQL | Primary database | `@neondatabase/serverless` driver |
| Jitsi Meet | Video consultation | `@jitsi/react-sdk` embed in frontend |
| Pusher or Ably | Real-time notifications | Backend triggers, frontend subscribes |
| Google Gemini API | AI doctor recommendation | Backend service, called from `ai` module |
| Cloudinary | Profile picture uploads | Backend upload endpoint |

## Deployment Targets

| Service | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Auto-deploy from GitHub |
| Backend | Render or Railway | Always-on free tier or paid |
| Database | Neon.tech | PostgreSQL 17, serverless |

## Environment Variables

Backend (`.env`):
```
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
GEMINI_API_KEY=
CLOUDINARY_URL=
CORS_ORIGIN=
PORT=
```

Frontend (`.env`):
```
VITE_API_URL=
VITE_PUSHER_KEY=
VITE_PUSHER_CLUSTER=
VITE_JITSI_DOMAIN=
```
