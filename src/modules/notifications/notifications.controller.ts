import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware";
import { notificationsService } from "./notifications.service";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/notifications  — latest notifications + unread count for req.user
// ---------------------------------------------------------------------------
router.get("/", authenticate, async (req: Request, res: Response) => {
  const result = await notificationsService.getNotifications(req.user!.id);
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
