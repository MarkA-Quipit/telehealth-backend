# Telehealth Backend — Claude Code Rules

## Planning Docs (read before implementing anything)

All architecture, module contracts, API shapes, and database design are defined in the `docs/` folder at the root of this repo.

- `docs/`         — project-wide rules: stack, architecture, DB design, API conventions, build order
- `docs/modules/` — per-module contracts: exact files to create, function signatures, endpoints, Zod schemas, validation rules, completion criteria

### Rules
- Before implementing any module, read the relevant doc in `docs/modules/` first
- Before writing any shared middleware, type, or config, read `docs/01-architecture.md` and `docs/07-development-rules.md`
- Do not invent file structures, function signatures, or endpoint paths — they are all defined in the docs
- Do not add scope beyond what the module doc specifies
- If something is missing from the docs, ask — do not assume
- If a doc and a verbal instruction conflict, flag it before proceeding

### Doc Map
| Doc | When to read |
|---|---|
| `docs/00-project-overview.md` | Scope boundaries, what is and isn't in MVP |
| `docs/01-architecture.md` | System structure, module pattern, request flow |
| `docs/02-tech-stack.md` | Exact versions, critical version notes for Express v5 + Zod v4 |
| `docs/03-database-design.md` | All table definitions, indexes, seed data |
| `docs/04-api-conventions.md` | Response envelope, status codes, all endpoint paths |
| `docs/07-development-rules.md` | Coding conventions, naming, error handling rules |
| `docs/08-build-order.md` | What to build in what order, scope cut priority |
| `docs/modules/auth-module.md` | Auth — register, login, JWT, transactions |
| `docs/modules/patients-module.md` | Patient profile, medical fields |
| `docs/modules/doctors-module.md` | Doctor profile, availability, blocked slots, slot algorithm |
| `docs/modules/appointments-module.md` | Booking, conflict detection, status transitions, notifications |
| `docs/modules/users-roles-module.md` | User profile, avatar upload, RBAC seed data |
| `docs/modules/notifications-module.md` | Pusher setup, createAndPush, route ordering gotcha |
| `docs/modules/consultations-module.md` | No backend module — reuses appointments endpoints |
| `docs/modules/ai-module.md` | Gemini API setup, prompt template, fallback parser, patient-only |

---

## Stack
- Node.js 20+ LTS
- Express v5.2.1 — async errors propagate automatically, NO try/catch in route handlers
- TypeScript v6.0.3 strict mode
- Drizzle ORM v0.45.2 + drizzle-kit v0.31.10
- @neondatabase/serverless v1.1.0 (Neon PostgreSQL 17)
- jsonwebtoken v9.0.3 + bcryptjs v3.0.3
- Zod v4.4.3 — NOT v3, import paths and error format differ
- helmet v8.2.0, cors v2.8.6, dotenv v17.4.2
- tsx v4.22.3 (dev watch mode)
- CommonJS module system ("type": "commonjs")

---

## Module Pattern (non-negotiable)

Every module lives under `src/modules/<module>/` with exactly four files:

```
<module>.controller.ts   — route handlers only, no business logic
<module>.service.ts      — business logic and orchestration
<module>.repository.ts   — Drizzle ORM queries only
<module>.schema.ts       — Drizzle table definitions + Zod validators
```

No fifth file per module without flagging it first.

---

## Critical Version Rules

### Express v5 — no try/catch in route handlers
```ts
// CORRECT
router.post('/', async (req, res) => {
  const data = await someService()
  res.status(201).json({ success: true, message: 'Created', data })
})

// WRONG — Express v4 pattern, do not use
router.post('/', async (req, res, next) => {
  try {
    const data = await someService()
    res.json(data)
  } catch (err) {
    next(err)
  }
})
```

### Zod v4 — same import, different error format
```ts
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Error format changed in v4 — use .flatten() in the error middleware
```

### Drizzle ORM — no raw SQL
```ts
// CORRECT
return db.select().from(appointments).where(eq(appointments.patientId, patientId))

// WRONG
return db.execute(sql`SELECT * FROM appointments WHERE patient_id = ${patientId}`)
```

---

## Response Envelope (required on every endpoint)

```ts
// Success
res.status(200).json({ success: true, message: 'OK', data: result })
res.status(201).json({ success: true, message: 'Created', data: result })

// Error — handled by error middleware, never manually
```

HTTP status codes:
- 200 — GET, PUT/PATCH, DELETE success
- 201 — POST success (resource created)
- 400 — validation error
- 401 — missing or invalid JWT
- 403 — valid JWT, wrong role
- 404 — resource not found
- 409 — conflict (duplicate email, double booking)
- 500 — unhandled error

---

## Controller Rules
- No business logic — parse request, call one service method, return response
- No try/catch — Express v5 propagates async errors automatically
- Validate with Zod before calling the service
- Always use the response envelope

```ts
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const body = createAppointmentSchema.parse(req.body)
  const result = await appointmentService.create(req.user!.id, body)
  res.status(201).json({ success: true, message: 'Appointment created', data: result })
})
```

## Service Rules
- All business logic lives here
- Call repositories, external APIs (Pusher, Anthropic, Cloudinary), other services
- Throw errors via `AppError` — never call `res` inside a service
- One service per module

## Repository Rules
- Drizzle ORM queries only — no business logic
- All DB access goes through the repository — controllers and services never import `db` directly
- Return raw data; services handle transformation

## Schema Rules
- Drizzle table definitions and Zod validators in the same file
- Name Zod schemas: `create<Entity>Schema`, `update<Entity>Schema`
- Use `z.object()` for all request body schemas

---

## Auth Middleware

```ts
// Role checks via middleware, not inline conditionals
router.patch('/:id/status', authenticate, requireRole('doctor'), handler)

// AuthUser shape attached to req.user
interface AuthUser {
  id: string
  email: string
  roles: string[]
}
```

---

## Error Handling

```ts
// Shared AppError class
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

Error middleware handles:
- `AppError` → uses `statusCode` and `errors`
- `ZodError` → 400 with field-level messages via `.flatten()`
- JWT errors → 401
- Everything else → 500

---

## Naming Conventions

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

---

## Transactions — exactly 3 cases

1. **User registration** — INSERT users + user_roles + patients/doctors profile
2. **Appointment booking** — INSERT appointments + notifications (patient + doctor)
3. **Consultation notes + status** — INSERT consultation_notes + UPDATE appointments status

No other cases require transactions in this MVP.

---

## Module-Specific Critical Notes

### Notifications — route ordering (critical)
Register `read-all` BEFORE `/:id/read` or Express will treat "read-all" as an ID param:
```ts
// CORRECT order
router.patch('/read-all', authenticate, markAllReadHandler)
router.patch('/:id/read', authenticate, markReadHandler)
```

Pusher channel naming: use **public** channels for MVP (`user-{userId}`), not private.
Private channels require a Pusher auth endpoint — skip for now.

```ts
// Backend trigger
pusher.trigger(`user-${userId}`, eventType, payload)

// Frontend subscribe
const channel = pusher.subscribe(`user-${userId}`)
```

### AI Module — no repository file
`src/modules/ai/` has only three files (no `ai.repository.ts`):
```
ai.controller.ts
ai.service.ts
ai.schema.ts
```
The AI service calls `doctorsRepository.findAll()` directly — no circular dependency issue since doctors module is a dependency, not a dependent.

Gemini client lives at `src/config/gemini.ts`, not inside the module.
Always include the JSON fallback parser — never let a malformed Gemini response cause a 500.

### Consultations — no backend module
No `src/modules/consultations/` exists. The consultations feature is frontend-only.
Backend only needs `GET /api/appointments/:id` (already in appointments module) for status verification.

---

## What Is Off-Limits
- No test suite
- No Docker
- No raw SQL (use Drizzle query builder)
- No try/catch in route handlers
- No business logic in controllers or repositories
- No cross-module repository imports (services may call other services)
- No bonus features until all core modules are complete

---

## Rules
- IMPLEMENT ONLY what is asked
- No new dependencies without being asked
- Strict TypeScript — no `any`
- Ask ONE clarifying question if requirements are unclear