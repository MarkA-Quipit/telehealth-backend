# C1 — In-Consultation Text Chat

**Type:** FULL
**Status:** To Do
**Priority:** 12

---

## Purpose

During a live video consultation, both the patient and doctor need a text-chat fallback — for sharing links, spelling out medication names, or continuing if video fails. A Pusher channel per appointment delivers messages in real time. Messages are optionally persisted in a `chat_messages` table for post-session review.

---

## Scope

**In scope:**
- Backend: New Pusher channel `consultation-{appointmentId}` per active consultation
- Backend: `POST /api/appointments/:id/chat` — sends a message; triggers Pusher event on the channel
- Backend (optional but recommended): `chat_messages` table to persist messages; `GET /api/appointments/:id/chat` to load history on join
- Frontend: Chat panel overlay inside both `ConsultationPage.tsx` files (patient + doctor). Input at bottom, message scroll above the Jitsi embed.

**Out of scope:**
- File/image sharing in chat
- Message editing or deletion
- Read receipts
- Chat outside of active consultation (before/after)

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/appointments/appointments.schema.ts` | Add `chatMessages` Drizzle table (if persisting) |
| `src/modules/appointments/appointments.repository.ts` | Add `saveChatMessage` and `getChatMessages` |
| `src/modules/appointments/appointments.service.ts` | Add `sendChatMessage(appointmentId, userId, message)` |
| `src/modules/appointments/appointments.controller.ts` | Add `POST /:id/chat` and `GET /:id/chat` routes |
| `src/db/migrations/` | New migration for `chat_messages` table (if persisting) |

### Schema Changes

New table `chat_messages` (optional but recommended):

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `defaultRandom()` |
| `appointment_id` | uuid FK → appointments | cascade delete |
| `sender_id` | uuid FK → users | |
| `message` | text | |
| `sent_at` | timestamp | `defaultNow()` |

Migration required: yes (if persisting).

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/appointments/:id/chat` | `authenticate` | Send a chat message; triggers Pusher event |
| GET | `/api/appointments/:id/chat` | `authenticate` | Load chat history for the consultation |

### Service / Repository Methods

- `appointmentsRepository.saveChatMessage(appointmentId, senderId, message)` — insert into `chat_messages`
- `appointmentsRepository.getChatMessages(appointmentId)` — select all for appointment ordered by `sentAt`
- `appointmentsService.sendChatMessage(appointmentId, userId, message)`:
  1. Verify appointment exists and caller is patient or doctor on it
  2. Optionally save to DB
  3. `pusher.trigger(`consultation-${appointmentId}`, 'new_message', { senderId: userId, message, sentAt: new Date() })`

**Pusher channel:** public channel `consultation-{appointmentId}` (matches existing pattern)

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/consultations/patient/ConsultationPage.tsx` | Add chat panel overlay |
| `src/features/consultations/doctor/ConsultationPage.tsx` | Add chat panel overlay |
| `src/features/consultations/api/consultations.api.ts` | Add `sendChatMessage(id, message)` and `getChatHistory(id)` |
| `src/features/consultations/hooks/useConsultations.ts` | Add `useChatHistory(id)` query and `useSendChatMessage()` mutation |

### Chat Panel UI

- Fixed panel on the right side (or collapsible overlay) of the consultation page
- On mount: subscribe to `consultation-{appointmentId}` Pusher channel; load history via `GET /api/appointments/:id/chat`
- Message list: scrollable, newest at bottom; sender name + message + timestamp
- Input: text input at bottom; "Send" button or Enter key
- Distinguish own messages (right-aligned) from the other party's (left-aligned)

### New Hooks / API Functions

- `sendChatMessage(id, message)` — `api.post(`/appointments/${id}/chat`, { message })`
- `getChatHistory(id)` — `api.get(`/appointments/${id}/chat`)`
- `useChatHistory(id)` — `useQuery`
- `useSendChatMessage()` — `useMutation`; on success append message locally (optimistic) or refetch

**Pusher subscription:**
```ts
useEffect(() => {
  const channel = pusher.subscribe(`consultation-${appointmentId}`)
  channel.bind('new_message', (data) => {
    setMessages((prev) => [...prev, data])
  })
  return () => pusher.unsubscribe(`consultation-${appointmentId}`)
}, [appointmentId])
```

---

## Implementation Steps

1. (BE) Add `chat_messages` table to `appointments.schema.ts` and generate + run migration.
2. (BE) Add `saveChatMessage` and `getChatMessages` to `appointments.repository.ts`.
3. (BE) Add `sendChatMessage` to `appointments.service.ts` with ownership check and Pusher trigger.
4. (BE) Register `POST /:id/chat` and `GET /:id/chat` in `appointments.controller.ts`.
5. (FE) Add `sendChatMessage` and `getChatHistory` to `consultations.api.ts`.
6. (FE) Add `useChatHistory` and `useSendChatMessage` hooks.
7. (FE) Build the chat panel component (can be a new file `ChatPanel.tsx` in `consultations/components/`).
8. (FE) Integrate `ChatPanel` into both `ConsultationPage.tsx` files.

---

## Verification

1. Join a consultation as a patient (one tab) and as a doctor (another tab).
2. Patient types and sends a message — it appears in both tabs instantly via Pusher.
3. Doctor replies — message appears in both tabs.
4. Refresh the patient's tab — chat history loads from the backend.
5. Messages show correct sender labels ("You" vs. doctor/patient name).
