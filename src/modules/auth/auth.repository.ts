import { eq, and, isNull, gt } from "drizzle-orm";
import { db, type DrizzleTx } from "../../config/db";
import { users } from "../users/users.schema";
import { roles, userRoles, refreshTokens } from "./auth.schema";
import { patientProfiles } from "../patients/patients.schema";
import { doctorProfiles } from "../doctors/doctors.schema";

// NOTE: This file re-uses the DB table schema exported from users.schema.ts
// and auth.schema.ts (the Drizzle table definitions, not the Zod schemas).
// The Zod validation schemas live in auth.validators.ts to avoid name collision.

type DbOrTx = typeof db | DrizzleTx;

export const authRepository = {
  // ---------------------------------------------------------------------------
  // Find user by email (excludes soft-deleted)
  // ---------------------------------------------------------------------------
  async findByEmail(email: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = result[0];
    if (!user || user.deletedAt !== null) return null;
    return user;
  },

  // ---------------------------------------------------------------------------
  // Find user by id (excludes soft-deleted)
  // ---------------------------------------------------------------------------
  async findById(id: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const user = result[0];
    if (!user || user.deletedAt !== null) return null;
    return user;
  },

  // ---------------------------------------------------------------------------
  // Create user
  // ---------------------------------------------------------------------------
  async createUser(
    data: { email: string; passwordHash: string },
    tx: DbOrTx = db,
  ) {
    const result = await tx
      .insert(users)
      .values(data)
      .returning();

    return result[0];
  },

  // ---------------------------------------------------------------------------
  // Assign role to user
  // ---------------------------------------------------------------------------
  async assignRole(userId: string, roleName: string, tx: DbOrTx = db) {
    // Role lookup is a read of seeded data — always use main db, not tx
    const roleResult = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    const role = roleResult[0];
    if (!role) throw new Error(`Role '${roleName}' not found`);

    await tx
      .insert(userRoles)
      .values({ userId, roleId: role.id })
      .onConflictDoNothing();

    return role;
  },

  // ---------------------------------------------------------------------------
  // Create patient profile scaffold
  // ---------------------------------------------------------------------------
  async createPatientProfile(
    userId: string,
    data: { firstName: string; lastName: string },
    tx: DbOrTx = db,
  ) {
    await tx.insert(patientProfiles).values({
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
    });
  },

  // ---------------------------------------------------------------------------
  // Create doctor profile scaffold
  // ---------------------------------------------------------------------------
  async createDoctorProfile(
    userId: string,
    data: { firstName: string; lastName: string; specialization: string },
    tx: DbOrTx = db,
  ) {
    await tx.insert(doctorProfiles).values({
      userId,
      firstName: data.firstName,
      lastName: data.lastName,
      specialization: data.specialization,
    });
  },

  // ---------------------------------------------------------------------------
  // Get roles for a user (for JWT payload)
  // ---------------------------------------------------------------------------
  async getUserRoles(userId: string): Promise<string[]> {
    const result = await db
      .select({ roleName: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));

    return result.map((r) => r.roleName);
  },

  // ---------------------------------------------------------------------------
  // Update last login timestamp
  // ---------------------------------------------------------------------------
  async updateLastLogin(userId: string) {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  },

  // ---------------------------------------------------------------------------
  // Refresh token management
  // ---------------------------------------------------------------------------
  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  },

  async findRefreshToken(tokenHash: string) {
    const result = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return result[0] ?? null;
  },

  async revokeRefreshToken(id: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  },

  async revokeAllRefreshTokens(userId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  },
};
