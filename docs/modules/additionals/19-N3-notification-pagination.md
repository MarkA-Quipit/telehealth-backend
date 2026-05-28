# N3 — Notification Pagination

**Type:** FULL
**Status:** To Do
**Priority:** 19

---

## Purpose

The notifications endpoint currently loads the latest 50 items. As users accumulate history, older notifications are silently dropped. Adding `?page=&limit=` and a "Load more" button lets users page through their full notification history without overwhelming the initial load.

---

## Scope

**In scope:**
- Backend: Add `?page=` and `?limit=` query params to `GET /api/notifications`; use `.limit().offset()` in the repository
- Backend: Return `total` count alongside items so the frontend knows when to hide the "Load more" button
- Frontend: "Load more" button at the bottom of `NotificationList.tsx` that appends the next page

**Out of scope:**
- Previous/next page buttons (append-only "load more" pattern)
- Infinite scroll (explicit button click is sufficient)
- Changing the page size from the UI

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/notifications/notifications.repository.ts` | Add `page` and `limit` params; return `{ items, total }` |
| `src/modules/notifications/notifications.service.ts` | Pass pagination params; return `{ items, total }` |
| `src/modules/notifications/notifications.controller.ts` | Parse and validate `?page` and `?limit` query params |

### Schema Changes

- No migration needed

### Repository Change

> **N2 integration:** N2 updated `findAllForUser` to accept an optional `type` param. This task extends that same signature — do NOT write a new overload. The final merged signature must handle both the `type` filter (from N2) and pagination (from N3) together.

```ts
async findAllForUser(userId: string, type?: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit
  const conditions = type
    ? and(eq(notifications.userId, userId), eq(notifications.type, type))
    : eq(notifications.userId, userId)

  const [items, [{ count }]] = await Promise.all([
    db.select().from(notifications)
      .where(conditions)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(notifications)
      .where(conditions)
  ])
  return { items, total: Number(count) }
}
```

### Response Envelope Update

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "items": [...],
    "total": 47,
    "page": 1,
    "limit": 20
  }
}
```

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/notifications/components/NotificationList.tsx` | Add "Load more" button; accumulate pages locally |
| `src/features/notifications/api/notifications.api.ts` | Add `page` and `limit` params to `getNotifications` |
| `src/features/notifications/hooks/useNotifications.ts` | Switch from `useQuery` to `useInfiniteQuery` or manage page state manually |

### Pagination Strategy

Use simple page-state management (not `useInfiniteQuery`) to keep it straightforward:

```tsx
const [page, setPage] = useState(1)
const [allItems, setAllItems] = useState<Notification[]>([])
const { data } = useNotifications({ page, type })

useEffect(() => {
  if (data?.items) setAllItems((prev) => page === 1 ? data.items : [...prev, ...data.items])
}, [data])

const hasMore = allItems.length < (data?.total ?? 0)
```

Show "Load more" button only when `hasMore` is true. On click: `setPage(p => p + 1)`.

Reset `page` to 1 and `allItems` to `[]` whenever the `type` filter changes.

---

## Implementation Steps

1. (BE) Update `notifications.repository.ts` to accept `page` and `limit`, apply `.limit().offset()`, and also return the total count.
2. (BE) Update `notifications.service.ts` to pass pagination params and forward `{ items, total }`.
3. (BE) In the controller, parse `?page` (default 1) and `?limit` (default 20, max 50) from `req.query`; pass to service.
4. (FE) Update `getNotifications` API function to accept `page` and `limit`.
5. (FE) Update `useNotifications` hook signature and query key to include `page`.
6. (FE) In `NotificationList.tsx`, accumulate pages into `allItems` state and render a "Load more" button when `hasMore`.
7. Reset page state when the type filter changes (N2 integration point).

---

## Verification

1. Seed the test user with 25+ notifications.
2. Open notification list — first 20 shown; "Load more" button visible.
3. Click "Load more" — next batch appends below without clearing existing items.
4. After all notifications are loaded — "Load more" button disappears.
5. Switch filter tabs — list resets to page 1, only filtered items shown.
6. `GET /api/notifications?page=2&limit=10` returns items 11–20 and correct `total`.
