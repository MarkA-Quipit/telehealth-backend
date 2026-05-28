# A1 — Refresh Tokens

**Type:** FULL
**Status:** To Do
**Priority:** 9

---

## Purpose

The current auth system issues a single long-lived JWT (no expiry or 7-day expiry). This is a security risk: a stolen token stays valid indefinitely. Refresh tokens shorten the access token lifetime to 15 minutes while keeping the user session alive via a 7-day refresh token stored (hashed) in the database. The frontend transparently retries failed requests using the refresh endpoint.

---

## Scope

**In scope:**
- New `refresh_tokens` DB table and Drizzle migration
- Login now returns both an access token (15 min) and a refresh token (7 days)
- `POST /api/auth/refresh` — exchanges a valid refresh token for a new access token
- `POST /api/auth/logout` — revokes the refresh token on logout
- Frontend: Axios response interceptor retries original request once after a successful token refresh

**Out of scope:**
- Refresh token rotation (issuing a new refresh token on each refresh — add in a future hardening pass)
- Device tracking (user-agent / IP storage)
- A2 (logout all devices) — that depends on this feature but is a separate task

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/auth/auth.schema.ts` | Add `refreshTokens` Drizzle table definition + `refreshTokenSchema` Zod type |
| `src/modules/auth/auth.repository.ts` | Add `storeRefreshToken`, `findRefreshToken`, `revokeRefreshToken` |
| `src/modules/auth/auth.service.ts` | Update `login` to issue short access token + refresh token; add `refreshToken` and `logout` methods |
| `src/modules/auth/auth.controller.ts` | Add `POST /refresh` and `POST /logout` routes |
| `src/db/migrations/` | New migration file for `refresh_tokens` table |

### Schema Changes

New table `refresh_tokens`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `defaultRandom()` |
| `user_id` | uuid FK → users | cascade delete |
| `token_hash` | varchar(255) | bcrypt hash of the token |
| `expires_at` | timestamp | 7 days from creation |
| `revoked_at` | timestamp | null if active |
| `created_at` | timestamp | `defaultNow()` |

Migration required: yes.

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/refresh` | none (uses refresh token in body) | Exchange refresh token for new access token |
| POST | `/api/auth/logout` | `authenticate` | Revoke current refresh token |

### Service / Repository Methods

- `authRepository.storeRefreshToken(userId, tokenHash, expiresAt)` — insert into `refresh_tokens`
- `authRepository.findRefreshToken(tokenHash)` — find active, non-expired, non-revoked token
- `authRepository.revokeRefreshToken(id)` — set `revokedAt = now()`
- `authService.login(email, password)`:
  1. Existing validation (unchanged)
  2. Sign access token with `expiresIn: '15m'`
  3. Generate random refresh token (`crypto.randomUUID()` or `crypto.randomBytes(32).toString('hex')`)
  4. Hash the refresh token with `bcrypt.hash`
  5. Store hash in DB; return `{ accessToken, refreshToken }` to client
- `authService.refresh(rawRefreshToken)`:
  1. Hash the incoming token
  2. Look up in DB — throw 401 if not found, revoked, or expired
  3. Sign and return a new access token (15 min)
- `authService.logout(userId, rawRefreshToken)`:
  1. Hash token, find in DB
  2. Call `revokeRefreshToken`

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/shared/lib/api.ts` | Add Axios response interceptor: on 401, call `POST /api/auth/refresh`, retry original request once |
| `src/features/auth/store/authStore.ts` (or equivalent) | Store `refreshToken` alongside `accessToken` in localStorage |
| `src/features/auth/api/auth.api.ts` | Add `refreshToken(token: string)` API function |

### New Hooks / API Functions

- `refreshToken(token)` — `api.post('/auth/refresh', { refreshToken: token })` — returns `{ accessToken }`

**Interceptor logic in `api.ts`:**

```ts
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true
      const stored = localStorage.getItem('refreshToken')
      if (stored) {
        const { data } = await api.post('/auth/refresh', { refreshToken: stored })
        localStorage.setItem('token', data.data.accessToken)
        error.config.headers.Authorization = `Bearer ${data.data.accessToken}`
        return api(error.config)
      }
    }
    return Promise.reject(error)
  }
)
```

---

## Implementation Steps

1. (BE) Add `refreshTokens` Drizzle table to `auth.schema.ts` and run `drizzle-kit generate` + `drizzle-kit migrate`.
2. (BE) Add `storeRefreshToken`, `findRefreshToken`, `revokeRefreshToken` to `auth.repository.ts`.
3. (BE) Update `authService.login` to issue 15-min access token + 7-day refresh token; store hash in DB; return both.
4. (BE) Add `authService.refresh(rawToken)` and `authService.logout(userId, rawToken)`.
5. (BE) Register `POST /refresh` and `POST /logout` routes in `auth.controller.ts`.
6. (FE) Update login success handler to store `refreshToken` in localStorage.
7. (FE) Add `refreshToken` API function to `auth.api.ts`.
8. (FE) Add the 401 interceptor to `api.ts`.

---

## Verification

1. Log in — response includes both `accessToken` and `refreshToken`.
2. Wait for access token to expire (or manually set `expiresIn: '5s'` in dev). Make an authenticated request — interceptor fires, gets new access token, retries, succeeds.
3. Call `POST /api/auth/refresh` with an invalid token — receive 401.
4. Call `POST /api/auth/logout` — refresh token is revoked. Subsequent `POST /api/auth/refresh` with the same token returns 401.
