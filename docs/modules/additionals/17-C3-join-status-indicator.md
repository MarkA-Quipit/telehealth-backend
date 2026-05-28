# C3 — Doctor/Patient Join Status Indicator

**Type:** FULL
**Status:** To Do
**Priority:** 17

---

## Purpose

Neither the patient nor the doctor currently knows whether the other party has joined the consultation room. Adding join timestamps and a Pusher event enables a "Waiting for Dr. Smith…" or "Patient is in the room" indicator that updates in real time — reducing anxiety and accidental no-shows.

---

## Scope

**In scope:**
- Backend: Add `patientJoinedAt` and `doctorJoinedAt` timestamp columns to `appointments`
- Backend: New Drizzle migration
- Backend: `PATCH /api/appointments/:id/join` — sets the appropriate field based on requester role; triggers Pusher event `user_joined` on `appointment-{id}` channel
- Frontend: Both `ConsultationPage.tsx` files call the join endpoint on mount and subscribe to `appointment-{id}` to show a live join indicator

**Out of scope:**
- Leave/rejoin tracking
- Displaying join time to the other party
- Automatic consultation start/end based on join status

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/appointments/appointments.schema.ts` | Add `patientJoinedAt` and `doctorJoinedAt` nullable timestamp columns to `appointments` |
| `src/modules/appointments/appointments.repository.ts` | Add `markJoined(appointmentId, role, timestamp)` |
| `src/modules/appointments/appointments.service.ts` | Add `joinConsultation(appointmentId, userId, role)` |
| `src/modules/appointments/appointments.controller.ts` | Add `PATCH /:id/join` route |
| `src/db/migrations/` | New migration: add two nullable timestamp columns to `appointments` |

### Schema Changes

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `patient_joined_at` | timestamp | yes | Set when patient calls join |
| `doctor_joined_at` | timestamp | yes | Set when doctor calls join |

Migration required: yes.

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/api/appointments/:id/join` | `authenticate` | Record that the caller has joined; fire Pusher event |

### Service / Repository Methods

- `appointmentsRepository.markJoined(appointmentId, role, timestamp)`:
  ```ts
  if (role === 'patient') {
    return db.update(appointments).set({ patientJoinedAt: timestamp }).where(eq(appointments.id, appointmentId))
  } else {
    return db.update(appointments).set({ doctorJoinedAt: timestamp }).where(eq(appointments.id, appointmentId))
  }
  ```
  > Do NOT use a computed property key `{ [field]: timestamp }` — Drizzle's `.set()` is fully typed and a computed string key fails TypeScript strict mode compilation.
- `appointmentsService.joinConsultation(appointmentId, userId, role)`:
  1. Fetch appointment — throw 404 if not found
  2. Verify caller is patient or doctor on this appointment — throw 403 otherwise
  3. Call `markJoined(appointmentId, role, new Date())`
  4. `pusher.trigger(`appointment-${appointmentId}`, 'user_joined', { role, joinedAt: new Date() })`

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/consultations/patient/ConsultationPage.tsx` | Call join endpoint on mount; subscribe to `appointment-{id}`; show "Waiting for Dr. {name}…" or "Doctor is in the room" |
| `src/features/consultations/doctor/ConsultationPage.tsx` | Same — show "Waiting for patient…" or "Patient is in the room" |
| `src/features/consultations/api/consultations.api.ts` | Add `joinConsultation(appointmentId)` API function |
| `src/features/consultations/hooks/useConsultations.ts` | Add `useJoinConsultation()` mutation |

### Indicator UI

- Before the other party joins: show a soft banner or badge — "Waiting for Dr. Smith to join…" (with a pulsing indicator)
- Once they join: banner changes to "Dr. Smith is in the room ✓" (or simply disappears after a few seconds)
- Use `useState` to track `otherPartyJoined: boolean`

### New Hooks / API Functions

- `joinConsultation(appointmentId)` — `api.patch(`/appointments/${appointmentId}/join`)`
- `useJoinConsultation()` — `useMutation`; call on `ConsultationPage` mount

**Pusher subscription:**
```ts
useEffect(() => {
  const channel = pusher.subscribe(`appointment-${appointmentId}`)
  channel.bind('user_joined', (data: { role: string }) => {
    const myRole = user.roles.includes('doctor') ? 'doctor' : 'patient'
    if (data.role !== myRole) setOtherPartyJoined(true)
  })
  return () => pusher.unsubscribe(`appointment-${appointmentId}`)
}, [appointmentId])
```

---

## Implementation Steps

1. (BE) Add `patientJoinedAt` and `doctorJoinedAt` columns to `appointments.schema.ts` and generate + run migration.
2. (BE) Add `markJoined` to `appointments.repository.ts`.
3. (BE) Add `joinConsultation` to `appointments.service.ts` with ownership check and Pusher trigger.
4. (BE) Register `PATCH /:id/join` in `appointments.controller.ts`.
5. (FE) Add `joinConsultation` API function and `useJoinConsultation` hook.
6. (FE) In patient `ConsultationPage.tsx`: call `useJoinConsultation` on mount; subscribe to Pusher `appointment-{id}`; show "Waiting for Dr. {name}…" banner that updates when `user_joined` event fires with `role === 'doctor'`.
7. (FE) Repeat for doctor `ConsultationPage.tsx` (looking for `role === 'patient'` event).

---

## Verification

1. Open a consultation as a patient only — banner shows "Waiting for Dr. [Name] to join…".
2. Doctor joins in another tab — patient's banner updates to "Doctor is in the room" within 1–2 seconds (Pusher latency).
3. Reload the patient tab — re-join is called, and since the doctor had previously set `doctorJoinedAt`, the indicator can show joined status from the fetched appointment data.
4. Check `GET /api/appointments/:id` after both join — response includes non-null `patientJoinedAt` and `doctorJoinedAt`.
