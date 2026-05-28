# A2 — Session Management (Logout All Devices)

**Type:** FULL
**Status:** To Do
**Priority:** 10

> **Depends on A1 (Refresh Tokens) being fully implemented first.**

---

## Purpose

Once refresh tokens are in place (A1), users can have active sessions on multiple devices simultaneously. This feature adds a "Logout from all devices" action that revokes every refresh token for the user in one call — immediately invalidating all other active sessions.

---

## Scope

**In scope:**
- Backend: `POST /api/auth/logout-all` — marks all non-revoked refresh tokens for the current user as revoked
- Frontend: "Logout from all devices" button in `PatientProfilePage.tsx` and `DoctorProfilePage.tsx`

**Out of scope:**
- Showing a list of active sessions (devices, locations, last active)
- Revoking a specific device's session by ID
- Notifications sent to other sessions when they are revoked

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/auth/auth.repository.ts` | Add `revokeAllRefreshTokens(userId: string): Promise<void>` |
| `src/modules/auth/auth.service.ts` | Add `logoutAll(userId: string): Promise<void>` |
| `src/modules/auth/auth.controller.ts` | Add `POST /logout-all` route (authenticate, call service) |

### Schema Changes

- No migration needed (uses existing `refresh_tokens` table from A1)

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/logout-all` | `authenticate` | Revoke all refresh tokens for the current user |

### Service / Repository Methods

- `authRepository.revokeAllRefreshTokens(userId)`:
  ```ts
  db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
  ```
- `authService.logoutAll(userId)` — calls `revokeAllRefreshTokens(userId)`

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/users/patient/PatientProfilePage.tsx` | Add "Logout from all devices" button |
| `src/features/users/doctor/DoctorProfilePage.tsx` | Add "Logout from all devices" button |
| `src/features/auth/api/auth.api.ts` | Add `logoutAll()` API function |
| `src/features/auth/hooks/useAuth.ts` | Add `useLogoutAll()` mutation hook |

### New Hooks / API Functions

- `logoutAll()` — `api.post('/auth/logout-all')`
- `useLogoutAll()` — `useMutation`; on success: clear local tokens, navigate to `/login`, toast "Logged out from all devices"

---

## Implementation Steps

1. (BE) Add `revokeAllRefreshTokens(userId)` to `auth.repository.ts`.
2. (BE) Add `logoutAll(userId)` to `auth.service.ts`.
3. (BE) Register `POST /logout-all` in `auth.controller.ts` (authenticate, call `authService.logoutAll(req.user!.id)`).
4. (FE) Add `logoutAll()` to `auth.api.ts`.
5. (FE) Add `useLogoutAll()` hook.
6. (FE) Add a "Logout from all devices" button (with a confirm dialog or confirmation step) in both profile pages.
7. On confirm, call `logoutAll.mutate()`; on success clear local storage tokens and redirect to login.

---

## Verification

1. Log in on two browser tabs (simulating two devices) — both sessions active.
2. In one tab, go to profile and click "Logout from all devices" → confirm.
3. Current tab: navigated to login page.
4. Other tab: next authenticated request (e.g., navigate to any protected page) gets 401, interceptor tries to refresh but token is revoked — redirected to login.
5. Re-login on both tabs — both work normally.
