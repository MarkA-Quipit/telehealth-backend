# Consultations Module

## 1. Purpose

Provide the virtual consultation session experience for both patients and doctors. Embeds Jitsi Meet using the appointment UUID as the room name. No custom video infrastructure — Jitsi handles all WebRTC signaling, media, and session management. This module is intentionally thin.

---

## 2. Required Features

- Jitsi room embed for patient (join session)
- Jitsi room embed for doctor (join session + access to notes/prescriptions during session)
- Session access control: only confirmed appointments within the valid time window can join
- Back navigation to appointment detail after session ends

---

## 3. Out-of-Scope Features

- Custom video controls (mute, camera toggle — Jitsi provides these natively)
- Screen recording
- Session duration tracking
- Waiting room logic
- Chat during consultation (bonus feature — not in MVP scope)
- Session transcription
- Custom Jitsi server (use meet.jit.si)
- Doctor/patient join status tracking
- Push-to-talk
- Breakout rooms

---

## 4. Backend Responsibilities

**No dedicated backend module.** Consultations use the existing `appointments` module infrastructure.

The only backend concern is the access guard already built into `GET /api/appointments/:id`:
- Returns appointment with status
- Frontend uses status + scheduledAt to determine join eligibility

No `/api/consultations` endpoints needed.

---

## 5. Frontend Responsibilities

### Files

```
src/features/consultations/
├── components/
│   └── JitsiRoom.tsx           # @jitsi/react-sdk embed wrapper
├── patient/
│   └── ConsultationPage.tsx    # Patient session view
├── doctor/
│   └── ConsultationPage.tsx    # Doctor session view
└── types/
    └── index.ts
```

### JitsiRoom.tsx

```tsx
Props:
  appointmentId: string   // used as roomName
  displayName: string     // from current user
  onLeave: () => void     // callback when user leaves or closes

Behavior:
  - Renders JitsiMeeting from @jitsi/react-sdk
  - domain: import.meta.env.VITE_JITSI_DOMAIN (default: meet.jit.si)
  - roomName: appointmentId
  - configOverwrite: { startWithAudioMuted: false, startWithVideoMuted: false }
  - userInfo: { displayName }
  - onApiReady: store API ref
  - onReadyToClose: calls onLeave()
  - Full-width, full-height container (calc(100vh - header))
```

### ConsultationPage.tsx (patient)

- Route: `/patient/consultation/:appointmentId`
- On mount: fetch appointment by ID
- If status !== 'confirmed' → redirect to `/patient/appointments/:id` with toast "Appointment not confirmed"
- Renders JitsiRoom with appointmentId and patient's displayName
- onLeave → navigate back to `/patient/appointments/:appointmentId`
- Minimal chrome: just the header (no sidebar) + back button

### ConsultationPage.tsx (doctor)

- Route: `/doctor/consultation/:appointmentId`
- On mount: fetch appointment by ID
- If status !== 'confirmed' → redirect to `/doctor/appointments/:id`
- Renders JitsiRoom with appointmentId and doctor's displayName
- Side panel (collapsible, right side, 320px): shows patient name, chief complaint, quick notes textarea
  - Notes panel is convenience-only: actual save still goes through `/api/appointments/:id/notes`
- onLeave → navigate back to `/doctor/appointments/:appointmentId`

---

## 6. Database Tables

| Table | Role |
|---|---|
| `appointments` | Read — verify status and ownership |

No new tables.

---

## 7. API Endpoints

No new endpoints. Reuses:

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/appointments/:id` | JWT | Verify status before joining |

---

## 8. Validation Rules

**Frontend only (no backend validation layer needed):**

```
Join eligibility check (client-side):
  status === 'confirmed'
  AND scheduledAt is within: [scheduledAt - 5min, scheduledAt + durationMinutes + 15min]
```

If conditions not met: show toast + redirect to appointment detail. Do not render JitsiRoom.

---

## 9. UI Screens

### `/patient/consultation/:appointmentId`

```
[Minimal Header: Logo + "Back to Appointment" link]
[JitsiRoom — full remaining viewport height]
```

No sidebar. No footer. No distractions.

### `/doctor/consultation/:appointmentId`

```
[Minimal Header: Logo + "Back to Appointment" link]
[JitsiRoom — full remaining viewport height, minus right panel if open]
[Collapsible Right Panel (320px)]
  Patient: [name]
  Reason: [reason_for_visit]
  [Quick note textarea — reminder only, not auto-saved]
  [Open Full Notes →] (navigates to appointment detail on session end)
```

---

## 10. Dependencies

- Depends on: auth module (token for API call), appointments module (status check)
- Required by: nothing downstream
- External: `@jitsi/react-sdk` npm package, `VITE_JITSI_DOMAIN` env var

### Layout Override

Consultation pages must render outside `MainLayout` to avoid the sidebar.
They use a minimal `ConsultationLayout` (or inline) with just the top header bar.

Router entry:

```tsx
// These routes use ConsultationLayout, not MainLayout
/patient/consultation/:appointmentId
/doctor/consultation/:appointmentId
```

---

## 11. Completion Criteria

- [ ] `JitsiRoom.tsx` renders Jitsi embed with correct roomName and displayName
- [ ] Patient ConsultationPage blocks access if status !== 'confirmed'
- [ ] Doctor ConsultationPage blocks access if status !== 'confirmed'
- [ ] Both pages navigate back to appointment detail on session leave
- [ ] No sidebar rendered during consultation
- [ ] Doctor sees patient context panel (collapsible)
- [ ] Join button on appointment detail routes to the correct consultation page
- [ ] `VITE_JITSI_DOMAIN` configurable via env (defaults to meet.jit.si)
