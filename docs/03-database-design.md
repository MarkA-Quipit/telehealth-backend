# 03 — Database Design

PostgreSQL 17 on Neon.tech, managed via Drizzle ORM.

## Entity Relationship Overview

```
users ──── user_roles ──── roles ──── role_permissions ──── permissions
  │
  ├── patients (1:1)
  │     └── appointments (1:N)
  │           ├── consultation_notes (1:1)
  │           └── prescriptions (1:N)
  │
  └── doctors (1:1)
        └── doctor_availability (1:N)
```

## Tables

### `users`
Core identity record shared by all roles.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Default `gen_random_uuid()` |
| `email` | varchar(255) | Unique, not null |
| `password_hash` | text | bcryptjs hash |
| `first_name` | varchar(100) | Not null |
| `last_name` | varchar(100) | Not null |
| `profile_picture_url` | text | Cloudinary URL, nullable |
| `phone` | varchar(20) | Nullable |
| `is_active` | boolean | Default true |
| `created_at` | timestamp | Default now() |
| `updated_at` | timestamp | Auto-updated |

### `roles`
Seeded: `patient`, `doctor`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar(50) | Unique (e.g., `patient`, `doctor`) |
| `description` | text | Nullable |
| `created_at` | timestamp | |

### `permissions`
Fine-grained action flags. Seeded with all required permissions.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar(100) | Unique (e.g., `appointments:create`) |
| `description` | text | Nullable |

### `role_permissions`
Many-to-many: roles ↔ permissions.

| Column | Type | Notes |
|---|---|---|
| `role_id` | uuid FK → roles | |
| `permission_id` | uuid FK → permissions | |
| PK | composite | (role_id, permission_id) |

### `user_roles`
Many-to-many: users ↔ roles.

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid FK → users | |
| `role_id` | uuid FK → roles | |
| PK | composite | (user_id, role_id) |

### `patients`
One-to-one extension of `users` for patient-specific data.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Unique |
| `date_of_birth` | date | Nullable |
| `weight_kg` | decimal(5,2) | Nullable |
| `height_cm` | decimal(5,2) | Nullable |
| `blood_type` | varchar(5) | Nullable |
| `allergies` | text | Nullable, freetext |
| `medical_history` | text | Nullable, freetext |
| `emergency_contact_name` | varchar(100) | Nullable |
| `emergency_contact_phone` | varchar(20) | Nullable |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `doctors`
One-to-one extension of `users` for doctor-specific data.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Unique |
| `specialization` | varchar(100) | Not null |
| `bio` | text | Nullable |
| `license_number` | varchar(50) | Nullable |
| `years_of_experience` | integer | Nullable |
| `consultation_fee` | decimal(10,2) | Nullable |
| `is_accepting_patients` | boolean | Default true |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `doctor_availability`
Recurring weekly schedule slots per doctor.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `doctor_id` | uuid FK → doctors | |
| `day_of_week` | integer | 0=Sun, 1=Mon … 6=Sat |
| `start_time` | time | e.g., `09:00` |
| `end_time` | time | e.g., `17:00` |
| `is_available` | boolean | Default true |
| `created_at` | timestamp | |

### `doctor_blocked_slots`
One-off unavailable periods (overrides availability).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `doctor_id` | uuid FK → doctors | |
| `blocked_date` | date | Not null |
| `start_time` | time | Not null |
| `end_time` | time | Not null |
| `reason` | text | Nullable |
| `created_at` | timestamp | |

### `appointments`
Core booking record.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Used as Jitsi room ID |
| `patient_id` | uuid FK → patients | |
| `doctor_id` | uuid FK → doctors | |
| `scheduled_at` | timestamp | Date + time of appointment |
| `duration_minutes` | integer | Default 30 |
| `status` | varchar(20) | `pending`, `confirmed`, `cancelled`, `completed` |
| `reason_for_visit` | text | Patient-provided, nullable |
| `cancellation_reason` | text | Nullable |
| `cancelled_by` | uuid FK → users | Nullable |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

Status transitions:
```
pending → confirmed → completed
       ↘             ↗
        cancelled
```

### `consultation_notes`
Doctor-authored notes after a session. One per appointment.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `appointment_id` | uuid FK → appointments | Unique |
| `doctor_id` | uuid FK → doctors | |
| `patient_id` | uuid FK → patients | |
| `chief_complaint` | text | Nullable |
| `diagnosis` | text | Nullable |
| `notes` | text | Nullable |
| `follow_up_date` | date | Nullable |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `prescriptions`
Prescriptions issued per appointment. One-to-many.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `appointment_id` | uuid FK → appointments | |
| `doctor_id` | uuid FK → doctors | |
| `patient_id` | uuid FK → patients | |
| `medication_name` | varchar(200) | Not null |
| `dosage` | varchar(100) | Nullable |
| `frequency` | varchar(100) | Nullable |
| `duration` | varchar(100) | Nullable |
| `instructions` | text | Nullable |
| `created_at` | timestamp | |

### `notifications`
Persisted notification records for history/unread count.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Recipient |
| `type` | varchar(50) | `appointment_booked`, `appointment_reminder`, `appointment_cancelled`, `schedule_update` |
| `title` | varchar(200) | |
| `message` | text | |
| `data` | jsonb | Related entity IDs (e.g., `{ appointmentId }`) |
| `is_read` | boolean | Default false |
| `created_at` | timestamp | |

## Indexes

```sql
-- Appointments
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- Availability
CREATE INDEX idx_availability_doctor ON doctor_availability(doctor_id);
CREATE INDEX idx_blocked_slots_doctor ON doctor_blocked_slots(doctor_id, blocked_date);
```

## Seed Data

Minimum seed for development:

```
roles:       patient, doctor
permissions: appointments:create, appointments:read, appointments:update, appointments:cancel,
             doctors:read, patients:read, patients:update,
             notes:create, notes:read, prescriptions:create, prescriptions:read,
             availability:manage, notifications:read
role_permissions: patient → [appointments:create/read/update/cancel, doctors:read, patients:read/update, prescriptions:read, notifications:read]
                  doctor  → [appointments:read/update, patients:read, notes:create/read, prescriptions:create/read, availability:manage, notifications:read]
```

## Migration Strategy

Use Drizzle Kit:

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# View current schema in Drizzle Studio
npx drizzle-kit studio
```

Migrations live in `drizzle/migrations/`. Never edit migration files manually after they've been applied.
