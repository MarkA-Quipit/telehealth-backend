# Current Priority

> Updated: **2026-05-28**

---

## 🔴 Highest Priority — Build Next

### P3 — Doctor View of Patient Medical History

**Doc:** `22-P3-patient-medical-history-doctor-view.md`
**Type:** FULL (backend + frontend)

**Why first:** Core clinical workflow gap — doctors cannot see a patient's full history across appointments without navigating each one individually. Blocks effective consultation.

**Implementation plan:** `/Users/markaldrinquipit/.claude/plans/fancy-dancing-cerf.md`

**10-step build order:**

| # | Layer | File | Change |
|---|-------|------|--------|
| 1 | BE | `src/modules/patients/patients.repository.ts` | Add `getPatientHistory(patientId)` — batch-queries completed appointments + notes + prescriptions |
| 2 | BE | `src/modules/patients/patients.service.ts` | Add `getPatientHistory(requesterId, patientId)` — assembles response |
| 3 | BE | `src/modules/patients/patients.controller.ts` | Add `GET /:patientId/history` (doctor-only) before `GET /:id` |
| 4 | FE | `src/shared/constants/queryKeys.ts` | Add `patients.history(id)` key |
| 5 | FE | `src/features/patients/types/index.ts` | Add `PatientHistoryEntry` + `PatientMedicalHistory` types |
| 6 | FE | `src/features/patients/api/patients.api.ts` | Add `getPatientHistory(patientId)` |
| 7 | FE | `src/features/patients/hooks/usePatient.ts` | Add `usePatientHistory(patientId)` |
| 8 | FE | `src/features/users/doctor/PatientMedicalHistoryPage.tsx` | New page — profile card + consultation history list |
| 9 | FE | `src/app/router/index.tsx` | Add `/doctor/patients/:patientId` route |
| 10 | FE | `src/features/appointments/doctor/DoctorAppointmentDetailPage.tsx` | Add "View Full Patient History →" link in patient info section |

---

## 📋 Everything Else

Remaining items in their original priority order — see `additionals.md`.
