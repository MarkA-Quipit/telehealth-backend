# AP3 — DataTable for Appointment Lists

**Type:** FE
**Status:** To Do
**Priority:** 5

---

## Purpose

Replace the card-based appointment list in `AppointmentListPage.tsx` and `DoctorAppointmentListPage.tsx` with a proper TanStack Table (Shadcn DataTable pattern). This gives users sortable, scannable rows — especially useful when appointment history grows long — and aligns with the `AppointmentDataTable` component that already exists in the codebase.

---

## Scope

**In scope:**
- `AppointmentListPage.tsx` (patient) — columns: Date, Doctor, Specialization, Status, Actions
- `DoctorAppointmentListPage.tsx` (doctor) — columns: Date, Patient, Status, Actions
- Sortable by date
- Filterable by status using the existing filter UI (tabs or dropdown already present)

**Out of scope:**
- Backend pagination (load all, filter client-side for now — see N3 for pagination)
- Server-side sorting
- Column visibility toggles
- Export to CSV

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/appointments/patient/AppointmentListPage.tsx` | Replace card list with `AppointmentDataTable`; define patient columns |
| `src/features/appointments/doctor/DoctorAppointmentListPage.tsx` | Replace card list with `AppointmentDataTable`; define doctor columns |
| `src/features/appointments/components/AppointmentDataTable.tsx` | Verify it accepts a `columns` prop and generic row data; extend if needed |

---

## Implementation Steps

1. Open `AppointmentDataTable.tsx` and confirm it uses TanStack Table with a `columns` + `data` prop pattern. If it is hardcoded, refactor it to accept columns externally.
2. Define patient columns array in `AppointmentListPage.tsx`:
   - Date (`scheduledAt`, formatted, sortable)
   - Doctor name
   - Specialization
   - Status (use `AppointmentStatusBadge`)
   - Actions (View button → navigate to detail page)
3. Replace the card map in `AppointmentListPage.tsx` with `<AppointmentDataTable columns={patientColumns} data={filtered} />`.
4. Repeat for `DoctorAppointmentListPage.tsx` with doctor columns:
   - Date, Patient name, Status, Actions
5. Preserve the existing tab/filter UI (Upcoming / Past) — filter the `data` prop before passing to the table rather than filtering inside the component.
6. Ensure sort by date (ascending for upcoming, descending for past) is the default.

---

## Verification

1. Log in as a patient with multiple appointments — list page shows a table with Date, Doctor, Specialization, Status, Actions columns.
2. Click the Date column header — rows sort ascending/descending.
3. Switch between Upcoming and Past tabs — table rows update without a page reload.
4. Click the View action — navigates to the correct appointment detail page.
5. Repeat as a doctor — table shows Date, Patient, Status, Actions.
