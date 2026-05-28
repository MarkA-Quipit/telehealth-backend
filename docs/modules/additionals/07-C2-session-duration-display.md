# C2 — Session Duration Display

**Type:** FE
**Status:** To Do
**Priority:** 7

---

## Purpose

Appointments already store `durationMinutes` (and `scheduledAt`/`endsAt`). Surfacing this as a human-readable badge ("30-min session") in the appointment detail and consultation pages sets clear expectations for both patients and doctors about how long a session lasts.

---

## Scope

**In scope:**
- `AppointmentDetailPage.tsx` — show "X-min session" badge in the detail section
- `AppointmentCard.tsx` — already has `durationMinutes` access; add the badge if not already shown
- `ConsultationPage.tsx` (patient-facing) — show session length indicator
- `ConsultationPage.tsx` (doctor-facing) — show session length indicator

**Out of scope:**
- Backend changes (data already returned)
- Countdown timer during live consultation (that is a separate richer feature)
- Changing the duration from the UI

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/appointments/patient/AppointmentDetailPage.tsx` | Add duration badge to the appointment info section |
| `src/features/appointments/components/AppointmentCard.tsx` | Add duration badge if not already rendered |
| `src/features/consultations/patient/ConsultationPage.tsx` | Add session length indicator |
| `src/features/consultations/doctor/ConsultationPage.tsx` | Add session length indicator |

---

## Implementation Steps

1. Create a small helper: `formatDuration(minutes: number): string` → `"30 min"` or `"1 hr"` or `"1 hr 30 min"`. Place it in `shared/lib/utils.ts` or inline in the component.
2. In `AppointmentDetailPage.tsx`, locate the appointment info block. Add a `<span>` or `<Badge>` showing `formatDuration(appointment.durationMinutes)` alongside existing fields (date, status).
3. In `AppointmentCard.tsx`, check if `durationMinutes` is already displayed. If not, add the formatted duration as a small secondary stat.
4. In both `ConsultationPage.tsx` files, read `appointment.durationMinutes` (fetched via `GET /api/appointments/:id`) and display "X-min session" as a small top-of-page indicator near the room header or timer area.

---

## Verification

1. View an appointment detail as a patient — duration badge visible (e.g., "30 min session").
2. View the same appointment as a doctor — same badge visible in doctor's detail view.
3. Join a consultation as either role — session length indicator appears near the top of the consultation page.
4. Test with a 60-minute appointment — shows "1 hr session", not "60 min session" (apply formatting correctly).
