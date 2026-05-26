import type { Request, Response, NextFunction } from "express";
import { authService } from "../../modules/auth/auth.service";

// ---------------------------------------------------------------------------
// authenticate  — verifies JWT and attaches decoded payload to req.user
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
    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

// ---------------------------------------------------------------------------
// requireRole  — guards a route to specific roles
// Usage: router.get("/admin", authenticate, requireRole("admin"), handler)
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
