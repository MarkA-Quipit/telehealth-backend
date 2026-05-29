import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../config/db";
import { AppError } from "../../shared/types";
import { authRepository } from "./auth.repository";
import type { RegisterInput, LoginInput, JwtPayload } from "./auth.validators";
import { env } from "../../config/env";

const JWT_SECRET = env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES = "15m";
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const BCRYPT_ROUNDS = 12;

export const authService = {
  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  async register(input: RegisterInput) {
    // 1. Check email uniqueness (outside tx — read only)
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError("Email is already in use", 409);
    }

    // 2. Hash password (outside tx — CPU work)
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    // 3. Atomic transaction: user + role + profile scaffold
    const user = await db.transaction(async (tx) => {
      const newUser = await authRepository.createUser({ email: input.email, passwordHash }, tx);

      await authRepository.assignRole(newUser.id, input.role, tx);

      if (input.role === "patient") {
        await authRepository.createPatientProfile(
          newUser.id,
          { firstName: input.firstName, lastName: input.lastName },
          tx,
        );
      } else {
        await authRepository.createDoctorProfile(
          newUser.id,
          {
            firstName: input.firstName,
            lastName: input.lastName,
            specialization: input.specialization!, // guaranteed by Zod superRefine
          },
          tx,
        );
      }

      return newUser;
    });

    // 4. Fetch roles for JWT (transaction committed, data is visible)
    const userRoles = await authRepository.getUserRoles(user.id);

    // 5. Issue token pair
    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.email, userRoles);

    return {
      accessToken,
      refreshToken,
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
      throw new AppError("Account is deactivated", 403);
    }

    // 4. Update last login (fire-and-forget — don't block response)
    authRepository.updateLastLogin(user.id).catch(console.error);

    // 5. Fetch roles for token
    const userRoles = await authRepository.getUserRoles(user.id);

    // 6. Issue token pair
    const { accessToken, refreshToken } = await issueTokenPair(user.id, user.email, userRoles);

    return {
      accessToken,
      refreshToken,
      user: sanitizeUser(user, userRoles),
    };
  },

  // ---------------------------------------------------------------------------
  // Refresh — exchange a valid refresh token for a new 15-min access token
  // ---------------------------------------------------------------------------
  async refresh(rawRefreshToken: string) {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const stored = await authRepository.findRefreshToken(tokenHash);
    if (!stored) throw new AppError("Invalid or expired refresh token", 401);

    const user = await authRepository.findById(stored.userId);
    if (!user) throw new AppError("User not found", 401);

    const userRoles = await authRepository.getUserRoles(user.id);
    const accessToken = signToken({ sub: user.id, email: user.email, roles: userRoles });

    return { accessToken };
  },

  // ---------------------------------------------------------------------------
  // Logout all — revoke every refresh token for this user
  // ---------------------------------------------------------------------------
  async logoutAll(userId: string) {
    await authRepository.revokeAllRefreshTokens(userId);
  },

  // ---------------------------------------------------------------------------
  // Logout — revoke the refresh token (best-effort; no error if already gone)
  // ---------------------------------------------------------------------------
  async logout(userId: string, rawRefreshToken: string) {
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const stored = await authRepository.findRefreshToken(tokenHash);
    if (stored && stored.userId === userId) {
      await authRepository.revokeRefreshToken(stored.id);
    }
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES } as jwt.SignOptions);
}

async function issueTokenPair(userId: string, email: string, userRoles: string[]) {
  const accessToken = signToken({ sub: userId, email, roles: userRoles });
  const rawRefreshToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);
  await authRepository.storeRefreshToken(userId, tokenHash, expiresAt);
  return { accessToken, refreshToken: rawRefreshToken };
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
  return new AppError("Invalid email or password", 401);
}
