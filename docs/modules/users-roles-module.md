# Users & Roles Module

## 1. Purpose

Manage shared user identity records and RBAC. Provide profile read/update for the base `users` table. Handle avatar uploads via Cloudinary. The role/permission system is data-driven — no hardcoded role checks beyond middleware.

---

## 2. Required Features

- Get user by ID
- Update user basic fields (first name, last name, phone)
- Upload/replace profile picture (Cloudinary)
- RBAC infrastructure: roles, permissions, role_permissions, user_roles (seeded, not managed via API in MVP)

---

## 3. Out-of-Scope Features

- Role management via API (roles are seeded only)
- Permission management via API
- Admin user management UI
- Audit logging
- Account deactivation via API (is_active managed internally)
- Soft delete via API endpoint
- Email change / password change

---

## 4. Backend Responsibilities

### Files

```
src/modules/users/
├── users.controller.ts
├── users.service.ts
├── users.repository.ts
└── users.schema.ts
```

### users.schema.ts

Drizzle table definitions:

```
users             — core identity
roles             — seeded: patient, doctor
permissions       — seeded: fine-grained flags
role_permissions  — many-to-many join
user_roles        — many-to-many join
```

Zod validators:

```ts
updateUserSchema: {
  firstName: z.string().min(1).max(100).optional()
  lastName:  z.string().min(1).max(100).optional()
  phone:     z.string().max(20).optional()
}
```

### users.repository.ts

```ts
findById(id: string): Promise<User | null>
updateById(id: string, data: Partial<UpdateUserData>): Promise<User>
updateAvatar(id: string, url: string): Promise<User>
findRoleByName(name: string): Promise<Role | null>
findPermissionsByRoleId(roleId: string): Promise<Permission[]>
```

### users.service.ts

```ts
getUserById(id: string): Promise<User>
  // Throws 404 if not found

updateUser(requesterId: string, targetId: string, data: UpdateUserData): Promise<User>
  // Throws 403 if requesterId !== targetId

uploadAvatar(userId: string, fileBuffer: Buffer, mimeType: string): Promise<User>
  // Uploads to Cloudinary, updates profile_picture_url
  // Returns updated user
```

### users.controller.ts

```
GET  /api/users/:id        → users.service.getUserById()     → 200
PUT  /api/users/:id        → users.service.updateUser()      → 200
POST /api/users/:id/avatar → users.service.uploadAvatar()    → 200
```

### Cloudinary Integration

- Use `cloudinary` npm package (add to backend)
- Upload from buffer, not temp file
- Store returned `secure_url` in `profile_picture_url`
- Overwrite existing avatar by public_id: `telehealth/avatars/{userId}`

---

## 5. Frontend Responsibilities

### Files

```
src/features/users/
├── api/
│   └── users.api.ts          # getUser(), updateUser(), uploadAvatar()
├── components/
│   ├── AvatarUpload.tsx       # Drag/click upload, preview, submit
│   └── ProfileCard.tsx        # Display-only card: avatar, name, role badge
├── hooks/
│   └── useUser.ts             # useQuery wrapper for getUser
├── patient/
│   └── PatientProfilePage.tsx
├── doctor/
│   └── DoctorProfilePage.tsx
└── types/
    └── index.ts               # User, UpdateUserDto
```

### AvatarUpload.tsx

- Accepts image file (JPG, PNG, WebP)
- Shows preview before upload
- Uploads via `POST /api/users/:id/avatar` with `multipart/form-data`
- Shows loading state during upload
- Shows new avatar after success

### users.api.ts

```ts
getUser(id: string): Promise<User>
updateUser(id: string, dto: UpdateUserDto): Promise<User>
uploadAvatar(id: string, file: File): Promise<User>
```

---

## 6. Database Tables

| Table | Role |
|---|---|
| `users` | Core identity — read/write |
| `roles` | Read-only (seeded) |
| `permissions` | Read-only (seeded) |
| `role_permissions` | Read-only (seeded) |
| `user_roles` | Read-only after registration |

### Seed Data (run once)

```
roles:
  - { name: 'patient', description: 'Patient user' }
  - { name: 'doctor',  description: 'Doctor user' }

permissions:
  appointments:create, appointments:read, appointments:update, appointments:cancel
  doctors:read
  patients:read, patients:update
  notes:create, notes:read
  prescriptions:create, prescriptions:read
  availability:manage
  notifications:read

role_permissions:
  patient → [appointments:create, appointments:read, appointments:update, appointments:cancel,
             doctors:read, patients:read, patients:update, prescriptions:read, notifications:read]
  doctor  → [appointments:read, appointments:update, patients:read,
             notes:create, notes:read, prescriptions:create, prescriptions:read,
             availability:manage, notifications:read]
```

---

## 7. API Endpoints

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/users/:id` | JWT required | — | `User` |
| PUT | `/api/users/:id` | JWT required (own) | `updateUserSchema` | `User` |
| POST | `/api/users/:id/avatar` | JWT required (own) | `multipart/form-data` | `User` |

---

## 8. Validation Rules

```
PUT /api/users/:id
  firstName: optional, min 1, max 100
  lastName:  optional, min 1, max 100
  phone:     optional, max 20

POST /api/users/:id/avatar
  file: required, image type, max 5MB
```

Authorization:
- Users can only update/upload for their own ID
- `requesterId !== targetId` → 403

---

## 9. UI Screens

These screens live in the `patients` and `doctors` modules respectively — the `users` module provides shared components only.

### Shared: AvatarUpload.tsx
- Shows current avatar (or initials fallback)
- Click to select file → preview → "Save" button
- Used inside both PatientProfilePage and DoctorProfilePage

### Shared: ProfileCard.tsx
- Avatar, full name, role badge, email
- Read-only display component
- Used in appointment detail pages

---

## 10. Dependencies

- Depends on: auth module (for `authenticate` middleware)
- Required by: patients module, doctors module (both use user data + avatar upload)
- Cloudinary credentials must be in `.env` before avatar upload works

---

## 11. Completion Criteria

- [ ] `GET /api/users/:id` returns user with roles
- [ ] `PUT /api/users/:id` updates name and phone; rejects if requester ≠ target
- [ ] `POST /api/users/:id/avatar` uploads to Cloudinary and updates `profile_picture_url`
- [ ] Seed script populates roles, permissions, role_permissions
- [ ] `AvatarUpload.tsx` shows preview, uploads, and reflects new avatar
- [ ] `ProfileCard.tsx` renders with initials fallback when no avatar
