# 06 — UI/UX Guidelines

Design quality is weighted equally to functionality (40% each). Every UI decision matters.

## Design Principles

**Trust first.** Healthcare users need to feel safe. The UI must feel clean, professional, and reliable — never playful or cluttered.

**Clarity over cleverness.** Every element should have an obvious purpose. If it needs explanation, simplify it.

**Reduce cognitive load.** Patients and doctors are busy. Show what matters now, hide what doesn't.

**Consistent feedback.** Every action needs a visible result — loading states, success messages, error states.

## Visual Language

### Color Palette

Primary: Sky blue — conveys health, trust, cleanliness
```css
@theme {
  --color-primary:       #0ea5e9;   /* sky-500 */
  --color-primary-dark:  #0284c7;   /* sky-600 */
  --color-primary-light: #e0f2fe;   /* sky-100 */
  
  --color-success:       #22c55e;   /* green-500 */
  --color-warning:       #f59e0b;   /* amber-500 */
  --color-danger:        #ef4444;   /* red-500 */
  
  --color-neutral-50:    #f8fafc;
  --color-neutral-100:   #f1f5f9;
  --color-neutral-200:   #e2e8f0;
  --color-neutral-500:   #64748b;
  --color-neutral-700:   #334155;
  --color-neutral-900:   #0f172a;
}
```

Status colors:
- `pending` → amber (waiting)
- `confirmed` → sky blue (active)
- `completed` → green (done)
- `cancelled` → red (terminated)

### Typography

Font: Geist Variable (loaded via `@fontsource-variable/geist`)

```
Page titles (h1):       text-2xl font-semibold tracking-tight
Section headings (h2):  text-xl font-semibold
Card headings (h3):     text-base font-semibold
Body text:              text-sm text-neutral-700
Captions / labels:      text-xs text-neutral-500
```

Never use font-bold for body text. Use font-semibold for emphasis.

### Spacing

Use Tailwind spacing scale. Prefer:
- `p-4` / `p-6` for card padding
- `gap-4` / `gap-6` for grid/flex gaps
- `mb-6` between major page sections
- `space-y-4` for form fields

### Border Radius

- Cards: `rounded-xl`
- Buttons: `rounded-lg`
- Badges: `rounded-full`
- Inputs: `rounded-lg`

### Shadows

Use sparingly. Cards get `shadow-sm`. Modals get `shadow-lg`. Nothing else.

## Component Patterns

### Page Layout

Every page follows the same structure:
```tsx
<div className="space-y-6">
  {/* Page header */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Page Title</h1>
      <p className="text-sm text-muted-foreground">Supporting description</p>
    </div>
    <Button>Primary Action</Button>
  </div>

  {/* Page content */}
  <div>...</div>
</div>
```

### Cards

```tsx
<Card className="p-6">
  <CardHeader className="p-0 mb-4">
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent className="p-0">
    ...
  </CardContent>
</Card>
```

### Forms

- Every input has a visible label (never placeholder-only)
- Error messages appear below the field in `text-red-500 text-xs`
- Submit button shows loading spinner during submission
- Disable submit button while submitting
- Show success toast after submit, not an alert

### Empty States

Every list/table needs an empty state:
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <Icon className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="font-semibold mb-1">No appointments yet</h3>
  <p className="text-sm text-muted-foreground mb-4">Book your first consultation</p>
  <Button>Book Now</Button>
</div>
```

### Loading States

Use Skeleton components, not spinners, for content areas:
```tsx
{isLoading ? (
  <div className="space-y-3">
    <Skeleton className="h-20 w-full rounded-xl" />
    <Skeleton className="h-20 w-full rounded-xl" />
  </div>
) : (
  <AppointmentList data={appointments} />
)}
```

Use a spinner only for button loading states.

### Status Badges

```tsx
const statusConfig = {
  pending:   { label: 'Pending',   class: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmed', class: 'bg-sky-100 text-sky-700' },
  completed: { label: 'Completed', class: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', class: 'bg-red-100 text-red-700' },
}
```

### Toast Notifications

Use Shadcn `toast` (sonner) for all feedback:
- Success: "Appointment booked successfully"
- Error: "Failed to book appointment. Please try again."
- Info: "Reminder: You have an appointment in 1 hour"

Never use `alert()` or `window.confirm()`.

## Navigation

### Sidebar (Desktop)

Left sidebar, fixed width `w-64`. Role-aware links.

Patient nav:
- Dashboard
- Find a Doctor
- My Appointments
- Medical Records
- Profile

Doctor nav:
- Dashboard
- Appointments
- My Schedule
- Profile

Active link: `bg-primary/10 text-primary font-medium`

### Header

Height `h-16`. Contains:
- Logo / app name (left)
- Notification bell with unread badge (right)
- User avatar + dropdown: Profile, Logout (right)

### Mobile

Use a Sheet (drawer) for mobile navigation. The app is desktop-oriented but must be usable on mobile.

Breakpoint strategy: design for `md:` (768px+) as primary, handle `< md` with sheet nav and stacked layouts.

## Interaction States

All interactive elements must have:
- `hover:` styles
- `focus-visible:` ring (accessibility)
- `disabled:opacity-50 disabled:cursor-not-allowed`
- `active:` feedback for buttons

## Healthcare-Specific UX Principles

**Doctor cards must show:**
- Name, specialization, years of experience
- Accepting patients status
- Quick "Book" CTA

**Appointment detail must clearly show:**
- Date, time, doctor name
- Status badge (prominent)
- Join session button (only enabled when appointment is confirmed and time is within 15 min window or during session)

**Medical records must feel:**
- Clinical but readable
- Structured (clear sections for diagnosis, notes, prescriptions)
- Never overwhelming

**Consultation room:**
- Keep the Jitsi embed full-area
- Minimal chrome around it
- Back button to return to appointment detail

## Accessibility (minimum bar)

- All images have `alt` text
- All form inputs have associated `<label>`
- Focus ring visible on keyboard navigation (`focus-visible:ring-2`)
- Color is never the only way to convey status (pair with text/icon)
- Adequate contrast: body text on white background minimum 4.5:1

## What to Avoid

- Excessive animation (no flying elements, no complex transitions)
- Dense information screens (use tabs or progressive disclosure)
- Gradient overload (one subtle gradient max per screen)
- Generic "AI" aesthetics (glowing orbs, neon accents)
- Modals stacked on modals
- Forms with more than 6–8 fields visible at once
