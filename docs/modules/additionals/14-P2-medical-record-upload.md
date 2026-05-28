# P2 — Medical Record Document Upload

**Type:** FULL
**Status:** To Do
**Priority:** 14

---

## Purpose

Patients should be able to upload medical documents (lab results, prescriptions, imaging reports) to their profile. These are stored via Cloudinary (already configured) and tracked in a new `patient_documents` table. Doctors reviewing the patient's profile can then see and access the documents.

---

## Scope

**In scope:**
- Backend: New `patient_documents` table and Drizzle migration
- Backend: `POST /api/patients/:id/documents` — multer upload + Cloudinary, returns document list
- Backend: `GET /api/patients/:id/documents` — list all documents for a patient
- Frontend: Upload button + file list in `PatientProfilePage.tsx`

**Out of scope:**
- Document deletion
- Document sharing per-appointment (attach to a specific consultation)
- Viewing by doctors from their own dashboard (phase 2)
- PDF preview inline (link download is sufficient)
- Virus scanning

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/patients/patients.schema.ts` | Add `patientDocuments` Drizzle table |
| `src/modules/patients/patients.repository.ts` | Add `saveDocument` and `getDocuments` |
| `src/modules/patients/patients.service.ts` | Add `uploadDocument(patientId, file)` — Cloudinary upload + DB insert |
| `src/modules/patients/patients.controller.ts` | Add `POST /:id/documents` and `GET /:id/documents` routes (multer middleware) |
| `src/db/migrations/` | New migration for `patient_documents` table |

### Schema Changes

New table `patient_documents`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `defaultRandom()` |
| `patient_id` | uuid FK → patient_profiles | cascade delete |
| `url` | text | Cloudinary secure URL |
| `file_name` | varchar(255) | original file name |
| `file_type` | varchar(100) | MIME type (e.g., `application/pdf`) |
| `uploaded_at` | timestamp | `defaultNow()` |

Migration required: yes.

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/patients/:id/documents` | `authenticate`, `requireRole('patient')` | Upload a document via multipart/form-data |
| GET | `/api/patients/:id/documents` | `authenticate` | List all documents for the patient |

### Service / Repository Methods

- `patientsRepository.saveDocument(patientId, url, fileName, fileType)` — insert into `patient_documents`
- `patientsRepository.getDocuments(patientId)` — select all for patient ordered by `uploadedAt` desc
- `patientsService.uploadDocument(patientId, file)`:
  1. Upload `file.buffer` to Cloudinary (`cloudinary.uploader.upload_stream` or `upload`)
  2. Get back `secure_url`
  3. Call `saveDocument(patientId, secure_url, file.originalname, file.mimetype)`
  4. Return full document list for the patient

**Multer config:** memory storage, max size 10MB, accept `image/*` and `application/pdf`.

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/users/patient/PatientProfilePage.tsx` | Add upload button + document list section |
| `src/features/patients/api/patients.api.ts` | Add `uploadDocument(patientId, file)` and `getDocuments(patientId)` |
| `src/features/patients/hooks/usePatients.ts` | Add `useDocuments(patientId)` query and `useUploadDocument()` mutation |

### New Hooks / API Functions

- `uploadDocument(patientId, file)` — `api.post(`/patients/${patientId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })`
- `getDocuments(patientId)` — `api.get(`/patients/${patientId}/documents`)`
- `useDocuments(patientId)` — `useQuery`
- `useUploadDocument()` — `useMutation`; on success invalidate documents query + toast "Document uploaded"

**Upload UI:**
- `<input type="file" accept=".pdf,image/*">` hidden behind a styled button
- Show upload progress or loading spinner while uploading
- Document list: file name + upload date + download link (opens `url` in new tab)

---

## Implementation Steps

1. (BE) Add `patientDocuments` table to `patients.schema.ts` and generate + run migration.
2. (BE) Add `saveDocument` and `getDocuments` to `patients.repository.ts`.
3. (BE) Add `uploadDocument` to `patients.service.ts` (Cloudinary upload + DB insert).
4. (BE) Register `POST /:id/documents` (with multer) and `GET /:id/documents` in `patients.controller.ts`.
5. (FE) Add API functions to `patients.api.ts`.
6. (FE) Add hooks to `usePatients.ts`.
7. (FE) Build the upload button + file list section in `PatientProfilePage.tsx`.

---

## Verification

1. Go to patient profile — "Documents" section visible with upload button.
2. Upload a PDF — loading indicator shows, then document appears in the list.
3. Upload an image — same flow.
4. Click a document's download/view link — opens in new tab.
5. Reload the page — uploaded documents persist.
6. Upload a file > 10MB — receive a clear error message.
7. `GET /api/patients/:id/documents` returns the document list in correct order (newest first).
