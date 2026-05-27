import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware";
import { consultationsService } from "./consultations.service";
import { createNotesSchema } from "./consultations.schema";

// Mounted at /api/appointments/:appointmentId/notes
// Express mergeParams must be true so we can access :appointmentId
const router = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// GET /api/appointments/:appointmentId/notes
// ---------------------------------------------------------------------------
router.get("/", authenticate, async (req: Request<{ appointmentId: string }>, res: Response) => {
  const note = await consultationsService.getNotes(req.user!.id, req.params.appointmentId);
  res.status(200).json({ success: true, message: "Notes retrieved", data: note });
});

// ---------------------------------------------------------------------------
// POST /api/appointments/:appointmentId/notes  — upsert
// ---------------------------------------------------------------------------
router.post("/", authenticate, async (req: Request<{ appointmentId: string }>, res: Response) => {
  const body = createNotesSchema.parse(req.body);
  const note = await consultationsService.createOrUpdateNotes(
    req.user!.id,
    req.params.appointmentId,
    body,
  );
  res.status(200).json({ success: true, message: "Notes saved", data: note });
});

export default router;
