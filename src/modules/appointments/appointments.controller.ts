import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate, requireRole } from "../../shared/middleware/auth.middleware";
import { appointmentsService } from "./appointments.service";
import {
  createAppointmentSchema,
  updateStatusSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  searchPatientsSchema,
  sendChatMessageSchema,
} from "./appointments.schema";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/appointments   — patient creates a booking
// ---------------------------------------------------------------------------
router.post("/", authenticate, async (req: Request, res: Response) => {
  const body = createAppointmentSchema.parse(req.body);
  const appointment = await appointmentsService.createAppointment(req.user!.id, body);
  res.status(201).json({ success: true, message: "Appointment created", data: appointment });
});

// ---------------------------------------------------------------------------
// GET /api/appointments    — role-filtered list
// ---------------------------------------------------------------------------
router.get("/", authenticate, async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const result = await appointmentsService.listAppointments(
    req.user!.id,
    req.user!.roles,
    { status, page, limit },
  );
  res.status(200).json({ success: true, message: "Appointments retrieved", data: result });
});

// ---------------------------------------------------------------------------
// GET /api/appointments/patients/search?q=<keyword>&page=1&limit=20
// Doctor-only: returns paginated patients matched by keyword across their
// medical profile fields (allergies, medications, conditions, name, etc.)
// MUST be registered before /:id — otherwise "patients" is treated as an ID
// ---------------------------------------------------------------------------
router.get(
  "/patients/search",
  authenticate,
  requireRole("doctor"),
  async (req: Request, res: Response) => {
    const { q, bloodType, sex, minConsultations } = searchPatientsSchema.parse(req.query);
    const page = Number(req.query.page) || 1;
    const limit = Math.min(50, Number(req.query.limit) || 20);

    const result = await appointmentsService.searchPatients(
      req.user!.id,
      req.user!.roles,
      { q, bloodType, sex, minConsultations, page, limit },
    );
    res.status(200).json({ success: true, message: "Patients retrieved", data: result });
  },
);

// ---------------------------------------------------------------------------
// GET /api/appointments/:id/calendar  — download .ics file
// ---------------------------------------------------------------------------
router.get("/:id/calendar", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const ics = await appointmentsService.generateIcsContent(req.params.id, req.user!.id);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="appointment-${req.params.id}.ics"`);
  res.send(ics);
});

// ---------------------------------------------------------------------------
// POST /api/appointments/:id/chat  — send a chat message
// ---------------------------------------------------------------------------
router.post("/:id/chat", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const { message } = sendChatMessageSchema.parse(req.body);
  const result = await appointmentsService.sendChatMessage(req.params.id, req.user!.id, message);
  res.status(201).json({ success: true, message: "Message sent", data: result });
});

// ---------------------------------------------------------------------------
// GET /api/appointments/:id/chat  — load chat history
// ---------------------------------------------------------------------------
router.get("/:id/chat", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const history = await appointmentsService.getChatHistory(req.params.id, req.user!.id);
  res.status(200).json({ success: true, message: "Chat history retrieved", data: history });
});

// ---------------------------------------------------------------------------
// GET /api/appointments/:id
// ---------------------------------------------------------------------------
router.get("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const appointment = await appointmentsService.getAppointment(req.user!.id, req.params.id);
  res.status(200).json({ success: true, message: "Appointment retrieved", data: appointment });
});

// ---------------------------------------------------------------------------
// PATCH /api/appointments/:id/status   — doctor only
// ---------------------------------------------------------------------------
router.patch("/:id/status", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const body = updateStatusSchema.parse(req.body);
  const appointment = await appointmentsService.updateStatus(
    req.user!.id,
    req.params.id,
    body,
  );
  res.status(200).json({ success: true, message: "Status updated", data: appointment });
});

// ---------------------------------------------------------------------------
// PATCH /api/appointments/:id/reschedule   — patient cancels + creates new slot
// ---------------------------------------------------------------------------
router.patch("/:id/reschedule", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const body = rescheduleAppointmentSchema.parse(req.body);
  const appointment = await appointmentsService.rescheduleAppointment(
    req.user!.id,
    req.params.id,
    body,
  );
  res.status(201).json({ success: true, message: "Appointment rescheduled", data: appointment });
});

// ---------------------------------------------------------------------------
// DELETE /api/appointments/:id   — cancel (either role)
// ---------------------------------------------------------------------------
router.delete("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const body = cancelAppointmentSchema.parse(req.body);
  const appointment = await appointmentsService.cancelAppointment(
    req.user!.id,
    req.params.id,
    body,
  );
  res.status(200).json({ success: true, message: "Appointment cancelled", data: appointment });
});

export default router;