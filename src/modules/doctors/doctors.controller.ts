import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware";
import { doctorsService } from "./doctors.service";
import { updateDoctorSchema } from "./doctors.schema";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/doctors   — paginated list with optional filters
// ---------------------------------------------------------------------------
router.get("/", authenticate, async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const specialization = typeof req.query.specialization === "string"
    ? req.query.specialization
    : undefined;
  const search = typeof req.query.search === "string"
    ? req.query.search
    : undefined;

  const result = await doctorsService.listDoctors({ specialization, search, page, limit });
  res.status(200).json({ success: true, message: "Doctors retrieved", data: result });
});

// ---------------------------------------------------------------------------
// GET /api/doctors/:id
// ---------------------------------------------------------------------------
router.get("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const doctor = await doctorsService.getDoctorById(req.params.id);
  res.status(200).json({ success: true, message: "Doctor retrieved", data: doctor });
});

// ---------------------------------------------------------------------------
// PUT /api/doctors/:id
// ---------------------------------------------------------------------------
router.put("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const body = updateDoctorSchema.parse(req.body);
  const doctor = await doctorsService.updateDoctorProfile(req.user!.id, req.params.id, body);
  res.status(200).json({ success: true, message: "Doctor updated", data: doctor });
});

// ---------------------------------------------------------------------------
// TODO (Day 3/4): availability + blocked-slots + slots endpoints
// GET    /api/doctors/:id/availability
// PUT    /api/doctors/:id/availability
// POST   /api/doctors/:id/blocked-slots
// DELETE /api/doctors/:id/blocked-slots/:slotId
// GET    /api/doctors/:id/slots
// ---------------------------------------------------------------------------

export default router;