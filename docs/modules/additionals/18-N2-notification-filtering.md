# N2 — Notification Filtering by Type

**Type:** FULL
**Status:** To Do
**Priority:** 18

---

## Purpose

As notification history grows, users need to quickly find relevant items (e.g., only cancellations). Adding a `?type=` query param to `GET /api/notifications` and filter tabs in the `NotificationList` UI lets users drill down to the notification type they care about.

---

## Scope

**In scope:**
- Backend: Add optional `?type=appointment_booked|appointment_confirmed|appointment_cancelled|appointment_completed` query param to `GET /api/notifications`
- Backend: Add WHERE clause in `notifications.repository.ts` when `type` is provided
- Frontend: Filter tabs (All / Bookings / Confirmations / Cancellations / Completions) or a dropdown in `NotificationList.tsx`

**Out of scope:**
- Multi-type filtering (one type at a time is sufficient)
- Saving the selected filter preference
- Backend search by notification content/text

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/notifications/notifications.repository.ts` | Add optional `type` param to `findAllForUser(userId, type?)` — add WHERE clause when provided |
| `src/modules/notifications/notifications.service.ts` | Pass `type` from controller to repository |
| `src/modules/notifications/notifications.controller.ts` | Extract `?type` query param; validate against allowed values; pass to service |

### Schema Changes

- No migration needed (the `type` column already exists on `notifications`)

### Repository Change

```ts
findAllForUser(userId: string, type?: string) {
  return db.select().from(notifications)
    .where(
      type
        ? and(eq(notifications.userId, userId), eq(notifications.type, type))
        : eq(notifications.userId, userId)
    )
    .orderBy(desc(notifications.createdAt))
}
```

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/notifications/components/NotificationList.tsx` | Add filter tabs or dropdown; pass selected type to the query |
| `src/features/notifications/api/notifications.api.ts` | Add optional `type` param to `getNotifications(type?)` |
| `src/features/notifications/hooks/useNotifications.ts` | Add `type` param to `useNotifications(type?)` query |

### New Hooks / API Functions

- `getNotifications(type?)` — `api.get('/notifications', { params: type ? { type } : {} })`
- `useNotifications(type?)` — `useQuery` with `queryKey: [QUERY_KEYS.notifications, type]`

**Filter UI:**

```tsx
const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Bookings', value: 'appointment_booked' },
  { label: 'Confirmations', value: 'appointment_confirmed' },
  { label: 'Cancellations', value: 'appointment_cancelled' },
  { label: 'Completions', value: 'appointment_completed' },
] as const
```

Render as horizontal tabs or a `<select>` dropdown above the notification list. On change, update the `type` state — the query refetches automatically.

---

## Implementation Steps

1. (BE) Update `notifications.repository.ts` `findAllForUser` to accept optional `type` and add WHERE clause.
2. (BE) Pass `type` from service to repository.
3. (BE) In the controller, parse `req.query.type` and validate it against the allowed enum values (throw 400 for invalid types).
4. (FE) Update `getNotifications` API function to accept and pass `type` query param.
5. (FE) Update `useNotifications` hook to accept `type` and include it in the query key.
6. (FE) Add filter tabs/dropdown to `NotificationList.tsx`; wire to `type` state passed to the hook.

---

## Verification

1. Open notification list — "All" tab selected by default; all notifications shown.
2. Click "Bookings" tab — only `appointment_booked` notifications appear.
3. Click "Cancellations" tab — only `appointment_cancelled` notifications appear.
4. `GET /api/notifications?type=appointment_booked` returns only that type.
5. `GET /api/notifications?type=invalid_type` returns 400 with a clear error.
6. `GET /api/notifications` (no param) returns all notifications as before.
