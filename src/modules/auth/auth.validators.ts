import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
export const registerSchema = z.object({
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"), // bcrypt hard limit
  role: z.enum(["patient", "doctor"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// JWT Payload (what we encode inside the token)
// ---------------------------------------------------------------------------
export interface JwtPayload {
  sub: string;       // users.id
  email: string;
  roles: string[];   // role names e.g. ['patient']
  iat?: number;
  exp?: number;
}
