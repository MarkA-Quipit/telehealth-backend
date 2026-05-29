import { Router } from "express";
import { authController } from "./auth.controller";
import { authenticate } from "../../shared/middleware/auth.middleware";

const router = Router();

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected routes
router.get("/me", authenticate, authController.me);
router.post("/logout", authenticate, authController.logout);
router.post("/logout-all", authenticate, authController.logoutAll);

// Token refresh (public — no authenticate, refresh token supplied in body)
router.post("/refresh", authController.refresh);

export default router;
