import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate, requireRole } from "../../shared/middleware/auth.middleware";
import { doctorsService } from "./doctors.service";
import { updateDoctorSchema, setAvailabilitySchema, blockSlotSchema } from "./doctors.schema";
import { z } from "zod/v4";

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
// GET /api/doctors/:id/slots?date=YYYY-MM-DD  — available time windows
// ---------------------------------------------------------------------------
router.get("/:id/slots", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const { date } = req.query;
  if (!date || typeof date !== "string") {
    res.status(400).json({ success: false, message: "date query param is required (YYYY-MM-DD)" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ success: false, message: "date must be in YYYY-MM-DD format" });
    return;
  }
  const slots = await doctorsService.getAvailableSlots(req.params.id, date);
  res.status(200).json({ success: true, message: "Available slots retrieved", data: slots });
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
// GET /api/doctors/:id/availability  — any authenticated user
// ---------------------------------------------------------------------------
router.get(
  "/:id/availability",
  authenticate,
  async (req: Request<{ id: string }>, res: Response) => {
    const availability = await doctorsService.getAvailability(req.params.id);
    res.status(200).json({ success: true, message: "Availability retrieved", data: availability });
  },
);

// ---------------------------------------------------------------------------
// PUT /api/doctors/:id/availability  — doctor (own) only
// ---------------------------------------------------------------------------
router.put(
  "/:id/availability",
  authenticate,
  requireRole("doctor"),
  async (req: Request<{ id: string }>, res: Response) => {
    const body = setAvailabilitySchema.parse(req.body);
    const availability = await doctorsService.setAvailability(req.user!.id, req.params.id, body);
    res.status(200).json({ success: true, message: "Availability updated", data: availability });
  },
);

// ---------------------------------------------------------------------------
// GET /api/doctors/:id/blocked-slots  — any authenticated user
// ---------------------------------------------------------------------------
router.get(
  "/:id/blocked-slots",
  authenticate,
  async (req: Request<{ id: string }>, res: Response) => {
    const slots = await doctorsService.getBlockedSlots(req.user!.id, req.params.id);
    res.status(200).json({ success: true, message: "Blocked slots retrieved", data: slots });
  },
);

// ---------------------------------------------------------------------------
// POST /api/doctors/:id/blocked-slots  — doctor (own) only
// ---------------------------------------------------------------------------
router.post(
  "/:id/blocked-slots",
  authenticate,
  requireRole("doctor"),
  async (req: Request<{ id: string }>, res: Response) => {
    const body = blockSlotSchema.parse(req.body);
    const slot = await doctorsService.addBlockedSlot(req.user!.id, req.params.id, body);
    res.status(201).json({ success: true, message: "Blocked slot added", data: slot });
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/doctors/:id/blocked-slots/:slotId  — doctor (own) only
// ---------------------------------------------------------------------------
router.delete(
  "/:id/blocked-slots/:slotId",
  authenticate,
  requireRole("doctor"),
  async (req: Request<{ id: string; slotId: string }>, res: Response) => {
    // Validate slotId is a UUID
    z.uuid().parse(req.params.slotId);

    await doctorsService.deleteBlockedSlot(req.user!.id, req.params.id, req.params.slotId);
    res.status(200).json({ success: true, message: "Blocked slot removed", data: null });
  },
);

export default router;