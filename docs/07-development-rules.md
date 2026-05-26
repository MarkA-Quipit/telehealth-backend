# 07 — Development Rules

## Role of This Document

These rules govern how code is written and decisions are made throughout the sprint. Every generated file — backend or frontend — must conform to these conventions. When in doubt, check this document before writing code.

---

## Sprint Operating Model

### Claude Sonnet — Architect Role

Responsibilities:
- System decomposition and planning
- Module contract definition
- Database schema decisions
- API contract planning
- Risk identification
- Code review and validation
- Debugging complex issues
- Simplification decisions ("is this worth building?")

**Does not write implementation code.**

### Claude Haiku — Implementation Role

Responsibilities:
- File-by-file implementation following defined contracts
- CRUD operations (repository, service, controller, route)
- Zod schemas and DTOs
- UI components, pages, hooks, API calls
- Boilerplate and repetitive code

**Does not redesign architecture.**

### Rule: Architect First, Implement Second

Before Haiku generates any module, Sonnet must define:
1. Exact files to be created
2. Function signatures (service + repository methods)
3. Endpoint paths and request/response shapes
4. Zod schema fields
5. UI screens and expected behavior

---

## Backend Rules

### Module Pattern (non-negotiable)

Every backend module lives under `src/modules/<module>/` with exactly four files:

```
<module>.controller.ts    # Route handlers only — parse, call service, respond
<module>.service.ts       # Business logic and orchestration
<module>.repository.ts    # Drizzle ORM queries only
<module>.schema.ts        # Drizzle table definitions + Zod validators
```

No exceptions. No fifth file per module unless pre-approved.

### Controller Rules

- No business logic. Controllers parse requests, call one service method, and return the response.
- No `try/catch` around async calls — Express v5 propagates async errors automatically.
- Always use the standard response envelope.
- Validate input with Zod before calling the service.

```ts
// Correct Express v5 pattern
router.post('/appointments', authenticate, async (req: AuthRequest, res: Response) => {
  const body = createAppointmentSchema.parse(req.body)
  const result = await appointmentService.create(req.user!.id, body)
  res.status(201).json({ success: true, message: 'Appointment created', data: result })
})
```

### Service Rules

- All business logic goes here.
- Services call repositories, external APIs (Pusher, Anthropic, Cloudinary), and other services.
- Services throw errors using the `AppError` class. Never call `res` inside a service.
- One service per module. No cross-module service imports unless there is a clear dependency (e.g., `notifications.service` is called from `appointments.service`).

### Repository Rules

- Only Drizzle ORM queries. No business logic.
- All database access goes through the repository. Controllers and services never import `db` directly.
- Return raw data; services are responsible for transforming it.

```ts
// Correct
async findByPatient(patientId: string) {
  return db.select().from(appointments).where(eq(appointments.patientId, patientId))
}

// Wrong — no raw SQL
async findByPatient(patientId: string) {
  return db.execute(sql`SELECT * FROM appointments WHERE patient_id = ${patientId}`)
}
```

### Schema Rules

- Drizzle table definitions and Zod validators live in the same file.
- Zod schemas are derived from the Drizzle schema using `drizzle-zod` or defined manually — no duplication of field definitions.
- Use `z.object()` for request body schemas. Name them `create<Entity>Schema`, `update<Entity>Schema`.

### Zod v4 Rules

```ts
// Correct — Zod v4
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Error format changed in v4 — use .flatten() for field-level errors in the error middleware
```

### Error Handling

Use a shared `AppError` class:

```ts
// src/shared/types/index.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errors: string[] = []
  ) {
    super(message)
  }
}
```

The error middleware handles:
- `AppError` instances → use `statusCode` and `errors`
- Zod `ZodError` → 400 with field-level messages
- JWT errors → 401
- Everything else → 500

### Auth Middleware

Attach decoded JWT payload to `req.user`:

```ts
// src/shared/types/index.ts
export interface AuthUser {
  id: string
  email: string
  roles: string[]
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}
```

Role checks are middleware functions, not inline conditionals:

```ts
// Correct
router.patch('/:id/status', authenticate, requireRole('doctor'), handler)

// Wrong
router.patch('/:id/status', authenticate, async (req, res) => {
  if (!req.user?.roles.includes('doctor')) { ... }
})
```

### Response Envelope (required on every endpoint)

```ts
// Success
res.status(200).json({ success: true, message: 'OK', data: result })

// Error (handled by error middleware, not manually)
```

---

## Frontend Rules

### Feature Pattern (non-negotiable)

Every frontend feature lives under `src/features/<feature>/`:

```
api/          # Axios call functions (not hooks)
components/   # Feature-scoped components
hooks/        # useQuery / useMutation wrappers
types/        # TypeScript interfaces for this feature
patient/      # Patient-specific pages
doctor/       # Doctor-specific pages
```

### API Layer Rules

API functions return raw `data` from the response envelope. Hooks add query/mutation behavior.

```ts
// features/appointments/api/appointments.api.ts
import api from '@/shared/lib/api'
import type { Appointment, CreateAppointmentDto } from '../types'

export const createAppointment = async (dto: CreateAppointmentDto): Promise<Appointment> => {
  const { data } = await api.post('/appointments', dto)
  return data.data
}
```

```ts
// features/appointments/hooks/useAppointments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAppointment, getAppointments } from '../api/appointments.api'
import { QUERY_KEYS } from '@/shared/constants/queryKeys'

export const useAppointments = () => {
  return useQuery({
    queryKey: QUERY_KEYS.appointments.all(),
    queryFn: getAppointments,
  })
}
```

### Component Rules

- Feature components are not reused across features. If a component is needed by two features, it moves to `src/shared/components/`.
- No API calls inside components. Components call hooks.
- No raw `axios` inside components.

### State Management Rules

| Data type | Where it lives |
|---|---|
| Server data (appointments, doctors, etc.) | TanStack Query |
| Auth (user, token, login, logout) | `AuthContext` |
| Form state | local `useState` + React Hook Form |
| Modal/drawer open state | local `useState` |
| Nothing else | — |

No Zustand. No Redux. No context beyond `AuthContext` and `QueryContext` unless explicitly approved.

### Tailwind v4 Rules

```css
/* Correct — CSS-based config in index.css */
@import "tailwindcss";
@theme {
  --color-primary: #0ea5e9;
}

/* Wrong — no tailwind.config.js */
```

All custom tokens go in `@theme {}` in `index.css`. Reference them in components with standard Tailwind classes or CSS variables.

### Radix UI Import Rules

```ts
// Correct — unified package
import * as Dialog from 'radix-ui/react-dialog'

// Wrong — individual scoped packages
import * as Dialog from '@radix-ui/react-dialog'
```

### TypeScript Rules

- Strict mode is on. No `any`.
- All API response types must be defined in `features/<feature>/types/index.ts`.
- `unknown` is acceptable for caught errors; cast after narrowing.
- Avoid `as` casting except when interfacing with third-party untyped APIs.

### UI Rules (see 06-ui-ux-guidelines.md for full detail)

- Every list has an empty state.
- Every loading state uses `Skeleton`, not spinners (buttons are the exception).
- Every form field has a visible `<label>`.
- Every action has feedback: loading → success toast or error message.
- Never use `alert()` or `window.confirm()`.
- Status colors: pending=amber, confirmed=sky, completed=green, cancelled=red.

---

## Naming Conventions

### Backend

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `appointments.service.ts` |
| Classes | PascalCase | `AppointmentService` |
| Functions | camelCase | `createAppointment` |
| Variables | camelCase | `appointmentId` |
| DB columns | snake_case | `scheduled_at` |
| Drizzle table objects | camelCase | `appointments` |
| Zod schemas | camelCase + suffix | `createAppointmentSchema` |
| Routes | kebab-case | `/appointments/:id/blocked-slots` |

### Frontend

| Thing | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `AppointmentCard.tsx` |
| Files (hooks, api, utils) | camelCase | `useAppointments.ts` |
| Files (pages) | PascalCase | `AppointmentListPage.tsx` |
| Components | PascalCase | `AppointmentCard` |
| Hooks | camelCase + `use` prefix | `useAppointments` |
| Types/Interfaces | PascalCase | `Appointment`, `CreateAppointmentDto` |
| Query keys | SCREAMING_SNAKE or factory | `QUERY_KEYS.appointments.all()` |

---

## Git Rules

### Repositories

- `telehealth-backend` — Express API
- `telehealth-frontend` — React SPA
- Both repos are public on personal GitHub
- MIT License on both

### Branch Strategy (simplified for solo sprint)

Work directly on `main`. No feature branches required for this sprint.

### Commit Message Format

```
feat: add appointment booking endpoint
fix: correct JWT expiry handling
chore: add drizzle migration for notifications table
style: update appointment card status badge colors
```

Prefixes: `feat`, `fix`, `chore`, `style`, `refactor`, `docs`

### What to Never Commit

```gitignore
.env
dist/
node_modules/
*.local
```

---

## Environment Rules

### Backend `.env` (never committed)

```
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=
ANTHROPIC_API_KEY=
CLOUDINARY_URL=
CORS_ORIGIN=
PORT=3000
```

### Frontend `.env` (never committed)

```
VITE_API_URL=
VITE_PUSHER_KEY=
VITE_PUSHER_CLUSTER=
VITE_JITSI_DOMAIN=meet.jit.si
```

Always provide `.env.example` with keys but no values.

---

## What Is Off-Limits (no exceptions)

- No test suite
- No Docker
- No Redux / Zustand
- No GraphQL
- No raw WebSocket infrastructure
- No microservices
- No CQRS / event sourcing
- No payment systems
- No recurring schedule infrastructure
- No calendar sync
- No analytics pipelines
- Bonus features (until all core features are complete and verified)
