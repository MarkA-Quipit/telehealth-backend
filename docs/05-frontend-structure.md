# 05 — Frontend Structure

## Entry Points

```
src/
├── main.tsx          # ReactDOM.createRoot, providers wrap
├── App.tsx           # Router outlet
└── index.css         # Tailwind v4 CSS entry point
```

`index.css` — Tailwind v4 setup:
```css
@import "tailwindcss";
@import "@fontsource-variable/geist";
@import "tw-animate-css";

@theme {
  --font-sans: "Geist Variable", ui-sans-serif, sans-serif;
}
```

## App Layer (`src/app/`)

Application-level wiring only — no business logic.

```
src/app/
├── layouts/
│   ├── MainLayout.tsx      # Authenticated shell: sidebar + header + outlet
│   └── AuthLayout.tsx      # Centered card layout for login/register
│
├── providers/
│   ├── AuthProvider.tsx     # JWT state, current user, login/logout
│   └── QueryProvider.tsx    # TanStack Query client
│
└── router/
    └── index.tsx            # All routes + ProtectedRoute + RoleGuard
```

### Routing Strategy

```tsx
// Public routes
/login
/register

// Protected — role-gated
/dashboard          → redirects to /patient/dashboard or /doctor/dashboard by role
/patient/*          → patient-only
/doctor/*           → doctor-only
```

`ProtectedRoute` — redirects unauthenticated users to `/login`.
`RoleGuard` — redirects authenticated users to their role's default route if they hit the wrong role path.

## Features (`src/features/`)

### `auth/`
```
auth/
├── api/
│   └── auth.api.ts           # login(), register(), getMe()
├── components/
│   ├── LoginForm.tsx
│   └── RegisterForm.tsx
├── hooks/
│   └── useAuth.ts            # reads AuthContext
├── pages/
│   ├── LoginPage.tsx
│   └── RegisterPage.tsx
└── types/
    └── index.ts              # LoginDto, RegisterDto, AuthUser
```

### `appointments/`
```
appointments/
├── api/
│   └── appointments.api.ts
├── components/
│   ├── AppointmentCard.tsx
│   ├── AppointmentStatusBadge.tsx
│   └── AppointmentTimeline.tsx
├── hooks/
│   └── useAppointments.ts
├── patient/
│   ├── BookAppointmentPage.tsx
│   ├── AppointmentListPage.tsx
│   └── AppointmentDetailPage.tsx
├── doctor/
│   ├── DoctorAppointmentListPage.tsx
│   └── DoctorAppointmentDetailPage.tsx
└── types/
    └── index.ts
```

### `consultations/`
```
consultations/
├── components/
│   └── JitsiRoom.tsx         # @jitsi/react-sdk embed, receives appointmentId as roomName
├── patient/
│   └── ConsultationPage.tsx
├── doctor/
│   └── ConsultationPage.tsx
└── types/
    └── index.ts
```

Jitsi room name: appointment UUID. Both patient and doctor navigate to the same room via their respective pages.

### `users/` (profiles)
```
users/
├── api/
│   └── users.api.ts
├── components/
│   ├── AvatarUpload.tsx
│   └── ProfileCard.tsx
├── patient/
│   └── PatientProfilePage.tsx
├── doctor/
│   └── DoctorProfilePage.tsx
└── types/
    └── index.ts
```

### `notifications/`
```
notifications/
├── api/
│   └── notifications.api.ts
├── components/
│   ├── NotificationBell.tsx   # Badge count + dropdown trigger
│   └── NotificationList.tsx   # List with mark-read
├── hooks/
│   └── useNotifications.ts    # Pusher subscription + TanStack Query
└── types/
    └── index.ts
```

Pusher channel per user: `private-user-{userId}`
Event names: `appointment.booked`, `appointment.reminder`, `appointment.cancelled`, `schedule.updated`

### `ai/`
```
ai/
├── api/
│   └── ai.api.ts
├── components/
│   └── SymptomInput.tsx       # Textarea + submit, shows recommendation results
├── hooks/
│   └── useAIRecommendation.ts
└── types/
    └── index.ts
```

### `doctors/` (discovery — patient-facing)
```
doctors/
├── api/
│   └── doctors.api.ts
├── components/
│   ├── DoctorCard.tsx
│   ├── DoctorFilter.tsx
│   └── AvailabilityCalendar.tsx
├── patient/
│   ├── DoctorListPage.tsx
│   └── DoctorProfilePage.tsx
└── types/
    └── index.ts
```

## Shared Layer (`src/shared/`)

### `shared/components/layout/`
```
Header.tsx          # Logo, notification bell, user menu
Sidebar.tsx         # Role-aware nav links
MobileNav.tsx       # Hamburger menu for mobile
```

### `shared/ui/`
Shadcn component files added via CLI. Do not hand-edit generated files.

Core components needed:
- `button`, `input`, `label`, `form`
- `card`, `badge`, `avatar`
- `dialog`, `sheet`, `popover`, `dropdown-menu`
- `select`, `calendar`, `date-picker`
- `table`, `skeleton`, `toast`
- `tabs`, `separator`

### `shared/lib/`
```
api.ts      # Axios instance with base URL + auth interceptor
utils.ts    # cn() helper (clsx + tailwind-merge)
```

`api.ts`:
```ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
```

### `shared/hooks/`
```
useDebounce.ts      # For search inputs
useLocalStorage.ts  # Token persistence helper
```

### `shared/constants/`
```
routes.ts           # Route path constants
queryKeys.ts        # TanStack Query key factories
```

## Key Pages Summary

### Patient Pages
| Page | Route | Feature |
|---|---|---|
| Dashboard | `/patient/dashboard` | Upcoming appointments, quick actions |
| Doctor List | `/patient/doctors` | Browse + filter + AI recommendation |
| Doctor Profile | `/patient/doctors/:id` | Book appointment |
| Appointment List | `/patient/appointments` | History + upcoming |
| Appointment Detail | `/patient/appointments/:id` | Detail + join session |
| Consultation | `/patient/consultation/:appointmentId` | Jitsi embed |
| Profile | `/patient/profile` | Edit profile |

### Doctor Pages
| Page | Route | Feature |
|---|---|---|
| Dashboard | `/doctor/dashboard` | Today's schedule, quick stats |
| Appointments | `/doctor/appointments` | All appointments list |
| Appointment Detail | `/doctor/appointments/:id` | Notes + prescriptions + join |
| Consultation | `/doctor/consultation/:appointmentId` | Jitsi embed |
| Availability | `/doctor/availability` | Weekly schedule management |
| Profile | `/doctor/profile` | Edit bio + specialization |

## State Management Rules

- **Server state**: TanStack Query — all API calls go through `useQuery` / `useMutation`
- **Auth state**: `AuthContext` — user, token, login(), logout()
- **UI state**: local `useState` — modals, form state, toggles
- **No global client state store** (no Redux, no Zustand) unless explicitly added
