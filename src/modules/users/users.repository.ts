import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import { users } from "./users.schema";
import { roles, permissions, rolePermissions, userRoles } from "../auth/auth.schema";
import { patientProfiles } from "../patients/patients.schema";
import { doctorProfiles } from "../doctors/doctors.schema";
import type { UpdateUserInput } from "./users.schema";

// ---------------------------------------------------------------------------
// Return shape — combines users row with profile data and roles
// ---------------------------------------------------------------------------
export interface UserWithProfile {
  id: string;
  email: string;
  roles: string[];
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  profilePictureUrl: string | null;
  patientId: string | null;   // patient_profiles.id
  doctorId: string | null;    // doctor_profiles.id
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function getRoles(userId: string): Promise<string[]> {
  const result = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return result.map((r) => r.name);
}

async function buildUserWithProfile(
  user: { id: string; email: string; isActive: boolean; createdAt: Date; lastLoginAt: Date | null },
): Promise<UserWithProfile> {
  const [userRoleNames, patientRows, doctorRows] = await Promise.all([
    getRoles(user.id),
    db.select().from(patientProfiles).where(eq(patientProfiles.userId, user.id)).limit(1),
    db.select().from(doctorProfiles).where(eq(doctorProfiles.userId, user.id)).limit(1),
  ]);

  const patient = patientRows[0] ?? null;
  const doctor = doctorRows[0] ?? null;

  return {
    id: user.id,
    email: user.email,
    roles: userRoleNames,
    firstName: patient?.firstName ?? doctor?.firstName ?? null,
    lastName: patient?.lastName ?? doctor?.lastName ?? null,
    phone: patient?.phoneNumber ?? doctor?.phoneNumber ?? null,
    profilePictureUrl: patient?.profilePictureUrl ?? doctor?.profilePictureUrl ?? null,
    patientId: patient?.id ?? null,
    doctorId: doctor?.id ?? null,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
export const usersRepository = {
  // ── findById ──────────────────────────────────────────────────────────────
  async findById(id: string): Promise<UserWithProfile | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    const user = result[0];
    if (!user || user.deletedAt !== null) return null;

    return buildUserWithProfile(user);
  },

  // ── updateById — updates name/phone in whichever profile table has this user
  async updateById(id: string, data: Partial<UpdateUserInput>): Promise<UserWithProfile> {
    const now = new Date();

    if (data.firstName !== undefined || data.lastName !== undefined || data.phone !== undefined) {
      const patientUpdate: Record<string, unknown> = { updatedAt: now };
      const doctorUpdate: Record<string, unknown> = { updatedAt: now };

      if (data.firstName !== undefined) {
        patientUpdate.firstName = data.firstName;
        doctorUpdate.firstName = data.firstName;
      }
      if (data.lastName !== undefined) {
        patientUpdate.lastName = data.lastName;
        doctorUpdate.lastName = data.lastName;
      }
      if (data.phone !== undefined) {
        patientUpdate.phoneNumber = data.phone;
        doctorUpdate.phoneNumber = data.phone;
      }

      await Promise.all([
        db.update(patientProfiles).set(patientUpdate).where(eq(patientProfiles.userId, id)),
        db.update(doctorProfiles).set(doctorUpdate).where(eq(doctorProfiles.userId, id)),
      ]);
    }

    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return buildUserWithProfile(user[0]);
  },

  // ── updateAvatar ──────────────────────────────────────────────────────────
  async updateAvatar(id: string, url: string): Promise<UserWithProfile> {
    const now = new Date();
    await Promise.all([
      db.update(patientProfiles)
        .set({ profilePictureUrl: url, updatedAt: now })
        .where(eq(patientProfiles.userId, id)),
      db.update(doctorProfiles)
        .set({ profilePictureUrl: url, updatedAt: now })
        .where(eq(doctorProfiles.userId, id)),
    ]);

    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return buildUserWithProfile(user[0]);
  },

  // ── findRoleByName ────────────────────────────────────────────────────────
  async findRoleByName(name: string) {
    const result = await db
      .select()
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);
    return result[0] ?? null;
  },

  // ── findPermissionsByRoleId ───────────────────────────────────────────────
  async findPermissionsByRoleId(roleId: string) {
    return db
      .select({ id: permissions.id, name: permissions.name, description: permissions.description })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
  },
};