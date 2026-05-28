import { eq, ilike, or, and, count, ne, gte, lte, avg, inArray } from "drizzle-orm";
import { db } from "../../config/db";
import { doctorProfiles, doctorAvailability, doctorBlockedSlots, reviews } from "./doctors.schema";
import { users } from "../users/users.schema";
import { appointments } from "../appointments/appointments.schema";
import { patientProfiles } from "../patients/patients.schema";
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
// Day-of-week conversion helpers
// ---------------------------------------------------------------------------
type DayName = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

// Maps integer (0=Sun … 6=Sat) ↔ DB enum string
const INT_TO_DAY: DayName[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function intToDay(n: number): DayName {
  return INT_TO_DAY[n] as DayName;
}

function dayToInt(day: string): number {
  return INT_TO_DAY.indexOf(day as DayName);
}

// ---------------------------------------------------------------------------
// Availability / blocked-slot return types
// ---------------------------------------------------------------------------
export interface DoctorAvailabilityReturn {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0=Sun … 6=Sat
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  isAvailable: boolean;
}

export interface BlockedSlotReturn {
  id: string;
  doctorId: string;
  blockedDate: string; // "YYYY-MM-DD"
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  reason: string | null;
  createdAt: Date;
}

function mapAvailRow(row: typeof doctorAvailability.$inferSelect): DoctorAvailabilityReturn {
  return {
    id: row.id,
    doctorId: row.doctorId,
    dayOfWeek: dayToInt(row.dayOfWeek),
    startTime: row.startTime.slice(0, 5), // "HH:MM:SS" → "HH:MM"
    endTime: row.endTime.slice(0, 5),
    isAvailable: row.isActive,
  };
}

function mapBlockedRow(row: typeof doctorBlockedSlots.$inferSelect): BlockedSlotReturn {
  const d = new Date(row.blockedDate);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return {
    id: row.id,
    doctorId: row.doctorId,
    blockedDate: `${yyyy}-${mm}-${dd}`,
    startTime: row.startTime.slice(0, 5),
    endTime: row.endTime.slice(0, 5),
    reason: row.reason ?? null,
    createdAt: row.createdAt,
  };
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
  // computed
  averageRating: number | null;
  reviewCount: number;
  completedConsultationsCount: number;
}

export interface Review {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  patient: {
    firstName: string;
    lastName: string;
    profilePictureUrl: string | null;
  };
}

export interface DoctorFilters {
  specialization?: string;
  search?: string;
  minFee?: number;
  maxFee?: number;
  minExperience?: number;
  minRating?: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Map Drizzle row → DoctorWithUser
// ---------------------------------------------------------------------------
interface DoctorStats {
  averageRating: number | null;
  reviewCount: number;
  completedConsultationsCount: number;
}

function mapRow(
  d: typeof doctorProfiles.$inferSelect,
  u: { email: string },
  stats: DoctorStats = { averageRating: null, reviewCount: 0, completedConsultationsCount: 0 },
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
    averageRating: stats.averageRating,
    reviewCount: stats.reviewCount,
    completedConsultationsCount: stats.completedConsultationsCount,
  };
}

// Fetch review stats + completed consultation counts for a list of doctorIds
async function fetchDoctorStats(doctorIds: string[]): Promise<Map<string, DoctorStats>> {
  const statsMap = new Map<string, DoctorStats>();
  if (doctorIds.length === 0) return statsMap;

  const [reviewStats, consultStats] = await Promise.all([
    db
      .select({
        doctorId: reviews.doctorId,
        averageRating: avg(reviews.rating),
        reviewCount: count(reviews.id),
      })
      .from(reviews)
      .where(inArray(reviews.doctorId, doctorIds))
      .groupBy(reviews.doctorId),
    db
      .select({
        doctorId: appointments.doctorId,
        completedCount: count(appointments.id),
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.doctorId, doctorIds),
          eq(appointments.status, "completed"),
        ),
      )
      .groupBy(appointments.doctorId),
  ]);

  for (const id of doctorIds) {
    statsMap.set(id, { averageRating: null, reviewCount: 0, completedConsultationsCount: 0 });
  }
  for (const r of reviewStats) {
    const existing = statsMap.get(r.doctorId)!;
    existing.averageRating = r.averageRating != null ? Math.round(Number(r.averageRating) * 10) / 10 : null;
    existing.reviewCount = Number(r.reviewCount);
  }
  for (const c of consultStats) {
    const existing = statsMap.get(c.doctorId)!;
    existing.completedConsultationsCount = Number(c.completedCount);
  }

  return statsMap;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
export const doctorsRepository = {
  // ── findAll — paginated list with optional filters ────────────────────────
  async findAll(filters: DoctorFilters): Promise<{ items: DoctorWithUser[]; total: number }> {
    const { specialization, search, minFee, maxFee, minExperience, minRating, page, limit } = filters;
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
    if (minFee != null) {
      conditions.push(gte(doctorProfiles.consultationFee, String(minFee)));
    }
    if (maxFee != null) {
      conditions.push(lte(doctorProfiles.consultationFee, String(maxFee)));
    }
    if (minExperience != null) {
      conditions.push(gte(doctorProfiles.yearsOfExperience, minExperience));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // When filtering by minRating, fetch all matching rows, merge stats, filter, paginate in memory
    if (minRating != null) {
      const allRows = await db
        .select()
        .from(doctorProfiles)
        .innerJoin(users, eq(doctorProfiles.userId, users.id))
        .where(where)
        .orderBy(doctorProfiles.lastName, doctorProfiles.firstName);

      const allIds = allRows.map((r) => r.doctor_profiles.id);
      const statsMap = await fetchDoctorStats(allIds);
      const allItems = allRows.map((r) =>
        mapRow(r.doctor_profiles, r.users, statsMap.get(r.doctor_profiles.id)),
      );
      const filtered = allItems.filter(
        (d) => d.averageRating != null && d.averageRating >= minRating,
      );

      return {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
      };
    }

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

    const doctorIds = rows.map((r) => r.doctor_profiles.id);
    const statsMap = await fetchDoctorStats(doctorIds);

    return {
      items: rows.map((r) => mapRow(r.doctor_profiles, r.users, statsMap.get(r.doctor_profiles.id))),
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
    const statsMap = await fetchDoctorStats([doctorId]);
    return mapRow(rows[0].doctor_profiles, rows[0].users, statsMap.get(doctorId));
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

  // ── getAvailability ───────────────────────────────────────────────────────
  async getAvailability(doctorId: string): Promise<DoctorAvailabilityReturn[]> {
    const rows = await db
      .select()
      .from(doctorAvailability)
      .where(eq(doctorAvailability.doctorId, doctorId));
    return rows.map(mapAvailRow);
  },

  // ── setAvailability — replace-all in a transaction ─────────────────────
  async setAvailability(
    doctorId: string,
    slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }>,
  ): Promise<DoctorAvailabilityReturn[]> {
    return db.transaction(async (tx) => {
      // 1. Delete all existing rows for this doctor
      await tx
        .delete(doctorAvailability)
        .where(eq(doctorAvailability.doctorId, doctorId));

      if (slots.length === 0) return [];

      // 2. Insert new rows
      const inserted = await tx
        .insert(doctorAvailability)
        .values(
          slots.map((slot) => ({
            doctorId,
            dayOfWeek: intToDay(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isAvailable,
          })),
        )
        .returning();

      return inserted.map(mapAvailRow);
    });
  },

  // ── getBlockedSlots ───────────────────────────────────────────────────────
  async getBlockedSlots(doctorId: string, date?: string): Promise<BlockedSlotReturn[]> {
    if (date) {
      // Specific date: match blocked_date within that calendar day (UTC)
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd   = new Date(`${date}T23:59:59.999Z`);

      const rows = await db
        .select()
        .from(doctorBlockedSlots)
        .where(
          and(
            eq(doctorBlockedSlots.doctorId, doctorId),
            gte(doctorBlockedSlots.blockedDate, dayStart),
            lte(doctorBlockedSlots.blockedDate, dayEnd),
          ),
        )
        .orderBy(doctorBlockedSlots.blockedDate);
      return rows.map(mapBlockedRow);
    }

    // No date: upcoming only (today onward)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const rows = await db
      .select()
      .from(doctorBlockedSlots)
      .where(
        and(
          eq(doctorBlockedSlots.doctorId, doctorId),
          gte(doctorBlockedSlots.blockedDate, todayStart),
        ),
      )
      .orderBy(doctorBlockedSlots.blockedDate);
    return rows.map(mapBlockedRow);
  },

  // ── addBlockedSlot ────────────────────────────────────────────────────────
  async addBlockedSlot(
    doctorId: string,
    data: { blockedDate: string; startTime: string; endTime: string; reason?: string },
  ): Promise<BlockedSlotReturn> {
    // Store the date as midnight UTC
    const blockedDate = new Date(`${data.blockedDate}T00:00:00.000Z`);

    const inserted = await db
      .insert(doctorBlockedSlots)
      .values({
        doctorId,
        blockedDate,
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason ?? null,
      })
      .returning();

    return mapBlockedRow(inserted[0]);
  },

  // ── deleteBlockedSlot ─────────────────────────────────────────────────────
  async deleteBlockedSlot(slotId: string): Promise<void> {
    await db
      .delete(doctorBlockedSlots)
      .where(eq(doctorBlockedSlots.id, slotId));
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

  // ── findAppointmentForReview — validates appointment for review eligibility ─
  async findAppointmentForReview(appointmentId: string): Promise<{
    id: string;
    doctorId: string;
    patientId: string;
    status: string;
  } | null> {
    const rows = await db
      .select({
        id: appointments.id,
        doctorId: appointments.doctorId,
        patientId: appointments.patientId,
        status: appointments.status,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1);
    return rows[0] ?? null;
  },

  // ── createReview ──────────────────────────────────────────────────────────
  async createReview(data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    const inserted = await db
      .insert(reviews)
      .values({
        appointmentId: data.appointmentId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        rating: data.rating,
        comment: data.comment ?? null,
      })
      .returning();

    const row = inserted[0];
    // Fetch the patient details for the response
    const patientRows = await db
      .select({
        firstName: patientProfiles.firstName,
        lastName: patientProfiles.lastName,
        profilePictureUrl: patientProfiles.profilePictureUrl,
      })
      .from(patientProfiles)
      .where(eq(patientProfiles.id, row.patientId))
      .limit(1);

    const patient = patientRows[0] ?? { firstName: '', lastName: '', profilePictureUrl: null };

    return {
      id: row.id,
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      doctorId: row.doctorId,
      rating: row.rating,
      comment: row.comment ?? null,
      createdAt: row.createdAt,
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        profilePictureUrl: patient.profilePictureUrl ?? null,
      },
    };
  },

  // ── findReviewsByDoctor ───────────────────────────────────────────────────
  async findReviewsByDoctor(doctorId: string): Promise<Review[]> {
    const rows = await db
      .select({
        id: reviews.id,
        appointmentId: reviews.appointmentId,
        patientId: reviews.patientId,
        doctorId: reviews.doctorId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        patientFirstName: patientProfiles.firstName,
        patientLastName: patientProfiles.lastName,
        patientProfilePictureUrl: patientProfiles.profilePictureUrl,
      })
      .from(reviews)
      .innerJoin(patientProfiles, eq(reviews.patientId, patientProfiles.id))
      .where(eq(reviews.doctorId, doctorId))
      .orderBy(reviews.createdAt);

    return rows.map((r) => ({
      id: r.id,
      appointmentId: r.appointmentId,
      patientId: r.patientId,
      doctorId: r.doctorId,
      rating: r.rating,
      comment: r.comment ?? null,
      createdAt: r.createdAt,
      patient: {
        firstName: r.patientFirstName,
        lastName: r.patientLastName,
        profilePictureUrl: r.patientProfilePictureUrl ?? null,
      },
    }));
  },

  // ── findReviewByAppointment ───────────────────────────────────────────────
  async findReviewByAppointment(appointmentId: string): Promise<Review | null> {
    const rows = await db
      .select({
        id: reviews.id,
        appointmentId: reviews.appointmentId,
        patientId: reviews.patientId,
        doctorId: reviews.doctorId,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        patientFirstName: patientProfiles.firstName,
        patientLastName: patientProfiles.lastName,
        patientProfilePictureUrl: patientProfiles.profilePictureUrl,
      })
      .from(reviews)
      .innerJoin(patientProfiles, eq(reviews.patientId, patientProfiles.id))
      .where(eq(reviews.appointmentId, appointmentId))
      .limit(1);

    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      appointmentId: r.appointmentId,
      patientId: r.patientId,
      doctorId: r.doctorId,
      rating: r.rating,
      comment: r.comment ?? null,
      createdAt: r.createdAt,
      patient: {
        firstName: r.patientFirstName,
        lastName: r.patientLastName,
        profilePictureUrl: r.patientProfilePictureUrl ?? null,
      },
    };
  },
};