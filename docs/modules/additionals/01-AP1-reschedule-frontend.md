# AP1 — Reschedule Frontend UI

**Type:** FE
**Status:** To Do
**Priority:** 1 (NEXT)

---

## Purpose

The backend reschedule flow is fully implemented (`PATCH /api/appointments/:id/reschedule`), and the API function + mutation hook exist on the frontend. The `AppointmentDetailPage.tsx` still uses the old cancel-and-redirect pattern. This task wires the existing hook into a real date-picker + slot-selector dialog, giving patients a seamless in-place reschedule experience without leaving the page.

---

## Scope

**In scope:**
- Fix the `@radix-ui/react-dialog` import (replace with `shared/ui/dialog.tsx` or `radix-ui`)
- Add `rescheduleDate` and `rescheduleSlot` state fields to the page
- Query available slots when `rescheduleDate` changes (`GET /api/doctors/:id/slots?date=`)
- Render a date `<input type="date">` + slot grid buttons inside the reschedule dialog
- Confirm button disabled until a slot is selected; calls `useRescheduleAppointment`
- On success: navigate to `/patient/appointments/${newAppt.id}` + toast "Appointment rescheduled"

**Out of scope:**
- Changing the backend endpoint (already complete)
- Allowing doctors to initiate a reschedule
- Calendar widget (a plain `<input type="date">` is sufficient)

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/appointments/patient/AppointmentDetailPage.tsx` | Fix import, add reschedule date/slot state, slot query, dialog body, confirm handler |
| `src/features/appointments/hooks/useAppointments.ts` | `useRescheduleAppointment` already added — verify it is exported |
| `src/features/appointments/api/appointments.api.ts` | `rescheduleAppointment(id, dto)` already added — verify shape |

### New Hooks / API Functions

- `useDoctorSlots(doctorId, date)` — query `GET /api/doctors/:id/slots?date=` (may already exist in `useDoctors.ts`; reuse if present)

---

## Implementation Steps

1. Open `AppointmentDetailPage.tsx` and change `import * as Dialog from '@radix-ui/react-dialog'` to import from `@/shared/ui/dialog.tsx` (or `radix-ui` barrel).
2. Add state: `const [rescheduleDate, setRescheduleDate] = useState('')` and `const [rescheduleSlot, setRescheduleSlot] = useState('')`.
3. Add a query: when `rescheduleDate` is set, fetch `GET /api/doctors/:id/slots?date={rescheduleDate}` using the existing doctor slots hook (or inline `useQuery`).
4. Replace the reschedule dialog body with:
   - `<input type="date">` bound to `rescheduleDate`
   - Slot grid: map over returned slots, render a button per slot; selected slot highlighted
5. Wire the Confirm button: disabled when `!rescheduleSlot`; on click call `reschedule.mutateAsync({ id, dto: { newScheduledAt: rescheduleSlot } })`.
6. On `mutate` success: `navigate(`/patient/appointments/${newAppt.id}`)` and `toast.success('Appointment rescheduled')`.
7. Reset `rescheduleDate` and `rescheduleSlot` when dialog closes.

---

## Verification

1. Navigate to an existing `pending` or `confirmed` appointment as a patient.
2. Click "Reschedule" — dialog opens.
3. Pick a future date — slot grid populates with available time slots.
4. Select a slot — Confirm button becomes active.
5. Click Confirm — toast appears, page navigates to the new appointment's detail page.
6. Original appointment should show status `cancelled`; new appointment shows `pending`.
