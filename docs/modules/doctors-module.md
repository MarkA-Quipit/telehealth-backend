# Doctors Module

## 1. Purpose

Manage doctor-specific profile data, weekly availability schedules, and one-off blocked slots. Provide doctor discovery for patients (browse, filter, search). Expose available booking slots for a given date.

---

## 2. Required Features

- Get doctor profile (public-facing + self-edit)
- Update doctor profile (bio, specialization, years of experience, consultation fee)
- List all doctors with filters (specialization, search, pagination)
- Manage weekly availability schedule (day + start/end time per day)
- Block specific date/time slots (one-off unavailability)
- Get available 30-min booking slots for a given date (used by booking flow)

---

## 3. Out-of-Scope Features

- Doctor license verification
- Doctor ratings / reviews (bonus feature — not in scope)
- Insurance / billing settings
- Multiple clinic locations
- Doctor-to-doctor referrals
- Calendar sync (Google Calendar, etc.)
- Recurring blocked slots
- Custom slot durations (all slots are 30 min in MVP)

---

## 4. Backend Responsibilities

### Files

```
src/modules/doctors/
├── doctors.controller.ts
├── doctors.service.ts
├── doctors.repository.ts
└── doctors.schema.ts
```

### doctors.schema.ts

Drizzle table definitions:

```ts
doctors: {
  id:                   uuid PK
  user_id:              uuid FK → users (unique)
  specialization:       varchar(100), not null
  bio:                  text, nullable
  license_number:       varchar(50), nullable
  years_of_experience:  integer, nullable
  consultation_fee:     decimal(10,2), nullable
  is_accepting_patients: boolean, default true
  created_at:           timestamp
  updated_at:           timestamp
}

doctor_availability: {
  id:          uuid PK
  doctor_id:   uuid FK → doctors
  day_of_week: integer (0=Sun … 6=Sat)
  start_time:  time (e.g., '09:00')
  end_time:    time (e.g., '17:00')
  is_available: boolean, default true
  created_at:  timestamp
}

doctor_blocked_slots: {
  id:           uuid PK
  doctor_id:    uuid FK → doctors
  blocked_date: date, not null
  start_time:   time, not null
  end_time:     time, not null
  reason:       text, nullable
  created_at:   timestamp
}
```

Zod validators:

```ts
updateDoctorSchema: {
  specialization:       z.string().min(1).max(100).optional()
  bio:                  z.string().max(2000).optional()
  licenseNumber:        z.string().max(50).optional()
  yearsOfExperience:    z.number().int().min(0).optional()
  consultationFee:      z.number().positive().optional()
  isAcceptingPatients:  z.boolean().optional()
}

setAvailabilitySchema: {
  availability: z.array(z.object({
    dayOfWeek:   z.number().int().min(0).max(6),
    startTime:   z.string().regex(/^\d{2}:\d{2}$/),
    endTime:     z.string().regex(/^\d{2}:\d{2}$/),
    isAvailable: z.boolean()
  }))
}

blockSlotSchema: {
  blockedDate: z.string().date()
  startTime:   z.string().regex(/^\d{2}:\d{2}$/)
  endTime:     z.string().regex(/^\d{2}:\d{2}$/)
  reason:      z.string().max(200).optional()
}
```

### doctors.repository.ts

```ts
findAll(filters: DoctorFilters): Promise<{ items: DoctorWithUser[]; total: number }>
  // filters: { specialization?, search?, page, limit }

findById(doctorId: string): Promise<DoctorWithUser | null>
findByUserId(userId: string): Promise<Doctor | null>

update(doctorId: string, data: Partial<UpdateDoctorData>): Promise<Doctor>

getAvailability(doctorId: string): Promise<DoctorAvailability[]>
setAvailability(doctorId: string, slots: AvailabilityInput[]): Promise<DoctorAvailability[]>
  // DELETE existing + INSERT new (replace all at once)

getBlockedSlots(doctorId: string, date: string): Promise<BlockedSlot[]>
addBlockedSlot(doctorId: string, data: BlockSlotInput): Promise<BlockedSlot>
deleteBlockedSlot(slotId: string): Promise<void>
```

### doctors.service.ts

```ts
listDoctors(filters: DoctorFilters): Promise<PaginatedResponse<DoctorWithUser>>

getDoctorById(doctorId: string): Promise<DoctorWithUser>
  // Throws 404 if not found

updateDoctorProfile(requesterId: string, doctorId: string, data: UpdateDoctorDto): Promise<Doctor>
  // Validates requester is the doctor

setAvailability(requesterId: string, doctorId: string, slots: AvailabilityInput[]): Promise<DoctorAvailability[]>
  // Validates endTime > startTime for each slot

addBlockedSlot(requesterId: string, doctorId: string, data: BlockSlotInput): Promise<BlockedSlot>
deleteBlockedSlot(requesterId: string, doctorId: string, slotId: string): Promise<void>

getAvailableSlots(doctorId: string, date: string): Promise<TimeSlot[]>
  // Algorithm:
  //   1. Get day_of_week for given date
  //   2. Find doctor_availability row for that day where is_available = true
  //   3. Generate 30-min windows from start_time to end_time
  //   4. Filter out windows that overlap with existing confirmed/pending appointments
  //   5. Filter out windows that overlap with doctor_blocked_slots for that date
  //   6. Return available windows as [{ startTime, endTime }]
```

### doctors.controller.ts

```
GET    /api/doctors                          → listDoctors()            → 200
GET    /api/doctors/:id                      → getDoctorById()          → 200
PUT    /api/doctors/:id                      → updateDoctorProfile()    → 200
GET    /api/doctors/:id/availability         → getAvailability()        → 200
PUT    /api/doctors/:id/availability         → setAvailability()        → 200
POST   /api/doctors/:id/blocked-slots        → addBlockedSlot()         → 201
DELETE /api/doctors/:id/blocked-slots/:slotId → deleteBlockedSlot()    → 200
GET    /api/doctors/:id/slots                → getAvailableSlots()      → 200
```

---

## 5. Frontend Responsibilities

### Files

```
src/features/doctors/
├── api/
│   └── doctors.api.ts
├── components/
│   ├── DoctorCard.tsx          # Grid card: name, specialization, fee, accepting badge, Book button
│   ├── DoctorFilter.tsx        # Specialization dropdown + search input with debounce
│   └── AvailabilityCalendar.tsx # Date picker → slot grid for booking
├── hooks/
│   └── useDoctors.ts
├── patient/
│   ├── DoctorListPage.tsx      # Patient: browse + filter doctors
│   └── DoctorProfilePage.tsx   # Patient: full doctor info + Book CTA
└── types/
    └── index.ts
```

Doctor profile and availability management pages live in the `users` feature:

```
src/features/users/doctor/
└── DoctorProfilePage.tsx       # Doctor self-edit: bio, specialization, fee, etc.
```

Doctor availability page:

```
src/features/appointments/doctor/
└── DoctorAvailabilityPage.tsx  # Manage weekly schedule + blocked slots
```

### DoctorCard.tsx

Display:
- Avatar (with initials fallback)
- Name + specialization
- Years of experience
- Consultation fee (e.g., "₱500 / session")
- "Accepting patients" badge (green) or "Not accepting" (gray)
- "Book Appointment" button → navigates to `/patient/doctors/:id`

### DoctorFilter.tsx

- Specialization: `<Select>` populated with distinct specializations from API
- Search: `<Input>` with `useDebounce(300ms)` before triggering query refetch

### AvailabilityCalendar.tsx (used in booking flow)

- Date picker (Shadcn Calendar) — disables past dates
- On date select: calls `GET /api/doctors/:id/slots?date=YYYY-MM-DD`
- Renders time slot grid (e.g., "9:00 AM", "9:30 AM", …)
- Selected slot highlighted
- Loading skeleton while fetching slots

### DoctorAvailabilityPage.tsx

- Weekly grid (Sunday–Saturday, or Monday–Sunday)
- Per day: toggle available/unavailable, start time + end time pickers
- "Save Schedule" button → `PUT /api/doctors/:id/availability`
- Blocked slots section: date picker + start/end time + add button
- List of existing blocked slots with delete button

---

## 6. Database Tables

| Table | Role |
|---|---|
| `doctors` | Primary — read/write |
| `doctor_availability` | Weekly schedule — replace-all on save |
| `doctor_blocked_slots` | One-off blocks — add/delete |
| `users` | Joined for name, avatar, email |
| `appointments` | Read to compute available slots (conflict check) |

---

## 7. API Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/api/doctors` | JWT | Any | List with filters + pagination |
| GET | `/api/doctors/:id` | JWT | Any | Doctor profile |
| PUT | `/api/doctors/:id` | JWT | Doctor (own) | Update profile |
| GET | `/api/doctors/:id/availability` | JWT | Any | Weekly schedule |
| PUT | `/api/doctors/:id/availability` | JWT | Doctor (own) | Set weekly schedule |
| POST | `/api/doctors/:id/blocked-slots` | JWT | Doctor (own) | Add blocked slot |
| DELETE | `/api/doctors/:id/blocked-slots/:slotId` | JWT | Doctor (own) | Remove blocked slot |
| GET | `/api/doctors/:id/slots` | JWT | Any | Available booking slots for date |

Query params:
- `GET /api/doctors`: `?specialization=&search=&page=1&limit=20`
- `GET /api/doctors/:id/slots`: `?date=YYYY-MM-DD` (required)

---

## 8. Validation Rules

```
GET /api/doctors
  specialization: optional string
  search:         optional string
  page:           optional integer, default 1
  limit:          optional integer, default 20, max 50

PUT /api/doctors/:id
  specialization:      optional, min 1, max 100
  bio:                 optional, max 2000
  licenseNumber:       optional, max 50
  yearsOfExperience:   optional, int >= 0
  consultationFee:     optional, positive number
  isAcceptingPatients: optional, boolean

PUT /api/doctors/:id/availability
  availability: array of { dayOfWeek: 0–6, startTime: HH:MM, endTime: HH:MM, isAvailable: boolean }
  endTime must be after startTime

POST /api/doctors/:id/blocked-slots
  blockedDate: required, YYYY-MM-DD, must not be in the past
  startTime:   required, HH:MM
  endTime:     required, HH:MM, must be after startTime
  reason:      optional, max 200

GET /api/doctors/:id/slots
  date: required, YYYY-MM-DD
```

---

## 9. UI Screens

### `/patient/doctors` — DoctorListPage (patient view)

```
[Page Header: "Find a Doctor"]
[AI Symptom Recommendation Section]  ← collapsed by default, expandable
[DoctorFilter: specialization select + search input]
[Doctor grid — DoctorCard per doctor]
[Pagination controls]
```

Empty state: "No doctors found matching your search"

### `/patient/doctors/:id` — DoctorProfilePage (patient view)

```
[Doctor avatar + name + specialization]
[Accepting patients badge]
[Bio text]
[Consultation fee]
[Years of experience]
[Book Appointment section]
  [AvailabilityCalendar — date picker + slot grid]
  [Reason for visit textarea]
  [Book Appointment button]
```

### `/doctor/profile` — DoctorProfilePage (self-edit)

```
[Avatar + ProfileCard]
[AvatarUpload]
[Personal Information: First name, Last name, Phone]
[Professional Information: Specialization, Bio, Years of experience, Consultation fee, License number]
[Accepting patients toggle]
[Save Changes button]
```

### `/doctor/availability` — DoctorAvailabilityPage

```
[Page Header: "My Schedule"]
[Weekly Schedule Card]
  [Sun | Mon | Tue | Wed | Thu | Fri | Sat]
  Each day: toggle + start time + end time
[Save Schedule button]
[Blocked Slots Card]
  [Add blocked slot: date + start + end + reason + Add button]
  [List of upcoming blocked slots with Delete button per row]
```

---

## 10. Dependencies

- Depends on: auth module, users module (joined user fields, avatar)
- Required by: appointments module (slot availability check, conflict check)

Available slots algorithm depends on:
- `doctor_availability` data being set
- `appointments` table being queryable (cross-module: doctors.repository reads appointments)

> Note: To avoid circular dependencies, `getAvailableSlots` queries the appointments table directly in `doctors.repository.ts` — it does not import from `appointments.repository.ts`.

---

## 11. Completion Criteria

- [ ] `GET /api/doctors` returns paginated list with specialization + search filters
- [ ] `GET /api/doctors/:id` returns full doctor profile with user fields
- [ ] `PUT /api/doctors/:id` updates profile, rejects if not own profile
- [ ] `PUT /api/doctors/:id/availability` replaces weekly schedule atomically
- [ ] `POST/DELETE /api/doctors/:id/blocked-slots` adds and removes slots
- [ ] `GET /api/doctors/:id/slots?date=` returns only open 30-min windows (no conflicts, no blocks)
- [ ] Patient doctor list renders with filter and search working
- [ ] AvailabilityCalendar fetches and renders available slots on date change
- [ ] Doctor availability page saves weekly schedule and manages blocked slots
- [ ] Accepting patients badge visible on DoctorCard
