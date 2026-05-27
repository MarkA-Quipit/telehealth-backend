import type { Request, Response } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema } from "./auth.validators";

export const authController = {
  // ---------------------------------------------------------------------------
  // POST /api/auth/register
  // ---------------------------------------------------------------------------
  async register(req: Request, res: Response) {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);

    res.status(201).json({
      success: true,
      message: "Registered successfully",
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
      message: "Login successful",
      data: result,
    });
  },

  // ---------------------------------------------------------------------------
  // GET /api/auth/me  (requires authenticate middleware)
  // ---------------------------------------------------------------------------
  async me(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      message: "User retrieved",
      data: req.user,
    });
  },
};