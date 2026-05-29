import { Router } from "express";
import type { Response, Request } from "express";
import multer from "multer";
import { authenticate, requireRole } from "../../shared/middleware/auth.middleware";
import { patientsService } from "./patients.service";
import { updatePatientSchema } from "./patients.schema";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only images and PDF files are allowed"));
    }
  },
});

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
// POST /api/patients/:id/documents  — patient uploads a document
// ---------------------------------------------------------------------------
router.post(
  "/:id/documents",
  authenticate,
  requireRole("patient"),
  upload.single("file"),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }
    const documents = await patientsService.uploadDocument(req.user!.id, req.params.id, req.file);
    res.status(201).json({ success: true, message: "Document uploaded", data: documents });
  },
);

// ---------------------------------------------------------------------------
// GET /api/patients/:id/documents  — list documents for a patient
// ---------------------------------------------------------------------------
router.get("/:id/documents", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const documents = await patientsService.getDocuments(req.params.id);
  res.status(200).json({ success: true, message: "Documents retrieved", data: documents });
});

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