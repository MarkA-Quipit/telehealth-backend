# AI Module

## 1. Purpose

Provide AI-powered doctor specialization recommendations based on patient-described symptoms. Calls the Google Gemini API with a structured prompt, parses the response, and returns matched specializations with reasons plus any doctors of those specializations in the system. Simple API call — no AI agent, no conversation state, no tool use.

---

## 2. Required Features

- Accept free-text symptom description from patient
- Call Google Gemini API (gemini-2.0-flash) with structured prompt
- Parse response into specialization recommendations with reasoning
- Fetch doctors from DB matching recommended specializations
- Return recommendations + matched doctors to frontend
- Display results in doctor discovery page with links to each doctor profile

---

## 3. Out-of-Scope Features

- Multi-turn conversation / triage chatbot (bonus feature — not in MVP)
- Saving AI recommendation history
- Doctor ratings weighted by AI
- Symptom tracking over time
- AI-generated prescription suggestions
- Differential diagnosis
- Medical advice (disclaimer required — this is discovery only)
- Custom fine-tuned model
- Streaming responses
- AI moderation of user input
- Integration with external medical knowledge bases

---

## 4. Backend Responsibilities

### Files

```
src/modules/ai/
├── ai.controller.ts
├── ai.service.ts
└── ai.schema.ts
```

No `ai.repository.ts` needed — AI module reads doctors directly via `doctors.repository`.

### ai.schema.ts

Zod validators:

```ts
recommendDoctorSchema: {
  symptoms: z.string().min(10).max(1000)
}
```

### ai.service.ts

```ts
getRecommendations(symptoms: string): Promise<RecommendationResult>
```

**Implementation:**

```ts
async getRecommendations(symptoms: string): Promise<RecommendationResult> {
  // 1. Fetch all specializations currently in DB — constrains Gemini to only pick real values
  const availableSpecializations = await doctorsRepository.getDistinctSpecializations()

  // 2. Build prompt with the live specialization list injected
  const prompt = buildRecommendationPrompt(symptoms, availableSpecializations)

  // 3. Call Gemini API
  let text: string
  try {
    const result = await geminiModel.generateContent(prompt)
    text = result.response.text()
  } catch {
    text = ''
  }

  // 4. Parse structured JSON from response
  const parsed = parseAIResponse(text, availableSpecializations)

  // 5. For each recommended specialization, fetch matching doctors from DB
  const enriched = await Promise.all(
    parsed.recommendations.map(async (rec) => {
      const { items } = await doctorsRepository.findAll({
        specialization: rec.specialization,
        page: 1,
        limit: 3,
      })
      return { ...rec, doctors: items }
    })
  )

  return { recommendations: enriched }
}
```

**Prompt template:**

The specialization list from DB is injected so Gemini can only return values that actually exist. This eliminates the silent zero-result problem caused by name mismatches (e.g. Gemini returning "Cardiology" when the DB has "Cardiologist"). The list is fetched fresh per request, so newly added specializations are automatically available.

```ts
const buildRecommendationPrompt = (symptoms: string, specializations: string[]) => {
  const list = specializations.length > 0
    ? specializations.map(s => `"${s}"`).join(', ')
    : '"General Practice"'

  return `You are a medical triage assistant helping patients find the right doctor specialization.

Patient describes: "${symptoms}"

Available specializations in our system:
${list}

You MUST only recommend specializations from the list above. Do not invent or use specialization names not in this list.

Respond ONLY with a JSON object (no markdown, no explanation) in this exact format:
{
  "recommendations": [
    {
      "specialization": "Cardiology",
      "reason": "Brief reason why this specialization fits the symptoms"
    }
  ]
}

Rules:
- Return 1 to 3 specializations maximum
- You MUST pick ONLY from the available specializations list above — exact match required
- Keep reasons under 20 words
- If no specialization closely fits, pick the closest one from the list
- Never provide diagnosis or medical advice
- Respond only with the JSON object, nothing else
`
}
```

**Response parser:**

The fallback now uses the first specialization from the DB list (or `"General Practice"` if the list is empty) rather than hardcoding the string, so the fallback also returns a valid DB value.

```ts
const parseAIResponse = (
  text: string,
  availableSpecializations: string[]
): { recommendations: Array<{ specialization: string; reason: string }> } => {
  const fallbackSpecialization = availableSpecializations[0] ?? 'General Practice'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {
      recommendations: [{ specialization: fallbackSpecialization, reason: 'Unable to parse symptoms — general practitioner recommended' }]
    }
  }
}
```

**Gemini client setup:**

```ts
// src/config/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
```

**Install:**

```bash
npm install @google/generative-ai
```

**Free tier limits (more than sufficient for demo):**
- 15 requests/minute
- 1,500 requests/day
- Sign up: https://aistudio.google.com

### ai.controller.ts

```
POST /api/ai/recommend   → ai.service.getRecommendations()   → 200
```

Auth: JWT required, patient role only.

---

## 5. Frontend Responsibilities

### Files

```
src/features/ai/
├── api/
│   └── ai.api.ts
├── components/
│   └── SymptomChecker.tsx     # Input form + results display
├── hooks/
│   └── useAIRecommendation.ts
└── types/
    └── index.ts
```

### SymptomChecker.tsx

```tsx
Props: none (self-contained, lives in DoctorListPage)

State:
  - symptoms: string (textarea value)
  - submitted: boolean (controls showing results)

UI:
  [Card: "Find doctors by symptoms"]
    [Label: "Describe your symptoms"]
    [Textarea: 3-4 rows, placeholder: "e.g., I've been having chest pain and shortness of breath..."]
    [Button: "Find Matching Doctors" + loading spinner during call]

  [Results section (shown after successful response)]
    For each recommendation:
      [Specialization badge + reason text]
      [Row of up to 3 DoctorCard components (mini variant)]
        Each links to /patient/doctors/:id

  [Disclaimer text (small, muted)]
    "This is a discovery tool only and does not constitute medical advice."
```

### DoctorCard mini variant

Use same `DoctorCard` component from `src/features/doctors/components/DoctorCard.tsx` — pass a `compact` prop for smaller layout.

### useAIRecommendation.ts

```ts
const useAIRecommendation = () => {
  return useMutation({
    mutationFn: (symptoms: string) => aiApi.recommend(symptoms),
  })
}
```

### ai.api.ts

```ts
recommend(symptoms: string): Promise<RecommendationResult>
  // POST /api/ai/recommend
  // Returns: { recommendations: [{ specialization, reason, doctors }] }
```

### Integration in DoctorListPage

The SymptomChecker lives as a collapsible/expandable section above the doctor filter + grid:

```tsx
<Collapsible>
  <CollapsibleTrigger>
    <Button variant="outline">
      <Sparkles className="h-4 w-4 mr-2" />
      Find doctors by symptoms
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <SymptomChecker />
  </CollapsibleContent>
</Collapsible>
```

---

## 6. Database Tables

| Table | Role |
|---|---|
| `doctors` | Read — fetch matching doctors by specialization |
| `users` | Joined via doctors.repository.findAll |

No new tables.

---

## 7. API Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/ai/recommend` | JWT | Patient | Get doctor recommendations from symptoms |

Request body:
```json
{
  "symptoms": "I have persistent headaches and blurry vision"
}
```

Response `data`:
```json
{
  "recommendations": [
    {
      "specialization": "Neurology",
      "reason": "Headaches with vision changes may indicate neurological causes",
      "doctors": [
        { "id": "...", "name": "Dr. Jane Santos", "specialization": "Neurology", "profilePictureUrl": "..." }
      ]
    },
    {
      "specialization": "Ophthalmology",
      "reason": "Blurry vision warrants an eye specialist evaluation",
      "doctors": []
    }
  ]
}
```

---

## 8. Validation Rules

```
POST /api/ai/recommend
  symptoms: required, string, min 10 chars, max 1000 chars
  Role: patient only (403 for doctors)
```

---

## 9. UI Screens

### `/patient/doctors` — SymptomChecker section

```
[DoctorListPage]
  [Page Header: "Find a Doctor"]

  [Symptom Checker Card — collapsible, closed by default]
    "Not sure which doctor to see? Describe your symptoms and we'll help."
    [Textarea]
    [Find Matching Doctors button]
    --- after submit ---
    [Recommendation: "Neurology"]
      Reason: "Headaches with vision changes..."
      [DoctorCard compact] [DoctorCard compact] [DoctorCard compact]
    [Recommendation: "Ophthalmology"]
      Reason: "..."
      [Empty: No doctors of this specialization currently available]
    [Disclaimer]

  [DoctorFilter]
  [Doctor Grid]
  [Pagination]
```

---

## 10. Dependencies

- Depends on: auth module, doctors module (`doctorsRepository.getDistinctSpecializations()` + `findAll()`)
- Required by: nothing downstream
- External: `@google/generative-ai` npm package, `GEMINI_API_KEY` env var

### Error handling

| Scenario | Behavior |
|---|---|
| Gemini API down / timeout | `text = ''` → `parseAIResponse` fallback returns first DB specialization |
| Malformed AI JSON response | `parseAIResponse` catch block returns first DB specialization |
| No doctors found for specialization | Return empty `doctors: []` — frontend shows "No doctors available for this specialization" |
| No specializations in DB yet | Prompt uses `"General Practice"` as the only option; fallback also uses it |
| symptoms too short | Zod 400 error before API call |

---

## 11. Completion Criteria

- [ ] `POST /api/ai/recommend` fetches live specialization list from DB before calling Gemini
- [ ] Gemini prompt includes the live specialization list and instructs exact-match selection
- [ ] `POST /api/ai/recommend` calls Gemini, parses response, returns enriched recommendations
- [ ] Malformed AI response falls back gracefully (no 500) using first DB specialization
- [ ] Recommendations include matching doctors from DB (match rate near 100% since Gemini picks from DB list)
- [ ] Frontend SymptomChecker submits and renders results
- [ ] Each recommended doctor links to their profile page
- [ ] Loading state during API call
- [ ] Disclaimer text visible
- [ ] Collapsible section on DoctorListPage — closed by default, expands on click
- [ ] Empty state shown when no doctors match a specialization
- [ ] Patient-only access enforced (doctor JWT returns 403)
