import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware";
import { notificationsService } from "./notifications.service";
import { AppError } from "../../shared/types";

const ALLOWED_TYPES = [
  "appointment_booked",
  "appointment_confirmed",
  "appointment_cancelled",
  "appointment_completed",
] as const;

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/notifications  — latest notifications + unread count for req.user
// ---------------------------------------------------------------------------
router.get("/", authenticate, async (req: Request, res: Response) => {
  const rawType = req.query.type;
  let type: string | undefined;

  if (rawType !== undefined) {
    if (typeof rawType !== "string" || !(ALLOWED_TYPES as readonly string[]).includes(rawType)) {
      throw new AppError(
        `Invalid type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
        400,
      );
    }
    type = rawType;
  }

  const rawPage = req.query.page;
  const rawLimit = req.query.limit;
  const page = rawPage ? Math.max(1, Number(rawPage)) : 1;
  const limit = rawLimit ? Math.min(50, Math.max(1, Number(rawLimit))) : 20;

  const result = await notificationsService.getNotifications(req.user!.id, type, page, limit);
  res.status(200).json({ success: true, message: "OK", data: result });
});

// ---------------------------------------------------------------------------
// PATCH /api/notifications/read-all
// MUST be registered BEFORE /:id/read — otherwise Express matches "read-all"
// as an :id param and calls the wrong handler.
// ---------------------------------------------------------------------------
router.patch("/read-all", authenticate, async (req: Request, res: Response) => {
  await notificationsService.markAllRead(req.user!.id);
  res.status(200).json({ success: true, message: "All notifications marked as read", data: null });
});

// ---------------------------------------------------------------------------
// PATCH /api/notifications/:id/read
// ---------------------------------------------------------------------------
router.patch("/:id/read", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  await notificationsService.markRead(req.user!.id, req.params.id);
  res.status(200).json({ success: true, message: "Notification marked as read", data: null });
});

// ---------------------------------------------------------------------------
// DELETE /api/notifications/:id
// ---------------------------------------------------------------------------
router.delete("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  await notificationsService.deleteNotification(req.user!.id, req.params.id);
  res.status(200).json({ success: true, message: "Notification deleted", data: null });
});

export default router;
