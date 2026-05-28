# D1 — Doctor Ratings UI

**Type:** FE
**Status:** To Do
**Priority:** 2

---

## Purpose

The backend already stores and returns doctor ratings (`averageRating`, `reviewCount`) and exposes `GET /api/doctors/:id/reviews`. This task surfaces that data in the UI so patients can make informed booking decisions — star ratings on the doctor discovery list and a full review list on the doctor profile page.

---

## Scope

**In scope:**
- `DoctorCard.tsx` — display star rating + review count using data already returned by `GET /api/doctors`
- `DoctorProfilePage.tsx` (patient-facing) — show average rating + full list of reviews from `GET /api/doctors/:id/reviews`
- `LeaveReviewSection` in `AppointmentDetailPage.tsx` is already implemented — no changes needed there

**Out of scope:**
- Backend changes (zero — all data is already returned)
- Editing or deleting reviews
- Sorting/filtering reviews
- Pagination of reviews

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/doctors/components/DoctorCard.tsx` | Add `StarRating` display + review count below doctor name/specialization |
| `src/features/doctors/patient/DoctorProfilePage.tsx` | Add average rating display + review list section |

### New Hooks / API Functions

- `useDoctorReviews(doctorId)` — query `GET /api/doctors/:id/reviews`; check if it already exists in `hooks/useDoctors.ts` (it is imported in `AppointmentDetailPage.tsx` — reuse the same hook)

---

## Implementation Steps

1. In `DoctorCard.tsx`, confirm the `DoctorWithUser` type includes `averageRating` and `reviewCount` fields. If not, update the type in `types/index.ts`.
2. Add a `StarRating` sub-component (or inline JSX) that renders 5 stars filled/half/empty based on `averageRating`; show `(reviewCount)` beside it.
3. Render the star rating below the doctor's name or specialization in the card.
4. In `DoctorProfilePage.tsx`, call `useDoctorReviews(doctorId)` to fetch the review list.
5. Render average rating prominently at the top of the profile (e.g., large star + numeric score + "X reviews").
6. Render a list of individual reviews: reviewer name (or "Anonymous"), rating stars, comment text, and relative date.

---

## Verification

1. Open the doctor discovery/list page — each DoctorCard should show a star rating and review count.
2. Click a doctor to open their profile — average rating appears at the top.
3. Scroll down to the reviews section — individual reviews are listed with stars, text, and date.
4. If a doctor has no reviews, show "No reviews yet" gracefully.
