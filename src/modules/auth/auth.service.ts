import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authRepository } from "./auth.repository";
import type { RegisterInput, LoginInput, JwtPayload } from "./auth.validators";
import { env } from "../../config/env";

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;

const BCRYPT_ROUNDS = 12;

export const authService = {
  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  async register(input: RegisterInput) {
    // 1. Check email uniqueness
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      const error = new Error("Email is already in use") as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // 3. Create user
    const user = await authRepository.createUser({
      email: input.email,
      passwordHash,
    });

    // 4. Assign role
    await authRepository.assignRole(user.id, input.role);

    // 5. Fetch roles for token
    const userRoles = await authRepository.getUserRoles(user.id);

    // 6. Sign JWT
    const token = signToken({ sub: user.id, email: user.email, roles: userRoles });

    return {
      token,
      user: sanitizeUser(user, userRoles),
    };
  },

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  async login(input: LoginInput) {
    // 1. Find user
    const user = await authRepository.findByEmail(input.email);
    if (!user) {
      throw unauthorized();
    }

    // 2. Verify password
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw unauthorized();
    }

    // 3. Check account is active
    if (!user.isActive) {
      const error = new Error("Account is deactivated") as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }

    // 4. Update last login (fire-and-forget — don't block response)
    authRepository.updateLastLogin(user.id).catch(console.error);

    // 5. Fetch roles for token
    const userRoles = await authRepository.getUserRoles(user.id);

    // 6. Sign JWT
    const token = signToken({ sub: user.id, email: user.email, roles: userRoles });

    return {
      token,
      user: sanitizeUser(user, userRoles),
    };
  },

  // ---------------------------------------------------------------------------
  // Verify token (used by auth middleware)
  // ---------------------------------------------------------------------------
  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

function sanitizeUser(
  user: { id: string; email: string; createdAt: Date; lastLoginAt: Date | null },
  roles: string[],
) {
  return {
    id: user.id,
    email: user.email,
    roles,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function unauthorized() {
  const error = new Error("Invalid email or password") as Error & { statusCode: number };
  error.statusCode = 401;
  return error;
}
