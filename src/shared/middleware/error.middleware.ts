import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod/v4";
import { AppError } from "../types";

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // ---------------------------------------------------------------------------
  // AppError — service-thrown errors with statusCode + optional field errors
  // ---------------------------------------------------------------------------
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors.length > 0 ? { errors: err.errors } : {}),
    });
    return;
  }

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
  // Unknown errors → 500
  // ---------------------------------------------------------------------------
  console.error("[Unhandled Error]", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
