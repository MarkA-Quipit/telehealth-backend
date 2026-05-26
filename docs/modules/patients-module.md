# Patients Module

## 1. Purpose

Manage patient-specific profile data that extends the base `users` record. Stores medical context (DOB, weight, height, blood type, allergies, medical history) and emergency contact. Provides the patient profile page for self-editing.

---

## 2. Required Features

- Get patient profile (by patient ID or by user ID)
- Update patient profile fields
- Read medical history summary (allergies, blood type) for doctor view
- Emergency contact management

---

## 3. Out-of-Scope Features

- Patient list for admin
- Patient deactivation
- Medical history versioning / audit trail
- Structured medication list (free-text only for MVP)
- File/document uploads for medical records
- Insurance information
- Lab results

---

## 4. Backend Responsibilities

### Files

```
src/modules/patients/
├── patients.controller.ts
├── patients.service.ts
├── patients.repository.ts
└── patients.schema.ts
```

### patients.schema.ts

Drizzle table definition:

```ts
patients: {
  id:                     uuid PK
  user_id:                uuid FK → users (unique)
  date_of_birth:          date, nullable
  weight_kg:              decimal(5,2), nullable
  height_cm:              decimal(5,2), nullable
  blood_type:             varchar(5), nullable  -- 'A+', 'O-', etc.
  allergies:              text, nullable
  medical_history:        text, nullable
  emergency_contact_name: varchar(100), nullable
  emergency_contact_phone: varchar(20), nullable
  created_at:             timestamp
  updated_at:             timestamp
}
```

Zod validators:

```ts
updatePatientSchema: {
  dateOfBirth:           z.string().date().optional()  // YYYY-MM-DD
  weightKg:              z.number().positive().optional()
  heightCm:              z.number().positive().optional()
  bloodType:             z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional()
  allergies:             z.string().max(1000).optional()
  medicalHistory:        z.string().max(2000).optional()
  emergencyContactName:  z.string().max(100).optional()
  emergencyContactPhone: z.string().max(20).optional()
}
```

### patients.repository.ts

```ts
findByUserId(userId: string): Promise<Patient | null>
findById(patientId: string): Promise<Patient | null>
upsert(userId: string, data: Partial<PatientData>): Promise<Patient>
  // INSERT ... ON CONFLICT (user_id) DO UPDATE
```

### patients.service.ts

```ts
getPatientProfile(patientId: string): Promise<PatientWithUser>
  // Joins patient + user fields
  // Throws 404 if not found

getPatientProfileByUserId(userId: string): Promise<PatientWithUser>

updatePatientProfile(requesterId: string, patientId: string, data: UpdatePatientDto): Promise<PatientWithUser>
  // Validates requester owns this patient profile
  // Throws 403 if unauthorized
```

### patients.controller.ts

```
GET /api/patients/:id  → patients.service.getPatientProfile()       → 200
PUT /api/patients/:id  → patients.service.updatePatientProfile()     → 200
```

---

## 5. Frontend Responsibilities

### Files

```
src/features/users/patient/
└── PatientProfilePage.tsx
```

Uses shared components from `src/features/users/components/`:
- `AvatarUpload.tsx`
- `ProfileCard.tsx`

### PatientProfilePage.tsx

Sections:
1. **Personal Info** — First name, Last name, Phone (from `users` table via `PUT /api/users/:id`)
2. **Avatar** — AvatarUpload component
3. **Medical Info** — DOB, Weight (kg), Height (cm), Blood Type (dropdown), Allergies (textarea), Medical History (textarea)
4. **Emergency Contact** — Name, Phone

Each section: Save button per section, or unified Save at bottom (unified is simpler — go unified).

Form state: React Hook Form. Submit: `PUT /api/patients/:id` + `PUT /api/users/:id` (parallel if both changed).

---

## 6. Database Tables

| Table | Role |
|---|---|
| `patients` | Primary — read/write |
| `users` | Joined for full profile display |

---

## 7. API Endpoints

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/patients/:id` | JWT required | — | `PatientWithUser` |
| PUT | `/api/patients/:id` | JWT required (own) | `updatePatientSchema` | `PatientWithUser` |

Authorization:
- Patients can only update their own profile
- Doctors can GET any patient profile (for appointment context)

---

## 8. Validation Rules

```
dateOfBirth:           optional, ISO date string (YYYY-MM-DD)
weightKg:              optional, positive number
heightCm:              optional, positive number
bloodType:             optional, enum ['A+','A-','B+','B-','AB+','AB-','O+','O-']
allergies:             optional, max 1000 chars
medicalHistory:        optional, max 2000 chars
emergencyContactName:  optional, max 100 chars
emergencyContactPhone: optional, max 20 chars
```

---

## 9. UI Screens

### `/patient/profile` — PatientProfilePage

Layout:
```
[Avatar + Name + Role Badge]         ← ProfileCard (read-only display)
[Avatar Upload]

[Personal Information Card]
  First Name | Last Name
  Phone

[Medical Information Card]
  Date of Birth | Blood Type
  Weight (kg)   | Height (cm)
  Allergies          ← textarea
  Medical History    ← textarea

[Emergency Contact Card]
  Name | Phone

[Save Changes Button]
```

- Loading skeleton while fetching
- Success toast: "Profile updated successfully"
- Error shown below form if save fails

---

## 10. Dependencies

- Depends on: auth module (middleware), users module (AvatarUpload, ProfileCard)
- Required by: appointments module (patient info shown on appointment detail for doctors)

---

## 11. Completion Criteria

- [ ] `GET /api/patients/:id` returns patient + joined user fields
- [ ] `PUT /api/patients/:id` saves all medical fields, rejects if not own profile
- [ ] Patient profile page loads current values on mount
- [ ] All fields editable and save correctly
- [ ] Avatar upload works from profile page
- [ ] Doctor viewing appointment detail can see patient medical info via this endpoint
