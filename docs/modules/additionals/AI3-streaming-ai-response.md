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
| `src/modules/ai/ai.service.ts` | Add `streamRecommendations(symptoms, res)` method using Groq streaming API |
| `src/modules/ai/ai.controller.ts` | Add new `POST /api/ai/recommend/stream` route (or replace existing) that sets SSE headers and delegates to service |

### SSE Response Format

Each chunk sent to the client:

```
data: {"token": "Based on your symptoms..."}\n\n
```

Final event when stream is complete:

```
data: [DONE]\n\n
```

### Service Change

```ts
async streamRecommendations(symptoms: string, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile', // or whichever model is currently used
    messages: [/* existing prompt template */],
    stream: true,
  })

  let fullText = ''
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullText += token
      res.write(`data: ${JSON.stringify({ token })}\n\n`)
    }
  }

  // After stream ends: parse full text, fetch matched doctors, send final structured data
  const recommendations = parseRecommendations(fullText) // existing parser
  res.write(`data: ${JSON.stringify({ done: true, recommendations })}\n\n`)
  res.end()
}
```

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

1. (BE) Add `streamRecommendations(symptoms, res)` to `ai.service.ts` using the Groq streaming API and the existing prompt template.
2. (BE) Register `POST /api/ai/recommend/stream` in `ai.controller.ts` with SSE headers; call `aiService.streamRecommendations`.
3. (FE) Add `streamRecommendations` streaming function to `ai.api.ts`.
4. (FE) In `SymptomChecker.tsx`, add `streamingText` and `isStreaming` state.
5. (FE) Replace the standard `useQuery`/`useMutation` call with the streaming function on form submit.
6. (FE) Render `streamingText` in a typing-effect box while `isStreaming` is true; render structured results when done.

---

## Verification

1. Submit a symptom query — the AI response appears token by token (streaming visible in the UI).
2. The full recommendation list renders after the stream completes.
3. No UI regression on the non-streaming `POST /api/ai/recommend` endpoint.
4. Test with a slow network (throttle in DevTools) — tokens still appear progressively.
5. Check browser DevTools Network tab — the request shows as `text/event-stream` type with chunked transfer.
