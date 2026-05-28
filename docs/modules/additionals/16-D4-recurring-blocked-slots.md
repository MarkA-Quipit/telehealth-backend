# D4 — Recurring Blocked Slots

**Type:** FULL
**Status:** To Do
**Priority:** 16

---

## Purpose

Doctors currently block specific dates/times one at a time. Many blocks are weekly recurring (e.g., "I'm unavailable every Monday 12–1pm for a meeting"). This feature adds a `recurrenceType` field to blocked slots and makes the slot generation logic expand weekly-recurring blocks when checking availability for any future date.

---

## Scope

**In scope:**
- Backend: Add optional `recurrenceType enum('none', 'weekly')` column to `doctor_blocked_slots`
- Backend: New Drizzle migration
- Backend: Update slot generation service to expand weekly-recurring blocks when computing available slots for a date
- Frontend: "Repeat weekly" toggle in the blocked slot creation form in `DoctorAvailabilityPage.tsx`

**Out of scope:**
- `daily`, `monthly`, or custom recurrence patterns (only `weekly` for now)
- End date for recurring blocks (treat as indefinitely recurring)
- Editing existing blocked slots to add/remove recurrence

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/doctors/doctors.schema.ts` | Add `recurrenceType` column (enum: `'none'` \| `'weekly'`, default `'none'`) to `doctorBlockedSlots` |
| `src/modules/doctors/doctors.repository.ts` | Include `recurrenceType` in insert and select for blocked slots |
| `src/modules/doctors/doctors.service.ts` | Update slot generation: when filtering out blocked slots for a date, also match weekly-recurring blocks by day-of-week + time overlap |
| `src/modules/doctors/doctors.schema.ts` | Add `recurrenceType` to `createBlockedSlotSchema` Zod validator |
| `src/db/migrations/` | New migration: `ALTER TABLE doctor_blocked_slots ADD COLUMN recurrence_type varchar(10) NOT NULL DEFAULT 'none'` |

### Schema Changes

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `recurrence_type` | varchar(10) | `'none'` | `'none'` or `'weekly'` |

Migration required: yes.

### Slot Generation Logic Update

When generating available slots for `doctorId` on `targetDate`:

1. Fetch all blocked slots for the doctor where:
   - `blockedDate = targetDate` (existing one-time blocks), **OR**
   - `recurrenceType = 'weekly'` AND `EXTRACT(DOW FROM blockedDate) = EXTRACT(DOW FROM targetDate)` (weekly recurring, same day-of-week)
2. For each matched block, filter out any generated slots that overlap with `[blockedStart, blockedEnd)`.

In Drizzle ORM (avoid raw SQL — use `or`, `eq`, `sql` expressions within Drizzle query builder):

```ts
const blocks = await db.select().from(doctorBlockedSlots).where(
  and(
    eq(doctorBlockedSlots.doctorId, doctorId),
    or(
      eq(doctorBlockedSlots.blockedDate, targetDate),
      and(
        eq(doctorBlockedSlots.recurrenceType, 'weekly'),
        sql`EXTRACT(DOW FROM ${doctorBlockedSlots.blockedDate}) = EXTRACT(DOW FROM ${targetDate}::date)`
      )
    )
  )
)
```

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/appointments/doctor/DoctorAvailabilityPage.tsx` | Add "Repeat weekly" toggle (checkbox or switch) to the blocked slot form |

### New Hooks / API Functions

No new hooks needed — the existing create blocked slot mutation sends the full payload. Add `recurrenceType` to the form state and payload.

---

## Implementation Steps

1. (BE) Add `recurrenceType` column to `doctorBlockedSlots` in `doctors.schema.ts`.
2. (BE) Generate and run migration.
3. (BE) Add `recurrenceType` to `createBlockedSlotSchema` Zod validator (optional, default `'none'`).
4. (BE) Update `doctors.service.ts` slot generation to include weekly-recurring blocks when filtering out unavailable times.
5. (FE) Add a "Repeat weekly" checkbox to the blocked slot creation form in `DoctorAvailabilityPage.tsx`.
6. (FE) Bind to `recurrenceType` state: checked → `'weekly'`, unchecked → `'none'`.
7. (FE) Include `recurrenceType` in the create blocked slot payload.

---

## Verification

1. As a doctor, block a slot with "Repeat weekly" checked (e.g., Monday 12:00–13:00).
2. As a patient, view available slots for that doctor on the same weekday two weeks later — the blocked time is not offered.
3. As a patient, view slots on a different weekday — the block does not apply.
4. Create a non-recurring block — verify it only blocks that specific date.
5. Check that `GET /api/doctors/:id/slots?date=...` reflects the recurrence correctly.
