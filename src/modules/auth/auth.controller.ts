import type { Request, Response } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validators";

export const authController = {
  // ---------------------------------------------------------------------------
  // POST /api/auth/register
  // ---------------------------------------------------------------------------
  async register(req: Request, res: Response) {
    const body = registerSchema.parse(req.body); // throws ZodError on invalid input
    const result = await authService.register(body);

    res.status(201).json({
      success: true,
      data: result,
    });
  },

  // ---------------------------------------------------------------------------
  // POST /api/auth/login
  // ---------------------------------------------------------------------------
  async login(req: Request, res: Response) {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);

    res.status(200).json({
      success: true,
      data: result,
    });
  },

  // ---------------------------------------------------------------------------
  // GET /api/auth/me  (requires auth middleware)
  // ---------------------------------------------------------------------------
  async me(req: Request, res: Response) {
    // req.user is attached by auth middleware
    res.status(200).json({
      success: true,
      data: req.user,
    });
  },
};
