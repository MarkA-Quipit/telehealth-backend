import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware";
import { prescriptionsService } from "./prescriptions.service";
import { createPrescriptionSchema } from "./prescriptions.schema";

// Mounted at /api/appointments/:appointmentId/prescriptions
const router = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// GET /api/appointments/:appointmentId/prescriptions
// ---------------------------------------------------------------------------
router.get(
  "/",
  authenticate,
  async (req: Request<{ appointmentId: string }>, res: Response) => {
    const list = await prescriptionsService.getPrescriptions(
      req.user!.id,
      req.params.appointmentId,
    );
    res.status(200).json({ success: true, message: "Prescriptions retrieved", data: list });
  },
);

// ---------------------------------------------------------------------------
// POST /api/appointments/:appointmentId/prescriptions
// ---------------------------------------------------------------------------
router.post(
  "/",
  authenticate,
  async (req: Request<{ appointmentId: string }>, res: Response) => {
    const body = createPrescriptionSchema.parse(req.body);
    const rx = await prescriptionsService.addPrescription(
      req.user!.id,
      req.params.appointmentId,
      body,
    );
    res.status(201).json({ success: true, message: "Prescription added", data: rx });
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/appointments/:appointmentId/prescriptions/:rxId
// ---------------------------------------------------------------------------
router.delete(
  "/:rxId",
  authenticate,
  async (req: Request<{ appointmentId: string; rxId: string }>, res: Response) => {
    await prescriptionsService.deletePrescription(
      req.user!.id,
      req.params.appointmentId,
      req.params.rxId,
    );
    res.status(200).json({ success: true, message: "Prescription removed", data: null });
  },
);

export default router;
