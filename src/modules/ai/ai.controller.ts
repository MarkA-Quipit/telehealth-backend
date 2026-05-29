import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate, requireRole } from "../../shared/middleware/auth.middleware";
import { aiService } from "./ai.service";
import { recommendDoctorSchema } from "./ai.schema";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/ai/history  — patient only
// Must be registered BEFORE /recommend to avoid param collision (not an issue
// here but good practice to keep fixed routes above parameterised ones)
// ---------------------------------------------------------------------------
router.get(
  "/history",
  authenticate,
  requireRole("patient"),
  async (req: Request, res: Response) => {
    const history = await aiService.getHistory(req.user!.id);
    res.status(200).json({ success: true, message: "OK", data: history });
  },
);

// ---------------------------------------------------------------------------
// POST /api/ai/recommend/stream  — patient only, SSE streaming
// Registered before /recommend so Express doesn't try to match "stream" as a body
// ---------------------------------------------------------------------------
router.post(
  "/recommend/stream",
  authenticate,
  requireRole("patient"),
  async (req: Request, res: Response) => {
    const { symptoms } = recommendDoctorSchema.parse(req.body);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // try/finally ensures res.end() is always called even if Groq throws mid-stream,
    // preventing the client connection from hanging open indefinitely.
    try {
      for await (const chunk of aiService.streamRecommendations(symptoms, req.user!.id)) {
        if (chunk.type === "token") {
          res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`);
        } else {
          res.write(
            `data: ${JSON.stringify({ done: true, recommendations: chunk.recommendations })}\n\n`,
          );
        }
      }
    } finally {
      res.end();
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/ai/recommend  — patient only (non-streaming, kept for compatibility)
// ---------------------------------------------------------------------------
router.post(
  "/recommend",
  authenticate,
  requireRole("patient"),
  async (req: Request, res: Response) => {
    const { symptoms } = recommendDoctorSchema.parse(req.body);
    const result = await aiService.getRecommendations(symptoms, req.user!.id);
    res.status(200).json({ success: true, message: "Recommendations retrieved", data: result });
  },
);

export default router;
