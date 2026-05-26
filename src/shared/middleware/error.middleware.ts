import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod/v4";

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // ---------------------------------------------------------------------------
  // Zod validation errors → 400
  // ---------------------------------------------------------------------------
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // App errors with an attached statusCode
  // ---------------------------------------------------------------------------
  if (err instanceof Error && "statusCode" in err) {
    const statusCode = (err as Error & { statusCode: number }).statusCode;
    res.status(statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // ---------------------------------------------------------------------------
  // Unknown errors → 500
  // ---------------------------------------------------------------------------
  console.error("[Unhandled Error]", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
