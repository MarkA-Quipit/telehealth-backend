# N1 — Notification Deletion

**Type:** FULL
**Status:** To Do
**Priority:** 6

---

## Purpose

Users currently have no way to remove individual notifications from their list. Adding a delete (×) button per row — backed by a proper `DELETE` endpoint — lets users keep their notification inbox clean.

---

## Scope

**In scope:**
- Backend: `DELETE /api/notifications/:id` endpoint (owner-only)
- Backend: `deleteById` method in `notifications.repository.ts` and `notifications.service.ts`
- Frontend: × (delete) icon button on each row in `NotificationList.tsx`
- Frontend: `useMutation` call that fires the DELETE and invalidates the notifications query

**Out of scope:**
- Bulk delete / "clear all"
- Soft delete (hard delete is fine)
- Admin ability to delete any user's notification

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/notifications/notifications.repository.ts` | Add `deleteById(id: string): Promise<void>` |
| `src/modules/notifications/notifications.service.ts` | Add `deleteNotification(userId: string, id: string): Promise<void>` — validates ownership, calls repo |
| `src/modules/notifications/notifications.controller.ts` | Add `DELETE /:id` route (authenticate, call service, return 200) |

### Schema Changes

- No migration needed (deleting rows, no schema change)

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| DELETE | `/api/notifications/:id` | `authenticate` | Delete a single notification owned by the requester |

### Service / Repository Methods

- `notificationsRepository.deleteById(id)` — `db.delete(notifications).where(eq(notifications.id, id))`
- `notificationsService.deleteNotification(userId, id)` — fetch notification, verify `notification.userId === userId` (throw 403 if not), call `deleteById`

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/notifications/components/NotificationList.tsx` | Add × button to each row; wire to delete mutation |
| `src/features/notifications/api/notifications.api.ts` | Add `deleteNotification(id: string): Promise<void>` |
| `src/features/notifications/hooks/useNotifications.ts` | Add `useDeleteNotification()` mutation hook |

### New Hooks / API Functions

- `deleteNotification(id)` — `api.delete(`/notifications/${id}`)`
- `useDeleteNotification()` — `useMutation` calling `deleteNotification`; on success invalidates `QUERY_KEYS.notifications`

---

## Implementation Steps

1. (BE) Add `deleteById(id)` to `notifications.repository.ts`.
2. (BE) Add `deleteNotification(userId, id)` to `notifications.service.ts` with ownership check.
3. (BE) Register `DELETE /:id` in `notifications.controller.ts` — place it after the existing `read-all` and `/:id/read` routes to avoid conflicts.
4. (FE) Add `deleteNotification(id)` to `notifications.api.ts`.
5. (FE) Add `useDeleteNotification()` hook to `useNotifications.ts`.
6. (FE) In `NotificationList.tsx`, add an `×` icon button (e.g., `X` from Lucide) on each notification row.
7. (FE) On click, call `deleteNotification.mutate(notification.id)`; show a loading state on the button while pending.

---

## Verification

1. Open the notification bell — notifications list visible.
2. Click × on a notification — it disappears from the list immediately (optimistic update or refetch).
3. Reload the page — the deleted notification is gone.
4. Attempt to `DELETE /api/notifications/:id` with a token belonging to a different user — receive 403.
