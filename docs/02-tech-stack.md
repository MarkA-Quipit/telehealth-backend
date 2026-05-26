# 02 — Tech Stack

All versions are locked. Do not upgrade or substitute without flagging the impact first.

## Backend

| Package | Version | Notes |
|---|---|---|
| `node` | 20+ LTS | Runtime |
| `express` | 5.2.1 | Async error propagation — no try/catch in route handlers |
| `typescript` | 6.0.3 | Strict mode enabled |
| `drizzle-orm` | 0.45.2 | Query builder + migrations |
| `drizzle-kit` | 0.31.10 | Schema generation CLI |
| `@neondatabase/serverless` | 1.1.0 | Neon PostgreSQL driver |
| `jsonwebtoken` | 9.0.3 | JWT signing and verification |
| `bcryptjs` | 3.0.3 | Password hashing |
| `zod` | 4.4.3 | Input validation — uses v4 import paths |
| `helmet` | 8.2.0 | HTTP security headers |
| `cors` | 2.8.6 | CORS policy |
| `dotenv` | 17.4.2 | Environment variable loading |
| `tsx` | 4.22.3 | TypeScript watch mode for dev |

Module system: **CommonJS** (`"type": "commonjs"` in package.json)

### Critical Version Notes — Backend

**Zod v4** — import path changed from v3:
```ts
// v3 (wrong)
import { z } from 'zod'

// v4 (correct)
import { z } from 'zod'  // same import but API differences apply
// Schema .parse() still works; error format changed
// z.string().min() / .max() behave differently for error messages
```

**Express v5** — async errors propagate without wrapping:
```ts
// v4 pattern (wrong for this project)
router.get('/', async (req, res, next) => {
  try {
    const data = await someService()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// v5 pattern (correct)
router.get('/', async (req, res) => {
  const data = await someService()  // throws automatically propagate
  res.json(data)
})
```

## Frontend

| Package | Version | Notes |
|---|---|---|
| `react` | 19.2.6 | |
| `react-dom` | 19.2.6 | |
| `typescript` | 6.0.2 | |
| `vite` | 8.0.12 | Build tool |
| `tailwindcss` | 4.3.0 | CSS-based config — no tailwind.config.js |
| `shadcn` | 4.8.0 | UI components |
| `radix-ui` | 1.4.3 | Unified package — not individual @radix-ui/react-* |
| `lucide-react` | 1.16.0 | Icons |
| `@fontsource-variable/geist` | 5.2.9 | Font |
| `clsx` | 2.1.1 | Class name utility |
| `tailwind-merge` | 3.6.0 | Merge Tailwind classes safely |
| `class-variance-authority` | 0.7.1 | Component variant management |
| `tw-animate-css` | 1.4.0 | Animation utilities |
| `@jitsi/react-sdk` | latest | Video consultation embed |

Module system: **ESM** (`"type": "module"` in package.json)

### Critical Version Notes — Frontend

**Tailwind CSS v4** — CSS-based configuration, no `tailwind.config.js`:
```css
/* index.css — v4 approach */
@import "tailwindcss";

@theme {
  --color-primary: #0ea5e9;
  --font-sans: "Geist Variable", sans-serif;
}
```

**Radix UI unified package** — use `radix-ui`, not individual scoped packages:
```ts
// Wrong (v3 pattern)
import * as Dialog from '@radix-ui/react-dialog'

// Correct (unified package)
import * as Dialog from 'radix-ui/react-dialog'
```

**Shadcn v4** — components use the unified radix-ui package internally. When adding new shadcn components, verify import paths match the unified package.

## Infrastructure

| Service | Platform | Purpose |
|---|---|---|
| Database | Neon.tech (PostgreSQL 17) | Primary persistence |
| Frontend hosting | Vercel | SPA deployment |
| Backend hosting | Render or Railway | API deployment |
| Version control | GitHub (personal) | Two repos |
| Video | Jitsi Meet | Consultation sessions |
| Realtime | Pusher or Ably | Push notifications |
| AI | Google Gemini API | Doctor recommendation |
| Media | Cloudinary | Profile picture uploads |

## What Is Not in the Stack

The following were considered and explicitly excluded:

- No Firebase / Supabase (spec prohibits BaaS for database)
- No Redux (Context + TanStack Query is sufficient)
- No GraphQL
- No WebSocket infrastructure (Pusher/Ably covers notifications)
- No custom video (Jitsi embed covers consultation sessions)
- No test suite (excluded for time constraint)
- No Docker for local dev (direct Node + tsx is faster to iterate)
