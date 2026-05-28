# A6 — Password Change

**Type:** FULL
**Status:** To Do
**Priority:** 8

---

## Purpose

Users currently have no way to change their password after registration. This adds a secure password-change flow — verifying the current password before updating — accessible from both the patient and doctor profile pages.

---

## Scope

**In scope:**
- Backend: `POST /api/users/:id/change-password` endpoint
- Backend: Verify current password (bcrypt compare), update `passwordHash` in `users` table
- Frontend: Two-field form (Current password + New password) in `PatientProfilePage.tsx` and the equivalent doctor profile page

**Out of scope:**
- Forgot-password / email reset flow (no email infra in scope)
- Password strength meter
- Force logout other sessions on password change (see A2 for that)
- Admin resetting another user's password

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/users/users.repository.ts` | Add `updatePasswordHash(userId: string, hash: string): Promise<void>` |
| `src/modules/users/users.service.ts` | Add `changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>` |
| `src/modules/users/users.controller.ts` | Add `POST /:id/change-password` route |
| `src/modules/users/users.schema.ts` | Add `changePasswordSchema` Zod validator |

### Schema Changes

- No migration needed (updating existing `passwordHash` column)

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/users/:id/change-password` | `authenticate` | Change password for authenticated user |

### Service / Repository Methods

- `usersRepository.updatePasswordHash(userId, hash)` — `db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId))`
- `usersService.changePassword(requesterId, userId, currentPassword, newPassword)`:
  1. Verify `requesterId === userId` — throw `AppError('Forbidden', 403)` if not (prevents changing another user's password)
  2. Fetch user by `userId` (throw 404 if not found)
  3. Verify `bcrypt.compare(currentPassword, user.passwordHash)` — throw `AppError('Current password is incorrect', 400)` if false
  4. Validate `newPassword !== currentPassword` — throw `AppError('New password must be different from current password', 400)` if equal
  5. Hash with `bcrypt.hash(newPassword, 10)`
  6. Call `updatePasswordHash`

### Zod Schema

```ts
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
```

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/users/patient/PatientProfilePage.tsx` | Add password change form section |
| `src/features/users/doctor/DoctorProfilePage.tsx` | Add password change form section |
| `src/features/users/api/users.api.ts` | Add `changePassword(userId, dto)` API function |
| `src/features/users/hooks/useUsers.ts` | Add `useChangePassword()` mutation hook |

### New Hooks / API Functions

- `changePassword(userId, { currentPassword, newPassword })` — `api.post(`/users/${userId}/change-password`, dto)`
- `useChangePassword()` — `useMutation`; on success toast "Password updated successfully", clear form fields

---

## Implementation Steps

1. (BE) Add `changePasswordSchema` to `users.schema.ts`.
2. (BE) Add `updatePasswordHash` to `users.repository.ts`.
3. (BE) Add `changePassword` to `users.service.ts` with bcrypt verify + hash + update.
4. (BE) Register `POST /:id/change-password` in `users.controller.ts` (authenticate, parse with `changePasswordSchema`, call `usersService.changePassword(req.user!.id, req.params.id, body.currentPassword, body.newPassword)`).
5. (FE) Add `changePassword` to `users.api.ts`.
6. (FE) Add `useChangePassword` hook to `useUsers.ts`.
7. (FE) In `PatientProfilePage.tsx`, add a "Change Password" section with `Current Password` and `New Password` inputs (type="password") and a Save button.
8. (FE) Wire the form to `useChangePassword`; show inline error on wrong current password; toast on success.
9. Repeat step 7–8 for `DoctorProfilePage.tsx`.

---

## Verification

1. Log in as a patient, go to profile → change password section visible.
2. Enter wrong current password → inline error "Current password is incorrect".
3. Enter correct current password + valid new password → success toast, form clears.
4. Log out and log back in with the new password — succeeds.
5. Log out and attempt login with the old password — fails with 401.
6. Attempt `POST /api/users/:id/change-password` with another user's JWT — the service should reject it (user ID in token ≠ param ID); throw 403.
