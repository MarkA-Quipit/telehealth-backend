import type { Request, Response, NextFunction } from "express";
import { authService } from "../../modules/auth/auth.service";

// ---------------------------------------------------------------------------
// authenticate — verifies JWT and attaches AuthUser to req.user
// Maps payload.sub → user.id so every downstream handler uses req.user.id
// ---------------------------------------------------------------------------
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Missing or malformed Authorization header",
    });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = authService.verifyToken(token);
    req.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

// ---------------------------------------------------------------------------
// requireRole — guards a route to specific roles
// Usage: router.patch("/:id/status", authenticate, requireRole("doctor"), handler)
// ---------------------------------------------------------------------------
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = req.user?.roles ?? [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
      return;
    }

    next();
  };
}
