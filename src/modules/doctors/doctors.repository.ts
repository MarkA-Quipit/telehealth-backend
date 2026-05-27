import { eq, ilike, or, and, count, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { doctorProfiles } from "./doctors.schema";
import { users } from "../users/users.schema";
import type { UpdateDoctorInput } from "./doctors.schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface DoctorWithUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  specialization: string;
  bio: string | null;
  licenseNumber: string | null;
  yearsOfExperience: number | null;
  consultationFee: number | null;
  isAcceptingPatients: boolean;
  isVerified: boolean;
  profilePictureUrl: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  // from users
  email: string;
}

export interface DoctorFilters {
  specialization?: string;
  search?: string;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Map Drizzle row → DoctorWithUser
// ---------------------------------------------------------------------------
function mapRow(
  d: typeof doctorProfiles.$inferSelect,
  u: { email: string },
): DoctorWithUser {
  return {
    id: d.id,
    userId: d.userId,
    firstName: d.firstName,
    lastName: d.lastName,
    specialization: d.specialization,
    bio: d.bio ?? null,
    licenseNumber: d.licenseNumber ?? null,
    yearsOfExperience: d.yearsOfExperience ?? null,
    consultationFee: d.consultationFee ?? null,
    isAcceptingPatients: d.isAcceptingPatients,
    isVerified: d.isVerified,
    profilePictureUrl: d.profilePictureUrl ?? null,
    phoneNumber: d.phoneNumber ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    email: u.email,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
export const doctorsRepository = {
  // ── findAll — paginated list with optional filters ────────────────────────
  async findAll(filters: DoctorFilters): Promise<{ items: DoctorWithUser[]; total: number }> {
    const { specialization, search, page, limit } = filters;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (specialization) {
      conditions.push(eq(doctorProfiles.specialization, specialization));
    }
    if (search) {
      conditions.push(
        or(
          ilike(doctorProfiles.firstName, `%${search}%`),
          ilike(doctorProfiles.lastName, `%${search}%`),
          ilike(doctorProfiles.specialization, `%${search}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(doctorProfiles)
        .innerJoin(users, eq(doctorProfiles.userId, users.id))
        .where(where)
        .orderBy(doctorProfiles.lastName, doctorProfiles.firstName)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(doctorProfiles)
        .innerJoin(users, eq(doctorProfiles.userId, users.id))
        .where(where),
    ]);

    return {
      items: rows.map((r) => mapRow(r.doctor_profiles, r.users)),
      total: Number(countRows[0]?.total ?? 0),
    };
  },

  // ── findById ──────────────────────────────────────────────────────────────
  async findById(doctorId: string): Promise<DoctorWithUser | null> {
    const rows = await db
      .select()
      .from(doctorProfiles)
      .innerJoin(users, eq(doctorProfiles.userId, users.id))
      .where(eq(doctorProfiles.id, doctorId))
      .limit(1);

    if (!rows[0]) return null;
    return mapRow(rows[0].doctor_profiles, rows[0].users);
  },

  // ── findByUserId ──────────────────────────────────────────────────────────
  async findByUserId(userId: string): Promise<typeof doctorProfiles.$inferSelect | null> {
    const rows = await db
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  },

  // ── update ────────────────────────────────────────────────────────────────
  async update(
    doctorId: string,
    data: Partial<UpdateDoctorInput>,
  ): Promise<typeof doctorProfiles.$inferSelect> {
    const dbData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.specialization !== undefined) dbData.specialization = data.specialization;
    if (data.bio !== undefined) dbData.bio = data.bio;
    if (data.licenseNumber !== undefined) dbData.licenseNumber = data.licenseNumber;
    if (data.yearsOfExperience !== undefined) dbData.yearsOfExperience = data.yearsOfExperience;
    if (data.consultationFee !== undefined) dbData.consultationFee = data.consultationFee;
    if (data.isAcceptingPatients !== undefined) dbData.isAcceptingPatients = data.isAcceptingPatients;

    const result = await db
      .update(doctorProfiles)
      .set(dbData)
      .where(eq(doctorProfiles.id, doctorId))
      .returning();

    return result[0];
  },

  // ── getDistinctSpecializations — for filter dropdown ──────────────────────
  async getDistinctSpecializations(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ specialization: doctorProfiles.specialization })
      .from(doctorProfiles)
      .orderBy(doctorProfiles.specialization);
    return rows.map((r) => r.specialization);
  },

  // ── TODO (Day 3/4): availability + blocked-slot + available-slots methods ──

  // getAvailability(doctorId: string) — TODO Day 3
  // setAvailability(doctorId: string, slots) — TODO Day 3
  // getBlockedSlots(doctorId: string, date: string) — TODO Day 3
  // addBlockedSlot(doctorId: string, data) — TODO Day 3
  // deleteBlockedSlot(slotId: string) — TODO Day 3
  // getAvailableSlots(doctorId: string, date: string) — TODO Day 4
  //   Algorithm: availability for day → generate 30-min windows → subtract
  //   confirmed/pending appointments → subtract blocked slots
};