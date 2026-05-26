# 04 — API Conventions

## Base URL

```
Development:  http://localhost:3000/api
Production:   https://<render-or-railway-url>/api
```

Frontend reads this from `VITE_API_URL`.

## Response Envelope

All endpoints return this structure. No exceptions.

### Success
```json
{
  "success": true,
  "message": "Human-readable description",
  "data": { }
}
```

`data` is an object for single resources, an array for collections. Never null on success — use `{}` or `[]`.

### Error
```json
{
  "success": false,
  "message": "Human-readable error description",
  "errors": [ ]
}
```

`errors` is an array of strings for field-level validation errors, or an empty array for general errors.

## HTTP Status Codes

| Code | When to use |
|---|---|
| 200 | Successful GET, PUT/PATCH, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Validation error, bad request |
| 401 | Missing or invalid JWT |
| 403 | Valid JWT but insufficient role/permission |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, double booking) |
| 500 | Unhandled server error |

## Authentication

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

JWT payload:
```json
{
  "sub": "<user_id>",
  "email": "<email>",
  "roles": ["patient"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

Token expiry: 7 days (configurable via `JWT_EXPIRES_IN`).

## Endpoints

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register (patient or doctor) |
| POST | `/api/auth/login` | None | Login, returns JWT |
| GET | `/api/auth/me` | Required | Current user profile |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users/:id` | Required | Get user by ID |
| PUT | `/api/users/:id` | Required | Update user (own only) |
| POST | `/api/users/:id/avatar` | Required | Upload profile picture |

### Patients

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/patients/:id` | Required | Get patient profile |
| PUT | `/api/patients/:id` | Required | Update patient profile |

### Doctors

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/doctors` | Required | List all doctors (with filters) |
| GET | `/api/doctors/:id` | Required | Get doctor profile |
| PUT | `/api/doctors/:id` | Required (doctor) | Update doctor profile |
| GET | `/api/doctors/:id/availability` | Required | Get doctor weekly availability |
| PUT | `/api/doctors/:id/availability` | Required (doctor) | Update availability |
| POST | `/api/doctors/:id/blocked-slots` | Required (doctor) | Block a time slot |
| DELETE | `/api/doctors/:id/blocked-slots/:slotId` | Required (doctor) | Unblock a slot |
| GET | `/api/doctors/:id/slots` | Required | Get available booking slots for a date |

Query params for `GET /api/doctors`:
- `specialization` — filter by specialization string
- `search` — search name or bio
- `page`, `limit` — pagination (default: page=1, limit=20)

### Appointments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments` | Required (patient) | Create appointment |
| GET | `/api/appointments` | Required | List appointments (role-filtered) |
| GET | `/api/appointments/:id` | Required | Get appointment detail |
| PUT | `/api/appointments/:id` | Required | Reschedule appointment |
| DELETE | `/api/appointments/:id` | Required | Cancel appointment |
| PATCH | `/api/appointments/:id/status` | Required (doctor) | Update status (confirm, complete) |

### Consultation Notes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments/:id/notes` | Required (doctor) | Create consultation note |
| GET | `/api/appointments/:id/notes` | Required | Get note for appointment |
| PUT | `/api/appointments/:id/notes` | Required (doctor) | Update consultation note |

### Prescriptions

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments/:id/prescriptions` | Required (doctor) | Add prescription |
| GET | `/api/appointments/:id/prescriptions` | Required | Get prescriptions for appointment |
| DELETE | `/api/appointments/:id/prescriptions/:rxId` | Required (doctor) | Remove prescription |

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications` | Required | Get user notifications |
| PATCH | `/api/notifications/:id/read` | Required | Mark as read |
| PATCH | `/api/notifications/read-all` | Required | Mark all as read |

### AI

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/recommend` | Required (patient) | Get doctor recommendations from symptoms |

Request body:
```json
{
  "symptoms": "string describing symptoms or health concerns"
}
```

Response `data`:
```json
{
  "recommendations": [
    {
      "specialization": "Cardiologist",
      "reason": "Based on chest pain and shortness of breath",
      "doctors": [ { "id": "...", "name": "...", "specialization": "..." } ]
    }
  ]
}
```

## Validation Rules

Applied via Zod v4 in each controller before calling services.

### Registration
```
email:     required, valid email format, max 255 chars
password:  required, min 8 chars
firstName: required, min 1, max 100
lastName:  required, min 1, max 100
role:      required, enum ['patient', 'doctor']
```

### Appointment Booking
```
doctorId:     required, valid UUID
scheduledAt:  required, ISO timestamp, must be future date
durationMinutes: optional, default 30
reasonForVisit: optional, max 500 chars
```

### Doctor Availability
```
dayOfWeek:  required, integer 0–6
startTime:  required, HH:MM format
endTime:    required, HH:MM format, must be after startTime
isAvailable: required, boolean
```

## Pagination

List endpoints accept:
```
?page=1&limit=20
```

Response includes:
```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

## Error Handling

Express v5 automatically propagates async errors to the error middleware.

Error middleware (`src/shared/middleware/error.middleware.ts`):
- Zod validation errors → 400 with field-level messages
- JWT errors → 401
- Custom `AppError` class → uses `statusCode` property
- Unhandled errors → 500 with generic message (no stack in production)
