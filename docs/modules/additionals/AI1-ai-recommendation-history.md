# AI1 — AI Recommendation History Logging

**Type:** FULL
**Status:** To Do
**Priority:** 20

---

## Purpose

Every AI symptom-checker query is currently stateless — results are discarded when the user navigates away. Logging each successful recommendation to a `ai_recommendation_logs` table creates an audit trail and enables a "Recent searches" feature so patients can revisit past results without re-entering symptoms.

---

## Scope

**In scope:**
- Backend: New `ai_recommendation_logs` table and Drizzle migration
- Backend: Insert a log entry after each successful Groq/Gemini response in `ai.service.ts`
- Backend: New `GET /api/ai/history` endpoint that returns the logged recommendations for the authenticated patient
- Frontend (optional): "Recent searches" collapsible section in `SymptomChecker.tsx`

**Out of scope:**
- Deleting history entries
- Searching/filtering history
- Sharing history with doctors

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/ai/ai.schema.ts` | Add `aiRecommendationLogs` Drizzle table definition |
| `src/modules/ai/ai.service.ts` | After successful AI response, insert a log row |
| `src/modules/ai/ai.controller.ts` | Add `GET /history` route (patient-only) |
| `src/db/migrations/` | New migration for `ai_recommendation_logs` table |

> Note: The AI module has no `ai.repository.ts` by design. DB access goes directly through the service using `db` (or via `doctorsRepository` for the doctor lookup). Keep this pattern — add the DB insert directly in `ai.service.ts`.

### Schema Changes

New table `ai_recommendation_logs`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `defaultRandom()` |
| `user_id` | uuid FK → users | the patient who ran the query |
| `symptoms` | text | raw symptom input |
| `recommendations` | jsonb | full recommendations array returned to the client |
| `created_at` | timestamp | `defaultNow()` |

Migration required: yes.

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ai/history` | `authenticate`, `requireRole('patient')` | Return logged AI searches for the current patient |

### Service Changes

In `ai.service.ts`, after the Groq response is parsed and before returning to the controller:

```ts
await db.insert(aiRecommendationLogs).values({
  userId,
  symptoms: input.symptoms,
  recommendations: JSON.stringify(recommendations),
})
```

Add a `getHistory(userId)` method to `ai.service.ts` that queries the log table ordered by `createdAt` desc, limited to the last 10 entries.

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/ai/components/SymptomChecker.tsx` | Add "Recent searches" collapsible section (optional) |
| `src/features/ai/api/ai.api.ts` | Add `getAiHistory()` function |
| `src/features/ai/hooks/useAi.ts` | Add `useAiHistory()` query hook |

### New Hooks / API Functions

- `getAiHistory()` — `api.get('/ai/history')`
- `useAiHistory()` — `useQuery`; data: array of `{ id, symptoms, recommendations, createdAt }`

**Recent Searches UI (optional):**
- Collapsible section below the symptom input
- Each entry: symptom text + date
- Clicking an entry: pre-fills the symptom input with that query text

---

## Implementation Steps

1. (BE) Add `aiRecommendationLogs` Drizzle table to `ai.schema.ts`.
2. (BE) Generate and run migration.
3. (BE) In `ai.service.ts`, import `aiRecommendationLogs` table and insert a log row after a successful AI recommendation.
4. (BE) Add `getHistory(userId)` method to `ai.service.ts`.
5. (BE) Register `GET /history` route in `ai.controller.ts` (authenticate + requireRole('patient'), call `aiService.getHistory(req.user!.id)`).
6. (FE) Add `getAiHistory` API function and `useAiHistory` hook.
7. (FE) Add "Recent searches" collapsible section to `SymptomChecker.tsx`.

---

## Verification

1. Run a symptom check — `ai_recommendation_logs` table should contain a new row.
2. Run another check with different symptoms — a second row is inserted.
3. `GET /api/ai/history` returns both entries, newest first.
4. Optional: "Recent searches" section in the UI shows the last 2 entries; clicking one pre-fills the input.
5. A doctor token calling `GET /api/ai/history` receives 403.
