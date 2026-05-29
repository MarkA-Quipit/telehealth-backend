# P3 — Doctor View of Patient Medical History

**Type:** FULL
**Status:** To Do
**Priority:** 22

---

## Purpose

Doctors need a consolidated view of a patient's medical background and full clinical history before or during consultations. Currently a doctor can only view prescriptions and notes per individual appointment — there is no aggregated view across all past consultations. This feature adds a backend endpoint and a frontend page that gives doctors access to the patient's medical profile and their complete consultation history (notes + prescriptions) in one place.

---

## Scope

**In scope:**
- Backend: New `GET /api/patients/:patientId/history` endpoint (doctor-only)
  - Returns patient medical profile + all completed appointments with their consultation notes and prescriptions
- Frontend: New page `/doctor/patients/:patientId` — `PatientMedicalHistoryPage`
- Frontend: "View Patient History" button in `DoctorAppointmentDetailPage` patient info section
- Route registered in the doctor router

**Out of scope:**
- Editing patient data from the doctor view (read-only)
- Patient-uploaded documents (covered by P2)
- Insurance info in this view (covered by P1)
- Filtering history by date range or attending doctor
- Exporting history as PDF

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/patients/patients.repository.ts` | Add `getPatientHistory(patientId)` |
| `src/modules/patients/patients.service.ts` | Add `getPatientHistory(requesterId, patientId)` |
| `src/modules/patients/patients.controller.ts` | Add `GET /:patientId/history` route |

No schema changes. No migration required.

### New Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/patients/:patientId/history` | `authenticate`, `requireRole('doctor')` | Patient medical profile + all completed appointments with notes and prescriptions |

### Response Shape

```ts
{
  patient: {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: string | null
    sex: string | null
    bloodType: string | null
    weightKg: number | null
    heightCm: number | null
    allergies: string | null
    currentMedications: string | null
    pastMedicalConditions: string | null
    familyMedicalHistory: string | null
    profilePictureUrl: string | null
  }
  consultationHistory: Array<{
    appointmentId: string
    scheduledAt: string
    notes: {
      chiefComplaint: string | null
      diagnosis: string | null
      notes: string | null
      followUpDate: string | null
    } | null
    prescriptions: Array<{
      id: string
      medicationName: string
      dosage: string
      frequency: string
      duration: string
      instructions: string | null
    }>
  }>
}
```

### Repository Method

`patientsRepository.getPatientHistory(patientId: string)`

To avoid N+1 queries:
1. Reuse existing `findById(patientId)` for the patient profile
2. `SELECT * FROM appointments WHERE patientId = patientId AND status = 'completed' ORDER BY scheduledAt DESC`
3. Collect all `appointmentId`s from step 2
4. `SELECT * FROM consultation_notes WHERE appointmentId IN (ids)`
5. `SELECT * FROM prescriptions WHERE appointmentId IN (ids) ORDER BY createdAt ASC`
6. Zip notes and prescriptions onto each appointment in the service layer

Return type:
```ts
{
  appointments: Appointment[]
  notesByAppointmentId: Record<string, ConsultationNote>
  prescriptionsByAppointmentId: Record<string, Prescription[]>
}
```

### Service Method

`patientsService.getPatientHistory(requesterId: string, patientId: string): Promise<PatientHistoryResult>`

- Fetch patient via `patientsRepository.findById(patientId)` — throws `AppError('Patient not found', 404)` if missing
- Fetch raw history via `patientsRepository.getPatientHistory(patientId)`
- Map appointments into `consultationHistory` array, attaching `notes` (or null) and `prescriptions` (or []) from the lookup maps
- Return `{ patient, consultationHistory }`

No ownership check needed — any authenticated doctor can view any patient's history, consistent with the existing `GET /api/patients/:id` behaviour.

### Controller Route

```ts
// GET /api/patients/:patientId/history — must be registered BEFORE /:id to avoid route collision
router.get('/:patientId/history', authenticate, requireRole('doctor'), async (req: AuthRequest, res: Response) => {
  const result = await patientsService.getPatientHistory(req.user!.id, req.params.patientId)
  res.status(200).json({ success: true, message: 'Patient history retrieved', data: result })
})
```

Register this route **before** the existing `GET /:id` route in `patients.controller.ts` to prevent Express from matching `"history"` as an ID param.

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/patients/api/patients.api.ts` | Add `getPatientHistory(patientId)` |
| `src/features/patients/hooks/usePatients.ts` | Add `usePatientHistory(patientId)` query |
| `src/features/users/doctor/PatientMedicalHistoryPage.tsx` | New page |
| `src/app/routes/doctorRoutes.tsx` | Add `/doctor/patients/:patientId` route |
| `src/features/users/doctor/DoctorAppointmentDetailPage.tsx` | Add "View Patient History" button |

### New API Function and Hook

```ts
// patients.api.ts
export const getPatientHistory = (patientId: string) =>
  api.get(`/patients/${patientId}/history`).then(r => r.data.data)

// usePatients.ts
export const usePatientHistory = (patientId: string) =>
  useQuery({
    queryKey: ['patient-history', patientId],
    queryFn: () => getPatientHistory(patientId),
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
  })
```

### New Page: `PatientMedicalHistoryPage.tsx`

Route: `/doctor/patients/:patientId`

Layout:
```
[← Back to Appointment]         Patient Medical History

┌─────────────────────────────────────────────────────┐
│  [Avatar]  Patient Name                             │
│            DOB · Sex · Blood Type                   │
│            Weight: ___ kg   Height: ___ cm          │
├─────────────────────────────────────────────────────┤
│ Allergies                                           │
│  [text or "None recorded"]                          │
├─────────────────────────────────────────────────────┤
│ Current Medications                                 │
│  [text or "None recorded"]                          │
├─────────────────────────────────────────────────────┤
│ Past Medical Conditions                             │
│  [text or "None recorded"]                          │
├─────────────────────────────────────────────────────┤
│ Family Medical History                              │
│  [text or "None recorded"]                          │
└─────────────────────────────────────────────────────┘

Consultation History
┌─────────────────────────────────────────────────────┐
│ May 15, 2026                                        │
│ Chief Complaint: Headache                           │
│ Diagnosis: Migraine                                 │
│ Notes: Advised rest and hydration...               │
│ Follow-up: May 22, 2026                             │
│                                                     │
│ Prescriptions                                       │
│  • Ibuprofen 400mg — 3x/day — 5 days               │
│  • Sumatriptan 50mg — as needed                    │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ April 3, 2026                                       │
│ ...                                                 │
└─────────────────────────────────────────────────────┘

[Empty state — "No completed consultations on record."]
```

Page states:
- Loading: skeleton for profile card + 2–3 skeleton consultation entries
- Error: "Failed to load patient history. Try again."
- Consultation list empty: "No completed consultations on record."
- Field empty: show "None recorded" in place of blank text

### DoctorAppointmentDetailPage Change

In the patient info section, add a link button:

```tsx
<Link to={`/doctor/patients/${appointment.patientId}`}>
  View Patient History
</Link>
```

Styled as a secondary/outline button. Placed below the patient name and basic info.

---

## Implementation Steps

1. **(BE)** Add `getPatientHistory(patientId)` to `patients.repository.ts` — batch-select completed appointments, then consultation_notes and prescriptions by appointment ID set
2. **(BE)** Add `getPatientHistory(requesterId, patientId)` to `patients.service.ts` — fetch profile + join history data
3. **(BE)** Register `GET /:patientId/history` in `patients.controller.ts` **before** the `GET /:id` route
4. **(FE)** Add `getPatientHistory` to `patients.api.ts`
5. **(FE)** Add `usePatientHistory` hook to `usePatients.ts`
6. **(FE)** Create `PatientMedicalHistoryPage.tsx`
7. **(FE)** Add `/doctor/patients/:patientId` to doctor routes
8. **(FE)** Add "View Patient History" link in `DoctorAppointmentDetailPage.tsx`

---

## Verification

1. In `DoctorAppointmentDetailPage`, a "View Patient History" button is visible in the patient section.
2. Clicking it navigates to `/doctor/patients/:patientId`.
3. Patient medical profile renders: blood type, sex, DOB, weight, height, allergies, current medications, past conditions, family history.
4. Fields with no value show "None recorded" rather than blank.
5. Completed appointments appear in reverse chronological order.
6. Each consultation entry shows: date, chief complaint, diagnosis, clinical notes, follow-up date, and prescriptions list.
7. An appointment with no consultation notes shows the notes block as absent or with empty fields.
8. An appointment with no prescriptions shows "No prescriptions recorded."
9. A patient with no completed appointments shows the empty state message.
10. `GET /api/patients/:patientId/history` returns 403 if called by a patient-role token.
11. `GET /api/patients/:patientId/history` returns 404 if the patientId does not exist.
12. Back button / breadcrumb navigates back correctly.
