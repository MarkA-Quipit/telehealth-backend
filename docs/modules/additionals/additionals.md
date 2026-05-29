# Additional Features — Work Tracking

> Tracks all out-of-scope feature additions beyond the original MVP. Updated as of **2026-05-29**.

---

## ✅ Done

### DOC — `09-current-implementation.md`
- Created `docs/09-current-implementation.md`
- Ground-truth snapshot of the full system: all API endpoints, frontend routes, DB schema, integrations, known bugs, deployment gaps, admin module note

---

### M1 — Shadcn Sidebar (All Pages)

**Status:** Complete

**What changed:**
- `src/shared/ui/sidebar.tsx` — new file, full Shadcn sidebar primitive set (`SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarInset`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuBadge`, `SidebarSeparator`, `useSidebar`)
- `src/shared/components/layout/Sidebar.tsx` — rewritten as `AppSidebar` using the new shadcn primitives. Logo moved into `SidebarHeader`. Nav items use `SidebarMenuButton asChild` + `NavLink` with `isActive` via `useLocation`.
- `src/app/layouts/MainLayout.tsx` — wrapped with `SidebarProvider` + `SidebarInset`. Removed old flex layout.
- `src/shared/components/layout/Header.tsx` — logo removed (now in sidebar), `SidebarTrigger` added on the left side.

**Features:**
- Desktop: fixed sidebar with toggle (collapse/expand via `SidebarTrigger` or `Ctrl/Cmd+B`)
- Mobile: overlay drawer triggered by `SidebarTrigger`
- CSS variables for sidebar width from `index.css` (`--sidebar`, `--sidebar-foreground`, etc.)

---

### M2 — Data Privacy Act Checkbox (Registration)

**Status:** Complete

**What changed:**
- `src/shared/ui/dialog.tsx` — new Shadcn Dialog primitive (`Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogTrigger`, `DialogClose`)
- `src/shared/ui/checkbox.tsx` — new Shadcn Checkbox primitive
- `src/features/auth/components/RegisterForm.tsx` — added:
  - `Checkbox` with label before submit button
  - Clickable "Data Privacy Act of 2012 (Republic Act No. 10173)" link opens a `Dialog`
  - Dialog body: scrollable summary of RA 10173 (what we collect, how we use it, user rights)
  - Dialog footer: sticky — "Close" button + "I understand & agree" button (checks the checkbox and closes)
  - Submit is blocked with an inline error if checkbox is not checked

---

### AP1 — Reschedule Flow *(FULL)*

Backend + frontend complete. `PATCH /api/appointments/:id/reschedule`. Frontend: `AppointmentDetailPage.tsx` reschedule dialog with date picker + slot grid, navigates to new appointment on success.

---

### P3 — Doctor View of Patient Medical History *(FULL)*

`GET /api/patients/:patientId/history` (doctor-only). Frontend: `PatientMedicalHistoryPage.tsx` at `/doctor/patients/:patientId` + "View Full Patient History →" link in `DoctorAppointmentDetailPage.tsx`.

---

### D1 — Doctor Ratings UI *(FE)*

`DoctorCard.tsx` — star rating + review count. `DoctorProfilePage.tsx` — average rating, star breakdown bars, full review list with patient name/avatar/date/comment. Empty state handled.

---

### D2 — Consultation Count on DoctorCard *(FE)*

`DoctorCard.tsx` renders `completedConsultationsCount`. Hidden when zero.

---

### AI2 — Symptom Pre-fill to Booking *(FE)*

`SymptomChecker.tsx` — compact doctor cards navigate to `/patient/appointments/book` with `{ state: { symptoms, doctorId } }`. `BookAppointmentPage.tsx` reads `location.state?.symptoms` as initial `reasonForVisit`.

---

## 🔄 In Progress

*(none)*

---

## 📋 To Do

Priority order matches the plan. Items marked **(BE)** = backend only, **(FE)** = frontend only, **(FULL)** = both.

---

### C2 — Session Duration Display *(FE)*

Calculate `(endsAt - scheduledAt)` in minutes. Show "30-min session" badge in:
- `AppointmentDetailPage.tsx` detail section
- `AppointmentCard.tsx` (already shows `durationMinutes`)
- `ConsultationPage.tsx` (patient + doctor) — show session length indicator

---

### A6 — Password Change *(FULL)*

- **Backend:** `POST /api/users/:id/change-password` in `users.controller.ts`. Body: `{ currentPassword, newPassword }`. Verifies bcrypt hash, updates `passwordHash`. Add to `users.service.ts` + `users.repository.ts`.
- **Frontend:** Form in `PatientProfilePage.tsx` and `DoctorProfilePage.tsx` (users section) — two-field form: Current password, New password.

---

### A1 — Refresh Tokens *(FULL)*

- **Backend:**
  - New `refresh_tokens` table: `id, userId FK, token (hashed), expiresAt, revokedAt, createdAt`
  - New migration
  - `auth.service.ts`: on login, generate short-lived access token (15 min) + long-lived refresh token (7 days), store hashed refresh token in DB
  - New endpoint: `POST /api/auth/refresh` — validates refresh token, issues new access token
  - `auth.router.ts`: add refresh route
- **Frontend:**
  - `src/shared/lib/api.ts` — Axios response interceptor: on 401, call `POST /api/auth/refresh`, retry the original request once

---

### A2 — Session Management (Logout All Devices) *(FULL)*

*Depends on A1 being done first.*

- **Backend:** `POST /api/auth/logout-all` — marks all refresh tokens for the user as revoked (`revokedAt = now()`)
- **Frontend:** "Logout from all devices" button in profile page(s)

---

### AP2 — iCal / Calendar Export *(FULL)*

- **Backend:** `GET /api/appointments/:id/calendar` — generates RFC 5545 `.ics` file as plain text response (`Content-Type: text/calendar`, `Content-Disposition: attachment`). No new dependencies needed.
- **Frontend:** "Add to Calendar" download link on `AppointmentDetailPage.tsx` — an anchor pointing to the API route with the JWT token passed as query param (or use `api.get` + blob download).

---

### C1 — In-Consultation Text Chat *(FULL)*

- **Backend:** New Pusher channel per appointment: `consultation-{appointmentId}`. New endpoint `POST /api/appointments/:id/chat` — body: `{ message }`. Triggers Pusher event on the channel. Optional: store in a `chat_messages` table for persistence.
- **Frontend:** Chat panel overlay inside `ConsultationPage.tsx` (both patient + doctor). Subscribe to `consultation-{appointmentId}` on mount. Input at bottom, messages scroll above Jitsi embed.

---

### P1 — Insurance Info Fields *(FULL)*

- **Backend:** Add `insuranceProvider varchar(150)` and `insurancePolicyNumber varchar(100)` to `patient_profiles` table. New Drizzle migration. Expose in `PUT /api/patients/:id` and `GET /api/patients/:id`.
- **Frontend:** Two new fields in `PatientProfilePage.tsx` medical info section.

---

### P2 — Medical Record Document Upload *(FULL)*

- **Backend:** New `patient_documents` table: `id, patientId FK, url, fileName, fileType, uploadedAt`. New endpoint `POST /api/patients/:id/documents` — multer + Cloudinary upload, returns document list.
- **Frontend:** Upload button + file list in `PatientProfilePage.tsx`. Cloudinary already configured.

---

### D3 — Custom Slot Durations *(FULL)*

- **Backend:** `doctor_availability.slotDurationMinutes` already exists (default 30) but the slot generation in `doctors.service.ts` hardcodes 30. Fix service to use the stored value when generating slots. Also fix conflict detection to use appointment `durationMinutes`.
- **Frontend:** Slot duration selector (15/30/45/60 min) in `DoctorAvailabilityPage.tsx` per-day form.

---

### D4 — Recurring Blocked Slots *(FULL)*

- **Backend:** Add optional `recurrenceType enum('none', 'weekly')` to `doctor_blocked_slots` table. New migration. In slot generation service: when checking blocked slots for a date, also expand weekly-recurring blocks (check if blockedDate's day-of-week matches + time overlaps).
- **Frontend:** Toggle "Repeat weekly" in the blocked slot creation form in `DoctorAvailabilityPage.tsx`.

---

### C3 — Doctor/Patient Join Status Indicator *(FULL)*

- **Backend:** Add `patientJoinedAt timestamp`, `doctorJoinedAt timestamp` to `appointments` table. New migration. New endpoint `PATCH /api/appointments/:id/join` — sets the appropriate field based on requester role. Triggers Pusher event `user_joined` on `appointment-{id}` channel.
- **Frontend:** Both `ConsultationPage.tsx` files subscribe to `appointment-{id}` channel. On mount: call join endpoint. Show "Waiting for Dr. [Name]…" or "Patient is in the room" indicator.

---

### N2 — Notification Filtering by Type *(FULL)*

- **Backend:** Add optional `?type=appointment_booked|appointment_confirmed|...` query param to `GET /api/notifications`. Add WHERE clause in `notifications.repository.ts`.
- **Frontend:** Filter tabs (All / Bookings / Confirmations / Cancellations) in `NotificationList.tsx` dropdown.

---

### N3 — Notification Pagination *(FULL)*

- **Backend:** Add `?page=&limit=` to `GET /api/notifications`. Update repository to use `.limit().offset()`.
- **Frontend:** "Load more" button at the bottom of `NotificationList.tsx`.

---

### AI1 — AI Recommendation History Logging *(FULL)*

- **Backend:** New `ai_recommendation_logs` table: `id, userId FK, symptoms text, recommendations JSONB, createdAt`. Insert after successful Groq response in `ai.service.ts`.
- **Frontend (optional):** "Recent searches" collapsible section in `SymptomChecker.tsx` — query `GET /api/ai/history` (new endpoint).

---

### P3 — Doctor View of Patient Medical History *(FULL)*

New `GET /api/patients/:patientId/history` endpoint (doctor-only) + frontend page `/doctor/patients/:patientId`.

- **Backend:** `getPatientHistory` in repository (batch-selects completed appointments + consultation_notes + prescriptions) + service + controller. Register route **before** `GET /:id` to avoid param collision.
- **Frontend:** `PatientMedicalHistoryPage.tsx` — patient medical profile card + reverse-chronological consultation history with notes and prescriptions. Add "View Patient History" link in `DoctorAppointmentDetailPage.tsx`. New route in doctor routes.

---

### AI3 — Streaming AI Response *(FULL)*

- **Backend:** Switch `ai.service.ts` from `groq.chat.completions.create()` to streaming version. Stream via SSE (`Content-Type: text/event-stream`). Controller sets appropriate headers and streams tokens.
- **Frontend:** `SymptomChecker.tsx` — use `EventSource` or `fetch` with readable stream to render tokens as they arrive.

---

## 🔒 Admin Module — Not Started (Future Only)

The `admin` role is seeded. No endpoints or pages built. Planned scope:
- User list + deactivate/reactivate (patients + doctors)
- Doctor verification toggle (`isVerified`)
- System-wide appointment overview
- Notification broadcast
- AI recommendation log viewer

**Will not be built in this session.**
