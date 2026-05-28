# AP2 — iCal / Calendar Export

**Type:** FULL
**Status:** To Do
**Priority:** 11

---

## Purpose

Patients and doctors should be able to add confirmed appointments to their native calendar app (Google Calendar, Apple Calendar, Outlook). A `GET /api/appointments/:id/calendar` endpoint generates a standards-compliant `.ics` file that any calendar application can import. No third-party libraries are needed — RFC 5545 iCalendar format is plain text.

---

## Scope

**In scope:**
- Backend: `GET /api/appointments/:id/calendar` — generates `.ics` content and returns it as a file download
- Frontend: "Add to Calendar" download link on `AppointmentDetailPage.tsx`

**Out of scope:**
- Google Calendar / Outlook OAuth integration (direct `.ics` download is sufficient)
- Recurring event entries
- Automatic calendar sync on appointment status changes

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/appointments/appointments.service.ts` | Add `generateIcsContent(appointmentId: string, userId: string): Promise<string>` |
| `src/modules/appointments/appointments.controller.ts` | Add `GET /:id/calendar` route |

### Schema Changes

- No migration needed

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/appointments/:id/calendar` | `authenticate` | Download `.ics` file for the appointment |

### Service / Repository Methods

- `appointmentsService.generateIcsContent(appointmentId, userId)`:
  1. Fetch appointment (throw 404 if not found)
  2. Verify `appointment.patientId === userId || appointment.doctorId === userId` (throw 403 otherwise)
  3. Build RFC 5545 string:
     ```
     BEGIN:VCALENDAR
     VERSION:2.0
     PRODID:-//TeleHealth//EN
     BEGIN:VEVENT
     UID:{appointmentId}@telehealth
     DTSTAMP:{now in YYYYMMDDTHHmmssZ format}
     DTSTART:{scheduledAt in YYYYMMDDTHHmmssZ}
     DTEND:{endsAt in YYYYMMDDTHHmmssZ}
     SUMMARY:Telehealth Consultation with Dr. {lastName}
     DESCRIPTION:Room: {appointmentId}
     END:VEVENT
     END:VCALENDAR
     ```
  4. Return the string
- Controller sets `Content-Type: text/calendar; charset=utf-8` and `Content-Disposition: attachment; filename="appointment-{id}.ics"`

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/appointments/patient/AppointmentDetailPage.tsx` | Add "Add to Calendar" download link |

### New Hooks / API Functions

- No new hook needed — use an `<a>` tag pointing to the API URL with the JWT in a query param, or trigger a `blob` download via `api.get` on click.

**Recommended approach (blob download):**
```ts
const handleCalendarDownload = async () => {
  const res = await api.get(`/appointments/${id}/calendar`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `appointment-${id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Implementation Steps

1. (BE) Add `generateIcsContent(appointmentId, userId)` to `appointments.service.ts` — fetch appointment, verify ownership, build and return the RFC 5545 string.
2. (BE) Register `GET /:id/calendar` in `appointments.controller.ts`:
   ```ts
   router.get('/:id/calendar', authenticate, async (req, res) => {
     const ics = await appointmentService.generateIcsContent(req.params.id, req.user!.id)
     res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
     res.setHeader('Content-Disposition', `attachment; filename="appointment-${req.params.id}.ics"`)
     res.send(ics)
   })
   ```
3. (FE) Add an "Add to Calendar" button in `AppointmentDetailPage.tsx`.
4. (FE) Wire the blob download handler to the button's `onClick`.

---

## Verification

1. View a confirmed appointment as a patient — "Add to Calendar" button visible.
2. Click the button — browser triggers a `.ics` file download.
3. Open the `.ics` file in a text editor — confirm valid RFC 5545 format with correct dates, summary, and UID.
4. Import the `.ics` into Google Calendar or Apple Calendar — event appears with correct date/time and title.
5. Attempt to fetch `GET /api/appointments/:id/calendar` with a token belonging to an unrelated user — receive 403.
