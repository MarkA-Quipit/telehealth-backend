import { Router } from "express";
import type { Response, Request } from "express";
import { authenticate, requireRole } from "../../shared/middleware/auth.middleware";
import { patientsService } from "./patients.service";
import { updatePatientSchema } from "./patients.schema";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/patients/:patientId/history  (doctor-only)
// ---------------------------------------------------------------------------
router.get(
  "/:patientId/history",
  authenticate,
  requireRole("doctor"),
  async (req: Request<{ patientId: string }>, res: Response) => {
    const result = await patientsService.getPatientHistory(req.user!.id, req.params.patientId);
    res.status(200).json({ success: true, message: "Patient history retrieved", data: result });
  },
);

// ---------------------------------------------------------------------------
// GET /api/patients/:id
// ---------------------------------------------------------------------------
router.get("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const patient = await patientsService.getPatientProfile(req.params.id);
  res.status(200).json({ success: true, message: "Patient retrieved", data: patient });
});

// ---------------------------------------------------------------------------
// PUT /api/patients/:id
// ---------------------------------------------------------------------------
router.put("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const body = updatePatientSchema.parse(req.body);
  const patient = await patientsService.updatePatientProfile(
    req.user!.id,
    req.params.id,
    body,
  );
  res.status(200).json({ success: true, message: "Patient updated", data: patient });
});

export default router;