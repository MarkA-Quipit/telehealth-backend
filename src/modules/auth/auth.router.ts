import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../shared/middleware/auth.middleware";

const router = Router();

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected routes
router.get("/me", authenticate, authController.me);

export default router;
