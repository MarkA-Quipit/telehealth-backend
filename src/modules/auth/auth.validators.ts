import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
export const registerSchema = z
  .object({
    email: z.email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"), // bcrypt hard limit
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    role: z.enum(["patient", "doctor"]),
    specialization: z.string().min(1).max(150).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "doctor" && !data.specialization) {
      ctx.addIssue({
        code: "custom",
        message: "Specialization is required for doctors",
        path: ["specialization"],
      });
    }
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
