import { eq, isNull } from "drizzle-orm";
import { db } from "../../config/db";
import { users } from "../users/users.schema";
import { roles, userRoles } from "./auth.schema";

// NOTE: This file re-uses the DB table schema exported from users.schema.ts
// and auth.schema.ts (the Drizzle table definitions, not the Zod schemas).
// The Zod validation schemas live in auth.validators.ts to avoid name collision.

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
  async createUser(data: {
    email: string;
    passwordHash: string;
  }) {
    const result = await db
      .insert(users)
      .values(data)
      .returning();

    return result[0];
  },

  // ---------------------------------------------------------------------------
  // Assign role to user
  // ---------------------------------------------------------------------------
  async assignRole(userId: string, roleName: string) {
    const roleResult = await db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    const role = roleResult[0];
    if (!role) throw new Error(`Role '${roleName}' not found`);

    await db
      .insert(userRoles)
      .values({ userId, roleId: role.id })
      .onConflictDoNothing();

    return role;
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
};
