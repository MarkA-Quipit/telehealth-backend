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
// POST /api/ai/recommend  — patient only
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
