# Appointments Module

## 1. Purpose

Core booking system. Manages the full lifecycle of an appointment: creation, confirmation, completion, and cancellation. Coordinates with notifications on status changes. Provides appointment lists and detail views for both roles.

---

## 2. Required Features

- Create appointment (patient books a doctor)
- Get appointment detail
- List appointments (role-filtered: patient sees own, doctor sees own)
- Cancel appointment (patient or doctor, with reason)
- Update appointment status (doctor: pending → confirmed → completed)
- Conflict detection before booking (no double-booking)
- Appointment serves as the Jitsi room anchor (appointmentId = roomName)

---

## 3. Out-of-Scope Features

- Rescheduling (cancel + rebook is sufficient for MVP)
- Recurring appointments
- Group appointments
- Waitlist
- Insurance billing per appointment
- Payment processing
- Appointment reminders via email (notification bell is sufficient)
- Calendar export (iCal)

---

## 4. Backend Responsibilities

### Files

```
src/modules/appointments/
├── appointments.controller.ts
├── appointments.service.ts
├── appointments.repository.ts
└── appointments.schema.ts
```

### appointments.schema.ts

Drizzle table definition:

```ts
appointments: {
  id:                  uuid PK  ← also used as Jitsi room name
  patient_id:          uuid FK → patients
  doctor_id:           uuid FK → doctors
  scheduled_at:        timestamp (UTC)
  duration_minutes:    integer, default 30
  status:              varchar(20)  -- 'pending' | 'confirmed' | 'cancelled' | 'completed'
  reason_for_visit:    text, nullable
  cancellation_reason: text, nullable
  cancelled_by:        uuid FK → users, nullable
  created_at:          timestamp
  updated_at:          timestamp
}
```

Status transitions:
```
pending → confirmed  (doctor action)
pending → cancelled  (patient or doctor)
confirmed → completed (doctor action)
confirmed → cancelled (patient or doctor)
```

Zod validators:

```ts
createAppointmentSchema: {
  doctorId:        z.string().uuid()
  scheduledAt:     z.string().datetime()  // ISO UTC, must be future
  durationMinutes: z.number().int().default(30).optional()
  reasonForVisit:  z.string().max(500).optional()
}

updateStatusSchema: {
  status: z.enum(['confirmed', 'completed'])
}

cancelAppointmentSchema: {
  cancellationReason: z.string().max(500).optional()
}
```

### appointments.repository.ts

```ts
create(data: CreateAppointmentData, tx): Promise<Appointment>

findById(id: string): Promise<AppointmentWithDetails | null>
  // Joins: patient (+ user), doctor (+ user)

findByPatient(patientId: string, filters: ListFilters): Promise<PaginatedAppointments>
findByDoctor(doctorId: string, filters: ListFilters): Promise<PaginatedAppointments>
  // filters: { status?, page, limit }

updateStatus(id: string, status: string): Promise<Appointment>
cancel(id: string, userId: string, reason?: string): Promise<Appointment>

checkConflict(doctorId: string, scheduledAt: Date, durationMinutes: number): Promise<boolean>
  // Returns true if any non-cancelled appointment overlaps the proposed slot
```

### appointments.service.ts

```ts
createAppointment(requesterId: string, dto: CreateAppointmentDto): Promise<Appointment>
  // 1. Resolve patientId from requesterId (must be a patient)
  // 2. Check conflict → throw 409 if slot taken
  // 3. Transaction:
  //    a. INSERT appointment (status = 'pending')
  //    b. INSERT notification for patient (appointment_booked)
  //    c. INSERT notification for doctor (appointment_booked)
  // 4. Trigger Pusher event for both users
  // 5. Return created appointment

getAppointment(requesterId: string, appointmentId: string): Promise<AppointmentWithDetails>
  // Throws 404 if not found
  // Throws 403 if requester is not patient or doctor for this appointment

listAppointments(requesterId: string, filters: ListFilters): Promise<PaginatedAppointments>
  // Resolves role of requesterId → calls findByPatient or findByDoctor

updateStatus(requesterId: string, appointmentId: string, dto: UpdateStatusDto): Promise<Appointment>
  // Only doctor can call this
  // Validates transition is legal
  // If completing: calls notifications.service.createAndPush

cancelAppointment(requesterId: string, appointmentId: string, dto: CancelDto): Promise<Appointment>
  // Either role can cancel
  // Records cancelled_by
  // Calls notifications.service.createAndPush for the other party
```

### appointments.controller.ts

```
POST   /api/appointments              → createAppointment()   → 201
GET    /api/appointments              → listAppointments()    → 200
GET    /api/appointments/:id          → getAppointment()      → 200
PATCH  /api/appointments/:id/status   → updateStatus()        → 200
DELETE /api/appointments/:id          → cancelAppointment()   → 200
```

---

## 5. Frontend Responsibilities

### Files

```
src/features/appointments/
├── api/
│   └── appointments.api.ts
├── components/
│   ├── AppointmentCard.tsx
│   ├── AppointmentStatusBadge.tsx
│   └── AppointmentTimeline.tsx
├── hooks/
│   └── useAppointments.ts
├── patient/
│   ├── BookAppointmentPage.tsx
│   ├── AppointmentListPage.tsx
│   └── AppointmentDetailPage.tsx
├── doctor/
│   ├── DoctorAppointmentListPage.tsx
│   └── DoctorAppointmentDetailPage.tsx
└── types/
    └── index.ts
```

### AppointmentCard.tsx

Compact row/card display:
- Date + time (local timezone, formatted)
- Doctor or patient name (context-aware)
- Status badge
- Quick actions: "View Details" button

### AppointmentStatusBadge.tsx

```ts
const statusConfig = {
  pending:   { label: 'Pending',   class: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmed', class: 'bg-sky-100 text-sky-700' },
  completed: { label: 'Completed', class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', class: 'bg-red-100 text-red-700' },
}
```

### BookAppointmentPage.tsx

Flow:
1. Doctor info summary at top (from `/patient/doctors/:id` navigation)
2. Date picker (AvailabilityCalendar from doctors feature)
3. Select time slot
4. Reason for visit textarea (optional)
5. "Confirm Booking" button
6. Success → toast + redirect to `/patient/appointments`

### AppointmentListPage.tsx (patient)

- Tabs: "Upcoming" / "Past"
- Upcoming: pending + confirmed, sorted ascending by scheduledAt
- Past: completed + cancelled, sorted descending
- Per row: AppointmentCard
- Empty state per tab

### AppointmentDetailPage.tsx (patient)

```
[Appointment Header]
  Doctor name + specialization
  Date + time
  Status badge

[Join Session Button]
  - Enabled only if: status === 'confirmed' AND within 15 min window
  - Navigates to /patient/consultation/:appointmentId

[Appointment Details Card]
  Reason for visit
  Duration

[Cancel Appointment]
  Only if status === 'pending' or 'confirmed'
  Dialog: cancellation reason input → confirm

[Medical Records (if completed)]
  Consultation notes (read-only)
  Prescriptions list (read-only)
```

### DoctorAppointmentListPage.tsx (doctor)

- Filter tabs: All / Pending / Confirmed / Completed / Cancelled
- Per row: AppointmentCard showing patient name
- Empty state per filter

### DoctorAppointmentDetailPage.tsx (doctor)

```
[Appointment Header]
  Patient name
  Date + time
  Status badge

[Action Buttons by status]
  pending   → [Confirm] [Cancel]
  confirmed → [Complete] [Cancel] [Join Session]
  completed → (no actions)
  cancelled → (no actions)

[Patient Medical Info Card]
  Blood type, allergies, medical history (from patients API)

[Join Session Button]
  Same 15-min window rule as patient
  Navigates to /doctor/consultation/:appointmentId

[Consultation Notes Card]
  Textarea for notes (chief complaint, diagnosis, notes, follow-up date)
  Save button → POST/PUT /api/appointments/:id/notes

[Prescriptions Card]
  Add prescription form: medication name, dosage, frequency, duration, instructions
  List of added prescriptions with delete button
```

---

## 6. Database Tables

| Table | Role |
|---|---|
| `appointments` | Primary — full CRUD |
| `patients` | Joined for patient info |
| `doctors` | Joined for doctor info |
| `users` | Joined for names, avatars |
| `notifications` | Written on status change |

---

## 7. API Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/appointments` | JWT | Patient | Book appointment |
| GET | `/api/appointments` | JWT | Any | List (role-filtered) |
| GET | `/api/appointments/:id` | JWT | Any | Detail |
| PATCH | `/api/appointments/:id/status` | JWT | Doctor | Confirm / complete |
| DELETE | `/api/appointments/:id` | JWT | Any | Cancel |

---

## 8. Validation Rules

```
POST /api/appointments
  doctorId:        required, valid UUID
  scheduledAt:     required, ISO datetime, must be in the future
  durationMinutes: optional, integer, default 30
  reasonForVisit:  optional, max 500 chars

PATCH /api/appointments/:id/status
  status: required, enum ['confirmed', 'completed']

DELETE /api/appointments/:id
  cancellationReason: optional, max 500 chars
```

---

## 9. UI Screens

### Patient

| Screen | Route |
|---|---|
| Book Appointment | `/patient/doctors/:id` (booking section) |
| Appointment List | `/patient/appointments` |
| Appointment Detail | `/patient/appointments/:id` |

### Doctor

| Screen | Route |
|---|---|
| Appointment List | `/doctor/appointments` |
| Appointment Detail | `/doctor/appointments/:id` |

---

## 10. Dependencies

- Depends on: auth, users, patients, doctors modules
- Required by: consultations module (Jitsi room ID = appointmentId), notifications module (triggers on status change)
- Calls: `notifications.service.createAndPush` on: create, confirm, complete, cancel

---

## 11. Completion Criteria

- [ ] `POST /api/appointments` creates appointment and sends notifications to both parties
- [ ] Double-booking same doctor at same time returns 409
- [ ] `GET /api/appointments` returns correct appointments filtered by role
- [ ] `PATCH /api/appointments/:id/status` enforces valid transitions only
- [ ] `DELETE /api/appointments/:id` records cancellation by, sends notification to other party
- [ ] Patient appointment list shows tabs with correct filtering
- [ ] Patient appointment detail shows Join button only when confirmed + within 15-min window
- [ ] Doctor appointment detail shows correct action buttons per status
- [ ] Doctor can write notes and prescriptions from detail page
- [ ] Cancel dialog requires no confirmation text (reason optional)
