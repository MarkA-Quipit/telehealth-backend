# D2 — Consultation Count on DoctorCard

**Type:** FE
**Status:** To Do
**Priority:** 3

---

## Purpose

`GET /api/doctors` already returns `completedConsultationsCount` for each doctor. Displaying this metric on the `DoctorCard` gives patients a quick trust signal — how many consultations a doctor has completed — without any backend work.

---

## Scope

**In scope:**
- Render `completedConsultationsCount` as a small stat on `DoctorCard.tsx`

**Out of scope:**
- Backend changes (data already returned)
- Showing this on the full DoctorProfilePage (that's a separate optional enhancement)

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/doctors/components/DoctorCard.tsx` | Add consultation count stat below or beside existing card content |

---

## Implementation Steps

1. Confirm `DoctorWithUser` type in `src/features/doctors/types/index.ts` includes `completedConsultationsCount: number`. Add the field if missing.
2. In `DoctorCard.tsx`, render the count as a small stat — e.g., `{completedConsultationsCount} consultations` with a stethoscope or check icon from Lucide.
3. Show "0 consultations" gracefully when the count is zero rather than hiding it.

---

## Verification

1. Open the doctor discovery list — each card shows a consultation count.
2. A doctor with 0 completed consultations shows "0 consultations" (not blank).
3. Count matches what `GET /api/doctors` returns for that doctor.
