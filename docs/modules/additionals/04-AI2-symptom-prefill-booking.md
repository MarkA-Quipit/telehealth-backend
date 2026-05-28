# AI2 — Symptom Pre-fill to Booking

**Type:** FE
**Status:** To Do
**Priority:** 4

---

## Purpose

When a patient selects a doctor from the SymptomChecker results page, the symptoms they typed should carry through to the booking form and pre-fill the `reasonForVisit` field. This eliminates redundant re-entry and creates a smooth "symptom → book" flow.

---

## Scope

**In scope:**
- Pass `symptoms` string and `doctorId` via React Router state when navigating from SymptomChecker to the booking page
- Read `location.state?.symptoms` in `BookAppointmentPage.tsx` and set it as the initial value for `reasonForVisit`

**Out of scope:**
- Backend changes (none required)
- Persisting symptoms anywhere
- Pre-filling from the general doctor discovery list (only from SymptomChecker results)

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/ai/components/SymptomChecker.tsx` | Change doctor card / "Book" button navigation to include `{ state: { symptoms, doctorId } }` |
| `src/features/appointments/patient/BookAppointmentPage.tsx` | Read `location.state?.symptoms`; use it as the initial value of `reasonForVisit` |

---

## Implementation Steps

1. In `SymptomChecker.tsx`, find the navigation call that sends the patient to the booking page when they select a doctor from results.
2. Change `navigate('/patient/appointments/book')` (or the equivalent path with doctorId) to `navigate('/patient/appointments/book', { state: { symptoms: symptomInput, doctorId } })`.
3. In `BookAppointmentPage.tsx`, import `useLocation` from `react-router-dom`.
4. Read `const { symptoms } = useLocation().state ?? {}`.
5. Pass `symptoms` as the `defaultValue` (or initial `useState` value) for the `reasonForVisit` text area/input.
6. The pre-filled text should be editable — the patient can modify it before submitting.

---

## Verification

1. Go to the SymptomChecker page, enter symptoms (e.g., "headache and fever"), submit.
2. Click a recommended doctor's "Book" button.
3. Arrive at `BookAppointmentPage` — `reasonForVisit` is pre-filled with the entered symptoms.
4. Edit the pre-filled text and complete a booking — the modified text is sent, not the original.
5. Navigate to the booking page directly (without going through SymptomChecker) — `reasonForVisit` is empty, no error.
