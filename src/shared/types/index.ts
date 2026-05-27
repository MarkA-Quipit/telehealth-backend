// ---------------------------------------------------------------------------
// AppError — thrown by services, caught by error.middleware.ts
// ---------------------------------------------------------------------------
export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public errors: string[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ---------------------------------------------------------------------------
// AuthUser — shape attached to req.user after JWT verification
// Uses `id` (not `sub`) so every module can do req.user.id consistently
// ---------------------------------------------------------------------------
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}
