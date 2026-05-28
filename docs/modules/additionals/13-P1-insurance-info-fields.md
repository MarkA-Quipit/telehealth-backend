# P1 — Insurance Info Fields

**Type:** FULL
**Status:** To Do
**Priority:** 13

---

## Purpose

Patients should be able to store their insurance provider and policy number in their profile. This is a basic administrative need for telehealth — doctors or front desk staff may need to reference it. The data is stored on the existing `patient_profiles` table via a Drizzle migration.

---

## Scope

**In scope:**
- Backend: Add `insuranceProvider varchar(150)` and `insurancePolicyNumber varchar(100)` columns to `patient_profiles`
- Backend: New Drizzle migration
- Backend: Expose the fields in `GET /api/patients/:id` and `PUT /api/patients/:id`
- Frontend: Two new optional fields in `PatientProfilePage.tsx` medical info section

**Out of scope:**
- Insurance verification / eligibility lookup
- Linking insurance to appointment billing
- Validating policy number format

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/patients/patients.schema.ts` | Add `insuranceProvider` and `insurancePolicyNumber` columns to `patientProfiles` table |
| `src/modules/patients/patients.repository.ts` | Ensure `updatePatientProfile` includes the new fields |
| `src/modules/patients/patients.schema.ts` | Add fields to `updatePatientProfileSchema` Zod validator |
| `src/db/migrations/` | New migration: `ALTER TABLE patient_profiles ADD COLUMN insurance_provider varchar(150), ADD COLUMN insurance_policy_number varchar(100)` |

### Schema Changes

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `insurance_provider` | varchar(150) | yes | e.g., "PhilHealth", "Maxicare" |
| `insurance_policy_number` | varchar(100) | yes | free-text policy ID |

Migration required: yes.

### New Endpoints

No new endpoints — extend existing:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/patients/:id` | Now also returns `insuranceProvider`, `insurancePolicyNumber` |
| PUT | `/api/patients/:id` | Now also accepts `insuranceProvider`, `insurancePolicyNumber` |

### Service / Repository Methods

- `patientsRepository.updatePatientProfile` — add `insuranceProvider` and `insurancePolicyNumber` to the `set({ ... })` object
- `updatePatientProfileSchema` — add `insuranceProvider: z.string().max(150).optional()` and `insurancePolicyNumber: z.string().max(100).optional()`

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/patients/types/index.ts` | Add `insuranceProvider?: string` and `insurancePolicyNumber?: string` to patient profile type |
| `src/features/users/patient/PatientProfilePage.tsx` | Add two new input fields in the medical info section |

### New Hooks / API Functions

No new hooks needed — the existing `useUpdatePatientProfile` mutation already sends the full profile object.

---

## Implementation Steps

1. (BE) Add `insuranceProvider` and `insurancePolicyNumber` to the `patientProfiles` Drizzle table in `patients.schema.ts`.
2. (BE) Run `drizzle-kit generate` and `drizzle-kit migrate` to create and apply the migration.
3. (BE) Add `insuranceProvider` and `insurancePolicyNumber` to `updatePatientProfileSchema`.
4. (BE) Confirm `patientsRepository.updatePatientProfile` includes the new fields in its `.set()` call.
5. (FE) Update `PatientProfile` type to include the two optional fields.
6. (FE) In `PatientProfilePage.tsx`, add two new labeled inputs ("Insurance Provider" and "Policy Number") in the medical info section.
7. (FE) Bind them to the form state and include them in the profile update payload.

---

## Verification

1. Go to patient profile — two new fields: "Insurance Provider" and "Policy Number" visible in medical info section.
2. Fill in values and save — API `PUT /api/patients/:id` succeeds.
3. Reload the page — both fields retain the saved values.
4. Leave both fields empty and save — succeeds without error (fields are optional).
5. `GET /api/patients/:id` returns `insuranceProvider` and `insurancePolicyNumber` in the response.
