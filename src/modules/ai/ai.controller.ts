import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate, requireRole } from "../../shared/middleware/auth.middleware";
import { aiService } from "./ai.service";
import { recommendDoctorSchema } from "./ai.schema";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/ai/recommend  — patient only
// ---------------------------------------------------------------------------
router.post(
  "/recommend",
  authenticate,
  requireRole("patient"),
  async (req: Request, res: Response) => {
    const { symptoms } = recommendDoctorSchema.parse(req.body);
    const result = await aiService.getRecommendations(symptoms);
    res.status(200).json({ success: true, message: "Recommendations retrieved", data: result });
  },
);

export default router;
