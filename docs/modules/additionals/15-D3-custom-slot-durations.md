# D3 — Custom Slot Durations

**Type:** FULL
**Status:** To Do
**Priority:** 15

---

## Purpose

The `doctor_availability` table already stores `slotDurationMinutes` per day, but the slot generation service in `doctors.service.ts` hardcodes 30 minutes. This makes the stored value meaningless. This task fixes the service to use the actual stored duration and adds a duration selector to the doctor's availability page so doctors can set 15/30/45/60-minute slots per availability day.

---

## Scope

**In scope:**
- Backend: Fix `doctors.service.ts` slot generation to use `availability.slotDurationMinutes` instead of the hardcoded 30
- Backend: Fix conflict detection to compare against appointment `durationMinutes`
- Frontend: Slot duration selector (15/30/45/60 min) in `DoctorAvailabilityPage.tsx` per-day form

**Out of scope:**
- Different durations per individual slot within a day (per-day duration is sufficient)
- Allowing patients to choose their preferred session length at booking time

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/doctors/doctors.service.ts` | Replace hardcoded `30` with `availability.slotDurationMinutes` in slot generation loop |

### Schema Changes

- No migration needed (`slotDurationMinutes` column already exists)

### Slot Generation Fix

In `doctors.service.ts`, find the slot generation logic (roughly):

```ts
// BEFORE (wrong)
const slotDuration = 30
while (current < end) {
  slots.push(current.toISO())
  current = current.plus({ minutes: slotDuration })
}

// AFTER (correct)
const slotDuration = availability.slotDurationMinutes ?? 30
while (current < end) {
  slots.push(current.toISO())
  current = current.plus({ minutes: slotDuration })
}
```

### Conflict Detection Fix

When checking if a proposed slot conflicts with an existing appointment, compare against `appointment.durationMinutes` (not a hardcoded 30):

```ts
// Check: does [proposedStart, proposedStart + slotDuration) overlap with [appt.scheduledAt, appt.scheduledAt + appt.durationMinutes)?
```

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/appointments/doctor/DoctorAvailabilityPage.tsx` | Add slot duration selector (15/30/45/60) to the per-day availability form |

### New Hooks / API Functions

No new hooks needed — the existing update availability mutation already sends the full availability object. Just add `slotDurationMinutes` to the form state and payload.

---

## Implementation Steps

1. (BE) Open `doctors.service.ts`, find the slot generation function, and replace all hardcoded `30` values with `availability.slotDurationMinutes ?? 30`.
2. (BE) In the conflict detection logic, use `appointment.durationMinutes` when computing the end time of existing appointments.
3. (FE) In `DoctorAvailabilityPage.tsx`, add a `<select>` or radio group for slot duration (options: 15, 30, 45, 60 minutes) to the per-day form.
4. (FE) Bind the selected value to `slotDurationMinutes` in the form state.
5. (FE) Include `slotDurationMinutes` in the update availability API call payload.

---

## Verification

1. As a doctor, go to availability settings — slot duration selector visible per day.
2. Set a day's slot duration to 15 minutes and save.
3. As a patient, view that doctor's slots for that day — slots are now 15-minute intervals (e.g., 9:00, 9:15, 9:30).
4. Set duration to 60 minutes — slots are now 1-hour intervals.
5. Book an appointment for 60 minutes — the next available slot after that is 60 minutes later, not 30.
