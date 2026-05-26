# Notifications Module

## 1. Purpose

Deliver real-time push notifications to patients and doctors when appointment-related events occur. Persist notification history for display in the notification bell UI. Uses Pusher (or Ably) for real-time delivery — no custom WebSocket infrastructure.

---

## 2. Required Features

- Create and persist a notification record
- Trigger real-time push via Pusher on creation
- Fetch notification list for current user
- Mark single notification as read
- Mark all notifications as read
- Unread count badge in header

---

## 3. Out-of-Scope Features

- Email notifications (Nodemailer / Resend — bonus)
- SMS notifications
- Push notifications (mobile — not in scope)
- Notification preferences / settings
- Notification deletion
- Notification categories / filtering
- Scheduled / reminder cron jobs (Pusher trigger from appointment creation is sufficient)
- Notification history pagination for MVP (load latest 50)

---

## 4. Backend Responsibilities

### Files

```
src/modules/notifications/
├── notifications.controller.ts
├── notifications.service.ts
├── notifications.repository.ts
└── notifications.schema.ts
```

### notifications.schema.ts

Drizzle table definition:

```ts
notifications: {
  id:         uuid PK
  user_id:    uuid FK → users
  type:       varchar(50)   -- see types below
  title:      varchar(200)
  message:    text
  data:       jsonb          -- { appointmentId?, doctorId?, patientId? }
  is_read:    boolean, default false
  created_at: timestamp
}
```

Notification types (enum-like strings):
- `appointment_booked` — sent to both patient and doctor on booking
- `appointment_confirmed` — sent to patient when doctor confirms
- `appointment_cancelled` — sent to the other party on cancellation
- `appointment_completed` — sent to patient when doctor marks complete
- `schedule_updated` — sent to affected patients when doctor updates availability (future — not triggered in MVP)

Zod validators (internal only, no public create endpoint):

```ts
// Used internally by other services — not exposed as an API endpoint
createNotificationInput: {
  userId:  z.string().uuid()
  type:    z.enum(['appointment_booked', 'appointment_confirmed', 'appointment_cancelled', 'appointment_completed'])
  title:   z.string().max(200)
  message: z.string()
  data:    z.record(z.string(), z.unknown()).optional()
}
```

### notifications.repository.ts

```ts
create(data: CreateNotificationData): Promise<Notification>

findByUser(userId: string, limit?: number): Promise<Notification[]>
  // ORDER BY created_at DESC, limit default 50

countUnread(userId: string): Promise<number>

markRead(notificationId: string, userId: string): Promise<void>
  // Verifies ownership before updating

markAllRead(userId: string): Promise<void>
```

### notifications.service.ts

```ts
createAndPush(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void>
  // 1. INSERT notification record via repository
  // 2. Trigger Pusher event on channel `private-user-{userId}`
  //    Event name: type (e.g., 'appointment_booked')
  //    Payload: { id, type, title, message, data, createdAt }
  // 3. No return value needed — fire and forget for caller

getNotifications(userId: string): Promise<Notification[]>
getUnreadCount(userId: string): Promise<number>
markRead(userId: string, notificationId: string): Promise<void>
markAllRead(userId: string): Promise<void>
```

**Pusher setup:**

```ts
// src/config/pusher.ts
import Pusher from 'pusher'

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})
```

Channel per user: `private-user-{userId}`

> Note: For MVP, use public channels (`user-{userId}`) to avoid needing Pusher auth endpoint. Switch to private channels if time permits.

### notifications.controller.ts

```
GET   /api/notifications         → getNotifications()    → 200
PATCH /api/notifications/:id/read → markRead()           → 200
PATCH /api/notifications/read-all → markAllRead()        → 200
```

**Route ordering:** Register `read-all` BEFORE `/:id/read` to avoid Express treating "read-all" as an ID param.

---

## 5. Frontend Responsibilities

### Files

```
src/features/notifications/
├── api/
│   └── notifications.api.ts
├── components/
│   ├── NotificationBell.tsx    # Badge + popover trigger
│   └── NotificationList.tsx    # Scrollable list with mark-read actions
├── hooks/
│   └── useNotifications.ts     # Pusher subscription + TanStack Query
└── types/
    └── index.ts
```

### useNotifications.ts

```ts
Responsibilities:
  1. useQuery: GET /api/notifications → persisted list + unread count
  2. Pusher subscription on mount:
     - Channel: `user-{userId}` (public channel for MVP)
     - Events: appointment_booked, appointment_confirmed, appointment_cancelled, appointment_completed
     - On event: queryClient.invalidateQueries(QUERY_KEYS.notifications.all())
  3. Expose: { notifications, unreadCount, markRead, markAllRead, isLoading }
  4. Cleanup Pusher subscription on unmount

Pusher client setup:
  import Pusher from 'pusher-js'
  const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
    cluster: import.meta.env.VITE_PUSHER_CLUSTER,
  })
```

### NotificationBell.tsx

```tsx
- Lucide Bell icon in header
- Red badge with unreadCount (hidden when 0)
- Click → Popover opens with NotificationList
- Badge: "99+" if count > 99
```

### NotificationList.tsx

```tsx
- Max height scrollable list (360px)
- Per notification row:
  - Icon by type (Calendar, CheckCircle, XCircle, etc.)
  - Title (font-medium if unread, text-muted if read)
  - Message (text-sm text-muted-foreground, truncated to 2 lines)
  - Time (relative: "2 min ago", "1 hour ago")
  - Unread indicator: left border accent (sky blue)
  - Click row → navigate to relevant appointment + mark as read
- Header row: "Notifications" title + "Mark all read" button
- Empty state: "No notifications yet"
- Loading skeleton: 3 rows
```

### Notification navigation mapping:

```ts
const notificationRoute = (n: Notification, role: string) => {
  const appointmentId = n.data?.appointmentId
  if (!appointmentId) return null
  return role === 'patient'
    ? `/patient/appointments/${appointmentId}`
    : `/doctor/appointments/${appointmentId}`
}
```

---

## 6. Database Tables

| Table | Role |
|---|---|
| `notifications` | Primary — full CRUD |
| `users` | Read — ownership check |

---

## 7. API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | JWT | Get latest 50 notifications for current user |
| PATCH | `/api/notifications/read-all` | JWT | Mark all as read |
| PATCH | `/api/notifications/:id/read` | JWT | Mark one as read |

No POST endpoint — notifications are created internally by other services only.

---

## 8. Validation Rules

```
PATCH /api/notifications/:id/read
  id: valid UUID (path param)
  Ownership: notification.user_id must equal req.user.id → 403 otherwise

PATCH /api/notifications/read-all
  No body required
  Scoped to req.user.id automatically
```

---

## 9. UI Screens

### Notification Bell (Header — all authenticated pages)

```
[Bell icon]
[Badge: unread count, hidden at 0]
  ↓ click
[Popover]
  [Header: "Notifications" | "Mark all read" button]
  [Scrollable list of NotificationRow components]
  [Empty state if none]
```

### Notification triggers (called by appointments.service, not exposed as UI):

| Event | Recipient | Title | Message |
|---|---|---|---|
| Appointment booked | Patient | "Appointment Booked" | "Your appointment with Dr. [name] on [date] is pending confirmation." |
| Appointment booked | Doctor | "New Appointment Request" | "[Patient name] has booked an appointment on [date]." |
| Appointment confirmed | Patient | "Appointment Confirmed" | "Dr. [name] confirmed your appointment on [date]." |
| Appointment cancelled (by patient) | Doctor | "Appointment Cancelled" | "[Patient name] cancelled their appointment on [date]." |
| Appointment cancelled (by doctor) | Patient | "Appointment Cancelled" | "Dr. [name] cancelled your appointment on [date]." |
| Appointment completed | Patient | "Consultation Complete" | "Your consultation with Dr. [name] is complete. View your notes and prescriptions." |

---

## 10. Dependencies

- Depends on: auth module (authenticate middleware), users module (userId from JWT)
- Required by: appointments module (calls `createAndPush` on all status transitions)
- External: Pusher npm package (backend: `pusher`, frontend: `pusher-js`)
- Env vars: `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` (backend); `VITE_PUSHER_KEY`, `VITE_PUSHER_CLUSTER` (frontend)

### Call sites in appointments.service.ts:

```ts
// On createAppointment:
notificationsService.createAndPush(patientUserId, 'appointment_booked', ...)
notificationsService.createAndPush(doctorUserId, 'appointment_booked', ...)

// On updateStatus → 'confirmed':
notificationsService.createAndPush(patientUserId, 'appointment_confirmed', ...)

// On updateStatus → 'completed':
notificationsService.createAndPush(patientUserId, 'appointment_completed', ...)

// On cancelAppointment:
notificationsService.createAndPush(otherPartyUserId, 'appointment_cancelled', ...)
```

---

## 11. Completion Criteria

- [ ] `notifications` table created and migrated
- [ ] `createAndPush` saves to DB and triggers Pusher event
- [ ] `GET /api/notifications` returns latest 50 for current user
- [ ] `PATCH /api/notifications/:id/read` marks single notification read (ownership enforced)
- [ ] `PATCH /api/notifications/read-all` marks all as read for current user
- [ ] Frontend Pusher subscription invalidates query cache on new event
- [ ] NotificationBell shows correct unread badge count
- [ ] NotificationList shows read/unread state visually
- [ ] Clicking notification navigates to correct appointment detail page
- [ ] Booking an appointment sends real-time notification to both parties
