import { eq, ilike, or, and, count, ne, gte, lte } from "drizzle-orm";
import { db } from "../../config/db";
import { doctorProfiles, doctorAvailability, doctorBlockedSlots } from "./doctors.schema";
import { users } from "../users/users.schema";
import { appointments } from "../appointments/appointments.schema";
import type { UpdateDoctorInput } from "./doctors.schema";

// ---------------------------------------------------------------------------
// TimeSlot — returned from getAvailableSlots
// ---------------------------------------------------------------------------
export interface TimeSlot {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function timeStrToMinutes(t: string): number {
  // Postgres TIME returns "HH:MM:SS" or "HH:MM"
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Do [aStart, aEnd) and [bStart, bEnd) overlap?
function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

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

  // ── getAvailableSlots ─────────────────────────────────────────────────────
  // Returns 30-min open windows for doctorId on the given YYYY-MM-DD date.
  // Queries appointments table directly (no import from appointments.repository
  // to avoid circular dependency).
  async getAvailableSlots(doctorId: string, date: string): Promise<TimeSlot[]> {
    // 1. Parse date → day_of_week name
    // Use T12:00:00Z to neutralise DST edge cases when deriving the day
    const dayIndex = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
    const dayName = DAY_NAMES[dayIndex];

    // 2. Fetch availability row for this doctor + day
    const availRows = await db
      .select()
      .from(doctorAvailability)
      .where(
        and(
          eq(doctorAvailability.doctorId, doctorId),
          eq(doctorAvailability.dayOfWeek, dayName),
          eq(doctorAvailability.isActive, true),
        ),
      )
      .limit(1);

    if (!availRows[0]) return [];

    const avail = availRows[0];
    const slotDuration = avail.slotDurationMinutes ?? 30;

    // 3. Generate all windows
    const dayStart = timeStrToMinutes(avail.startTime);
    const dayEnd   = timeStrToMinutes(avail.endTime);
    const windows: TimeSlot[] = [];
    for (let t = dayStart; t + slotDuration <= dayEnd; t += slotDuration) {
      windows.push({ startTime: minutesToTimeStr(t), endTime: minutesToTimeStr(t + slotDuration) });
    }
    if (windows.length === 0) return [];

    // 4. Fetch non-cancelled appointments for this doctor on this date
    const dateStart = new Date(`${date}T00:00:00.000Z`);
    const dateEnd   = new Date(`${date}T23:59:59.999Z`);

    const bookedAppts = await db
      .select({
        scheduledAt: appointments.scheduledAt,
        endsAt: appointments.endsAt,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          ne(appointments.status, "cancelled"),
          gte(appointments.scheduledAt, dateStart),
          lte(appointments.scheduledAt, dateEnd),
        ),
      );

    // 5. Filter windows that overlap existing appointments
    const afterAppts = windows.filter((w) => {
      const wStart = timeStrToMinutes(w.startTime);
      const wEnd   = timeStrToMinutes(w.endTime);
      return !bookedAppts.some((a) => {
        // Convert appointment timestamps to minutes-from-midnight (UTC)
        const aStart = a.scheduledAt.getUTCHours() * 60 + a.scheduledAt.getUTCMinutes();
        const aEnd   = a.endsAt.getUTCHours() * 60 + a.endsAt.getUTCMinutes();
        return rangesOverlap(wStart, wEnd, aStart, aEnd);
      });
    });

    // 6. Fetch blocked slots for this doctor on this date
    const blockedSlots = await db
      .select({ startTime: doctorBlockedSlots.startTime, endTime: doctorBlockedSlots.endTime })
      .from(doctorBlockedSlots)
      .where(
        and(
          eq(doctorBlockedSlots.doctorId, doctorId),
          gte(doctorBlockedSlots.blockedDate, dateStart),
          lte(doctorBlockedSlots.blockedDate, dateEnd),
        ),
      );

    // 7. Filter windows that overlap blocked slots
    const available = afterAppts.filter((w) => {
      const wStart = timeStrToMinutes(w.startTime);
      const wEnd   = timeStrToMinutes(w.endTime);
      return !blockedSlots.some((b) => {
        const bStart = timeStrToMinutes(b.startTime);
        const bEnd   = timeStrToMinutes(b.endTime);
        return rangesOverlap(wStart, wEnd, bStart, bEnd);
      });
    });

    return available;
  },
};