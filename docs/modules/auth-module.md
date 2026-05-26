# Auth Module

## 1. Purpose

Handle user registration, login, and identity resolution. Issue and verify JWTs. Assign roles at registration time.

---

## 2. Required Features

- Register a new user (patient or doctor)
- Login with email + password → receive JWT
- Get current user profile (`/me`) using a valid JWT
- Role assignment at registration (stored in `user_roles`)
- Profile scaffold creation at registration (`patients` or `doctors` row)
- Password hashing via bcryptjs

---

## 3. Out-of-Scope Features

- Password reset / forgot password
- Email verification
- Refresh tokens / token rotation
- Token blacklisting / revocation
- OAuth / social login
- Two-factor authentication
- Session management

---

## 4. Backend Responsibilities

### Files

```
src/modules/auth/
├── auth.controller.ts
├── auth.service.ts
├── auth.repository.ts
└── auth.schema.ts
```

### auth.schema.ts

Zod validators only (no Drizzle tables — auth operates on `users`, `user_roles`, `patients`, `doctors`):

```ts
registerSchema: {
  email: z.string().email().max(255)
  password: z.string().min(8)
  firstName: z.string().min(1).max(100)
  lastName: z.string().min(1).max(100)
  role: z.enum(['patient', 'doctor'])
}

loginSchema: {
  email: z.string().email()
  password: z.string().min(1)
}
```

### auth.repository.ts

```ts
findUserByEmail(email: string): Promise<User | null>
createUser(data: CreateUserData, tx): Promise<User>
assignRole(userId: string, roleId: string, tx): Promise<void>
getRoleByName(name: string): Promise<Role>
createPatientProfile(userId: string, tx): Promise<void>
createDoctorProfile(userId: string, data: { specialization?: string }, tx): Promise<void>
findUserWithRoles(userId: string): Promise<UserWithRoles | null>
```

### auth.service.ts

```ts
register(dto: RegisterDto): Promise<{ user: AuthUser; token: string }>
  // Transaction wraps: createUser + assignRole + createPatientProfile|createDoctorProfile
  // Throws 409 if email already exists
  // Returns JWT with { sub, email, roles }

login(dto: LoginDto): Promise<{ user: AuthUser; token: string }>
  // Throws 401 if email not found or password mismatch
  // Returns JWT

getMe(userId: string): Promise<AuthUser>
  // Returns user with roles attached
```

### auth.controller.ts

```
POST /api/auth/register   → auth.service.register()   → 201
POST /api/auth/login      → auth.service.login()       → 200
GET  /api/auth/me         → auth.service.getMe()       → 200 (requires authenticate middleware)
```

---

## 5. Frontend Responsibilities

### Files

```
src/features/auth/
├── api/
│   └── auth.api.ts          # login(), register(), getMe()
├── components/
│   ├── LoginForm.tsx
│   └── RegisterForm.tsx
├── hooks/
│   └── useAuth.ts           # reads from AuthContext
├── pages/
│   ├── LoginPage.tsx
│   └── RegisterPage.tsx
└── types/
    └── index.ts             # LoginDto, RegisterDto, AuthUser
```

### AuthProvider (`src/app/providers/AuthProvider.tsx`)

```ts
interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  login(dto: LoginDto): Promise<void>
  register(dto: RegisterDto): Promise<void>
  logout(): void
  isLoading: boolean
}
```

- Stores token in `localStorage`
- On mount: reads token → calls `getMe()` → sets user
- On login/register: stores token, sets user, redirects by role
- On logout: clears token + user, redirects to `/login`

### RegisterForm.tsx

Fields:
- First Name, Last Name
- Email
- Password
- Role selector: Patient / Doctor (radio or tab toggle)
- If Doctor: Specialization field (text input, required)

### LoginForm.tsx

Fields:
- Email
- Password
- Submit → redirect to role-based dashboard

---

## 6. Database Tables Used

- `users` — created on register
- `roles` — queried by name to get role ID
- `user_roles` — insert on register
- `patients` — scaffold row inserted on patient register
- `doctors` — scaffold row inserted on doctor register

---

## 7. API Endpoints

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | None | `registerSchema` | `{ user, token }` |
| POST | `/api/auth/login` | None | `loginSchema` | `{ user, token }` |
| GET | `/api/auth/me` | JWT required | — | `AuthUser` |

---

## 8. Validation Rules

```
email:     required, valid format, max 255 chars
password:  required, min 8 chars
firstName: required, min 1, max 100
lastName:  required, min 1, max 100
role:      required, enum ['patient', 'doctor']
```

Login:
```
email:     required, valid format
password:  required, non-empty
```

---

## 9. UI Screens

### `/login` — LoginPage
- AuthLayout (centered card)
- App logo + "Welcome back" heading
- Email + password fields
- "Sign in" button with loading state
- Link: "Don't have an account? Register"
- Error: show server error below form

### `/register` — RegisterPage
- AuthLayout
- App logo + "Create your account" heading
- Role selector (Patient / Doctor) — shown first, affects form below
- First name + Last name (side by side)
- Email
- Password
- If Doctor: Specialization input
- "Create account" button with loading state
- Link: "Already have an account? Sign in"

---

## 10. Dependencies

- Depends on: nothing (foundation module)
- Required by: all other modules (auth middleware used everywhere)

Transaction dependency:
- `users`, `user_roles`, `patients`, `doctors` tables must exist before register works
- Seed data (`roles` table) must exist before register works

---

## 11. Completion Criteria

- [ ] `POST /api/auth/register` creates user + role + profile scaffold in a single transaction
- [ ] Duplicate email returns 409
- [ ] `POST /api/auth/login` returns JWT for valid credentials
- [ ] Invalid credentials return 401
- [ ] `GET /api/auth/me` returns user with roles array
- [ ] Frontend login form submits and redirects to `/patient/dashboard` or `/doctor/dashboard`
- [ ] Frontend register form submits and redirects correctly by role
- [ ] Token persisted in localStorage and sent on all subsequent API requests
- [ ] `ProtectedRoute` redirects unauthenticated users to `/login`
- [ ] `RoleGuard` redirects wrong-role users to their correct dashboard
