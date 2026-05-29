import type { Request, Response } from "express";
import { authService } from "./auth.service";
import { registerSchema, loginSchema, refreshTokenBodySchema } from "./auth.validators";

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

  // ---------------------------------------------------------------------------
  // POST /api/auth/refresh  (public — takes refresh token in body)
  // ---------------------------------------------------------------------------
  async refresh(req: Request, res: Response) {
    const { refreshToken } = refreshTokenBodySchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.status(200).json({ success: true, message: "Token refreshed", data: result });
  },

  // ---------------------------------------------------------------------------
  // POST /api/auth/logout  (authenticated — revokes the refresh token)
  // ---------------------------------------------------------------------------
  async logout(req: Request, res: Response) {
    const { refreshToken } = refreshTokenBodySchema.parse(req.body);
    await authService.logout(req.user!.id, refreshToken);
    res.status(200).json({ success: true, message: "Logged out", data: null });
  },

  // ---------------------------------------------------------------------------
  // POST /api/auth/logout-all  (authenticated — revokes all refresh tokens)
  // ---------------------------------------------------------------------------
  async logoutAll(req: Request, res: Response) {
    await authService.logoutAll(req.user!.id);
    res.status(200).json({ success: true, message: "Logged out from all devices", data: null });
  },
};