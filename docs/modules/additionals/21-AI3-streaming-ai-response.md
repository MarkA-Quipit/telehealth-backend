# AI3 — Streaming AI Response

**Type:** FULL
**Status:** To Do
**Priority:** 21

---

## Purpose

The current AI symptom checker waits for the full Groq response before rendering anything — creating a noticeable blank period for users. Switching to Server-Sent Events (SSE) streaming lets tokens render as they arrive, making the experience feel instantaneous and more interactive.

---

## Scope

**In scope:**
- Backend: Switch `ai.service.ts` from `groq.chat.completions.create()` to the streaming variant; stream tokens via SSE (`Content-Type: text/event-stream`)
- Backend: Controller sets appropriate SSE headers and streams token chunks
- Frontend: `SymptomChecker.tsx` reads the stream token by token using `fetch` with a readable stream (or `EventSource`) and renders tokens as they arrive

**Out of scope:**
- Persistent SSE connection for notifications (this is request-scoped only)
- Streaming the doctor list (that's fetched separately after parsing)
- Cancelling an in-progress stream from the UI

---

## Backend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/modules/ai/ai.service.ts` | Add `streamRecommendations(symptoms, userId)` method — returns an `AsyncGenerator`; never touches `res` |
| `src/modules/ai/ai.controller.ts` | Add new `POST /api/ai/recommend/stream` route — owns all SSE headers and iterates the generator |

> **Architecture rule (CLAUDE.md):** Services must never call `res` — "never call `res` inside a service." The controller owns the HTTP response. The service returns an `AsyncGenerator` that yields typed chunks; the controller writes them to `res`. This also ensures errors thrown before or during streaming are catchable at the controller level.

### SSE Response Format

Each chunk sent to the client:

```
data: {"token": "Based on your symptoms..."}\n\n
```

Final event when stream is complete:

```
data: {"done": true, "recommendations": [...]}\n\n
```

### Service Change

The service returns an `AsyncGenerator` — it never receives or calls `res`:

```ts
type StreamChunk =
  | { type: 'token'; token: string }
  | { type: 'done'; recommendations: RecommendationResult[] }

async *streamRecommendations(symptoms: string, userId: string): AsyncGenerator<StreamChunk> {
  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [/* existing prompt template */],
    stream: true,
  })

  let fullText = ''
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullText += token
      yield { type: 'token', token }
    }
  }

  const recommendations = parseRecommendations(fullText)

  // AI1 integration: log the completed recommendation to ai_recommendation_logs
  // If AI1 is implemented, insert here (same pattern as the non-streaming endpoint)
  await db.insert(aiRecommendationLogs).values({
    userId,
    symptoms,
    recommendations: JSON.stringify(recommendations),
  })

  yield { type: 'done', recommendations }
}
```

### Controller Change

The controller owns all SSE headers and the `res.write` / `res.end` calls:

```ts
router.post('/recommend/stream', authenticate, requireRole('patient'), async (req: AuthRequest, res: Response) => {
  const { symptoms } = recommendSchema.parse(req.body)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    for await (const chunk of aiService.streamRecommendations(symptoms, req.user!.id)) {
      if (chunk.type === 'token') {
        res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`)
      } else {
        res.write(`data: ${JSON.stringify({ done: true, recommendations: chunk.recommendations })}\n\n`)
      }
    }
  } finally {
    res.end()
  }
})
```

> The `try/finally` ensures `res.end()` is always called even if Groq throws mid-stream, preventing the client connection from hanging open.

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ai/recommend/stream` | `authenticate`, `requireRole('patient')` | SSE streaming AI recommendations |

> The existing `POST /api/ai/recommend` (non-streaming) should be kept for backward compatibility.

---

## Frontend Changes

### New / Modified Files

| File | Change |
|------|--------|
| `src/features/ai/components/SymptomChecker.tsx` | Use `fetch` with readable stream instead of the standard JSON API call; render tokens as they arrive |
| `src/features/ai/api/ai.api.ts` | Add `streamRecommendations(symptoms, onToken, onDone)` streaming function |

### Streaming Fetch Pattern

```ts
async function streamRecommendations(
  symptoms: string,
  onToken: (token: string) => void,
  onDone: (recommendations: RecommendationResult[]) => void
) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_URL}/ai/recommend/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ symptoms }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n').filter((l) => l.startsWith('data: '))
    for (const line of lines) {
      const payload = JSON.parse(line.replace('data: ', ''))
      if (payload.token) onToken(payload.token)
      if (payload.done) onDone(payload.recommendations)
    }
  }
}
```

**UI State Changes in `SymptomChecker.tsx`:**

- Add `streamingText: string` state — accumulate tokens and display them in a pre-formatted box while streaming
- Add `isStreaming: boolean` state — show a cursor/spinner during streaming
- On stream complete (`onDone` fires): replace streaming text with the structured recommendations list

---

## Implementation Steps

1. (BE) Add `streamRecommendations(symptoms, userId)` as an `AsyncGenerator` method in `ai.service.ts` — yields `{ type: 'token', token }` chunks then a final `{ type: 'done', recommendations }` chunk. Never accept or call `res`.
2. (BE) If AI1 is already implemented, insert the `ai_recommendation_logs` row inside `streamRecommendations` after the generator finishes accumulating `fullText` (before the final `yield`).
3. (BE) Register `POST /recommend/stream` in `ai.controller.ts`: set SSE headers, iterate the generator with `for await`, write each chunk, and wrap in `try/finally { res.end() }`.
4. (FE) Add `streamRecommendations` streaming function to `ai.api.ts`.
5. (FE) In `SymptomChecker.tsx`, add `streamingText` and `isStreaming` state.
6. (FE) Replace the standard `useQuery`/`useMutation` call with the streaming function on form submit.
7. (FE) Render `streamingText` in a typing-effect box while `isStreaming` is true; render structured results when done.

---

## Verification

1. Submit a symptom query — the AI response appears token by token (streaming visible in the UI).
2. The full recommendation list renders after the stream completes.
3. No UI regression on the non-streaming `POST /api/ai/recommend` endpoint.
4. Test with a slow network (throttle in DevTools) — tokens still appear progressively.
5. Check browser DevTools Network tab — the request shows as `text/event-stream` type with chunked transfer.
