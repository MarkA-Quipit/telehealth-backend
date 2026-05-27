import { Router } from "express";
import type { Response } from "express";
import multer from "multer";
import { authenticate } from "../../shared/middleware/auth.middleware";
import { usersService } from "./users.service";
import { updateUserSchema } from "./users.schema";
import type { Request } from "express";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WebP files are allowed"));
    }
  },
});

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------
router.get("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const user = await usersService.getUserById(req.params.id);
  res.status(200).json({ success: true, message: "User retrieved", data: user });
});

// ---------------------------------------------------------------------------
// PUT /api/users/:id
// ---------------------------------------------------------------------------
router.put("/:id", authenticate, async (req: Request<{ id: string }>, res: Response) => {
  const body = updateUserSchema.parse(req.body);
  const user = await usersService.updateUser(req.user!.id, req.params.id, body);
  res.status(200).json({ success: true, message: "User updated", data: user });
});

// ---------------------------------------------------------------------------
// POST /api/users/:id/avatar
// ---------------------------------------------------------------------------
router.post(
  "/:id/avatar",
  authenticate,
  upload.single("file"),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file uploaded" });
      return;
    }
    // Authorization: only own avatar
    if (req.user!.id !== req.params.id) {
      res.status(403).json({ success: false, message: "Cannot upload avatar for another user" });
      return;
    }
    const user = await usersService.uploadAvatar(
      req.params.id,
      req.file.buffer,
      req.file.mimetype,
    );
    res.status(200).json({ success: true, message: "Avatar uploaded", data: user });
  },
);

export default router;