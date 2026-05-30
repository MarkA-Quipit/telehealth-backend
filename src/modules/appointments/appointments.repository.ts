import { and, eq, lt, gt, ne, count, countDistinct, desc, ilike, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../../config/db";
import type { DrizzleTx } from "../../config/db";
import { appointments, chatMessages } from "./appointments.schema";
import { patientProfiles } from "../patients/patients.schema";
import { doctorProfiles } from "../doctors/doctors.schema";
import { users } from "../users/users.schema";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------
export interface AppointmentWithDetails {
  id: string;
  status: string;
  scheduledAt: Date;
  endsAt: Date;
  durationMinutes: number;
  reasonForVisit: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  jitsiRoomName: string;
  patientJoinedAt: Date | null;
  doctorJoinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  patient: {
    id: string;         // patient_profiles.id
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePictureUrl: string | null;
  };
  doctor: {
    id: string;         // doctor_profiles.id
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    specialization: string;
    profilePictureUrl: string | null;
  };
}

export interface ListFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface PatientSearchResult {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string | null;
  sex: string | null;
  bloodType: string | null;
  allergies: string | null;
  currentMedications: string | null;
  pastMedicalConditions: string | null;
  familyMedicalHistory: string | null;
  profilePictureUrl: string | null;
  consultationCount: number;
}

export interface PatientSearchResults {
  items: PatientSearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PatientSearchFilters {
  q?: string;
  bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";
  sex?: "male" | "female" | "other" | "prefer_not_to_say";
  minConsultations?: number;
  maxConsultations?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedAppointments {
  items: AppointmentWithDetails[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Build AppointmentWithDetails from a joined row
// ---------------------------------------------------------------------------
function buildDetail(row: {
  appointments: typeof appointments.$inferSelect;
  patient_profiles: typeof patientProfiles.$inferSelect;
  patientUser: { id: string; email: string };
  doctor_profiles: typeof doctorProfiles.$inferSelect;
  doctorUser: { id: string; email: string };
}): AppointmentWithDetails {
  const a = row.appointments;
  const duration = Math.round(
    (a.endsAt.getTime() - a.scheduledAt.getTime()) / 60000,
  );
  return {
    id: a.id,
    status: a.status,
    scheduledAt: a.scheduledAt,
    endsAt: a.endsAt,
    durationMinutes: duration,
    reasonForVisit: a.patientNote ?? null,
    cancellationReason: a.cancellationReason ?? null,
    cancelledBy: a.cancelledBy ?? null,
    cancelledAt: a.cancelledAt ?? null,
    jitsiRoomName: a.jitsiRoomName,
    patientJoinedAt: a.patientJoinedAt ?? null,
    doctorJoinedAt: a.doctorJoinedAt ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    patient: {
      id: row.patient_profiles.id,
      userId: row.patient_profiles.userId,
      firstName: row.patient_profiles.firstName,
      lastName: row.patient_profiles.lastName,
      email: row.patientUser.email,
      profilePictureUrl: row.patient_profiles.profilePictureUrl ?? null,
    },
    doctor: {
      id: row.doctor_profiles.id,
      userId: row.doctor_profiles.userId,
      firstName: row.doctor_profiles.firstName,
      lastName: row.doctor_profiles.lastName,
      email: row.doctorUser.email,
      specialization: row.doctor_profiles.specialization,
      profilePictureUrl: row.doctor_profiles.profilePictureUrl ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
export const appointmentsRepository = {
  // ── create ────────────────────────────────────────────────────────────────
  async create(
    data: {
      patientId: string;
      doctorId: string;
      scheduledAt: Date;
      endsAt: Date;
      reasonForVisit?: string;
    },
    tx: typeof db | DrizzleTx = db,
  ): Promise<typeof appointments.$inferSelect> {
    const id = randomUUID();
    const result = await tx
      .insert(appointments)
      .values({
        id,
        patientId: data.patientId,
        doctorId: data.doctorId,
        scheduledAt: data.scheduledAt,
        endsAt: data.endsAt,
        status: "pending",
        jitsiRoomName: id,
        patientNote: data.reasonForVisit ?? null,
      })
      .returning();
    return result[0];
  },

  // ── findById ──────────────────────────────────────────────────────────────
  async findById(id: string): Promise<AppointmentWithDetails | null> {
    // We need two joins on users (patient user + doctor user).
    // Drizzle doesn't support aliased table joins natively in select(), so
    // we do two separate queries and merge.
    const apptRows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);

    if (!apptRows[0]) return null;
    const appt = apptRows[0];

    const [patientRows, doctorRows] = await Promise.all([
      db
        .select()
        .from(patientProfiles)
        .innerJoin(users, eq(patientProfiles.userId, users.id))
        .where(eq(patientProfiles.id, appt.patientId))
        .limit(1),
      db
        .select()
        .from(doctorProfiles)
        .innerJoin(users, eq(doctorProfiles.userId, users.id))
        .where(eq(doctorProfiles.id, appt.doctorId))
        .limit(1),
    ]);

    if (!patientRows[0] || !doctorRows[0]) return null;

    return buildDetail({
      appointments: appt,
      patient_profiles: patientRows[0].patient_profiles,
      patientUser: patientRows[0].users,
      doctor_profiles: doctorRows[0].doctor_profiles,
      doctorUser: doctorRows[0].users,
    });
  },

  // ── findByPatient ─────────────────────────────────────────────────────────
  async findByPatient(
    patientId: string,
    filters: ListFilters,
  ): Promise<PaginatedAppointments> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);
    const offset = (page - 1) * limit;

    // Get appointment IDs with pagination
    const conditions = [eq(appointments.patientId, patientId)];
    if (filters.status) conditions.push(eq(appointments.status, filters.status as "pending" | "confirmed" | "cancelled" | "completed" | "no_show"));

    const [apptRows, countRows] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(and(...conditions))
        .orderBy(desc(appointments.scheduledAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(appointments).where(and(...conditions)),
    ]);

    // Resolve details for each appointment
    const items = await Promise.all(apptRows.map((a) => this.findById(a.id)));
    const resolved = items.filter((i): i is AppointmentWithDetails => i !== null);

    return {
      items: resolved,
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countRows[0]?.total ?? 0) / limit),
    };
  },

  // ── findByDoctor ──────────────────────────────────────────────────────────
  async findByDoctor(
    doctorId: string,
    filters: ListFilters,
  ): Promise<PaginatedAppointments> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);
    const offset = (page - 1) * limit;

    const conditions = [eq(appointments.doctorId, doctorId)];
    if (filters.status) conditions.push(eq(appointments.status, filters.status as "pending" | "confirmed" | "cancelled" | "completed" | "no_show"));

    const [apptRows, countRows] = await Promise.all([
      db
        .select()
        .from(appointments)
        .where(and(...conditions))
        .orderBy(desc(appointments.scheduledAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(appointments).where(and(...conditions)),
    ]);

    const items = await Promise.all(apptRows.map((a) => this.findById(a.id)));
    const resolved = items.filter((i): i is AppointmentWithDetails => i !== null);

    return {
      items: resolved,
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countRows[0]?.total ?? 0) / limit),
    };
  },

  // ── updateStatus ──────────────────────────────────────────────────────────
  async updateStatus(
    id: string,
    status: "confirmed" | "completed",
  ): Promise<typeof appointments.$inferSelect> {
    const result = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return result[0];
  },

  // ── cancel ────────────────────────────────────────────────────────────────
  async cancel(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<typeof appointments.$inferSelect> {
    const result = await db
      .update(appointments)
      .set({
        status: "cancelled",
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))
      .returning();
    return result[0];
  },

  // ── searchPatients ────────────────────────────────────────────────────────
  // Returns distinct patients (grouped) that have at least one appointment with
  // this doctor and match the given filters. consultationCount = completed appts.
  async searchPatients(
    doctorId: string,
    filters: PatientSearchFilters,
  ): Promise<PatientSearchResults> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, filters.limit ?? 20);
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = [eq(appointments.doctorId, doctorId)];

    if (filters.q && filters.q.trim().length >= 2) {
      const pattern = `%${filters.q.trim()}%`;
      conditions.push(or(
        ilike(patientProfiles.firstName, pattern),
        ilike(patientProfiles.lastName, pattern),
        ilike(sql`${patientProfiles.firstName} || ' ' || ${patientProfiles.lastName}`, pattern),
        ilike(sql`${patientProfiles.lastName} || ' ' || ${patientProfiles.firstName}`, pattern),
        ilike(users.email, pattern),
        ilike(patientProfiles.allergies, pattern),
        ilike(patientProfiles.currentMedications, pattern),
        ilike(patientProfiles.pastMedicalConditions, pattern),
        ilike(patientProfiles.familyMedicalHistory, pattern),
      )!);
    }

    if (filters.bloodType) {
      conditions.push(eq(patientProfiles.bloodType, filters.bloodType));
    }

    if (filters.sex) {
      conditions.push(eq(patientProfiles.sex, filters.sex));
    }

    const baseWhere = and(...conditions);

    // Count of completed appointments per patient with this doctor
    const completedCount = sql<number>`cast(count(case when ${appointments.status} = 'completed' then 1 end) as int)`;

    const selectFields = {
      id: patientProfiles.id,
      userId: patientProfiles.userId,
      firstName: patientProfiles.firstName,
      lastName: patientProfiles.lastName,
      email: users.email,
      dateOfBirth: patientProfiles.dateOfBirth,
      sex: patientProfiles.sex,
      bloodType: patientProfiles.bloodType,
      allergies: patientProfiles.allergies,
      currentMedications: patientProfiles.currentMedications,
      pastMedicalConditions: patientProfiles.pastMedicalConditions,
      familyMedicalHistory: patientProfiles.familyMedicalHistory,
      profilePictureUrl: patientProfiles.profilePictureUrl,
      consultationCount: completedCount,
    };

    // GROUP BY all selected non-aggregate columns to deduplicate patients
    const afterGroupBy = db
      .select(selectFields)
      .from(appointments)
      .innerJoin(patientProfiles, eq(appointments.patientId, patientProfiles.id))
      .innerJoin(users, eq(patientProfiles.userId, users.id))
      .where(baseWhere)
      .groupBy(
        patientProfiles.id,
        patientProfiles.userId,
        patientProfiles.firstName,
        patientProfiles.lastName,
        users.email,
        patientProfiles.dateOfBirth,
        patientProfiles.sex,
        patientProfiles.bloodType,
        patientProfiles.allergies,
        patientProfiles.currentMedications,
        patientProfiles.pastMedicalConditions,
        patientProfiles.familyMedicalHistory,
        patientProfiles.profilePictureUrl,
      );

    const needsHaving = filters.minConsultations != null || filters.maxConsultations != null;
    const completedCountExpr = sql`cast(count(case when ${appointments.status} = 'completed' then 1 end) as int)`;
    const havingClause = and(
      filters.minConsultations != null ? sql`${completedCountExpr} >= ${filters.minConsultations}` : undefined,
      filters.maxConsultations != null ? sql`${completedCountExpr} <= ${filters.maxConsultations}` : undefined,
    );

    const [rows, countResult] = await Promise.all([
      needsHaving
        ? afterGroupBy
            .having(havingClause!)
            .orderBy(patientProfiles.firstName, patientProfiles.lastName)
            .limit(limit)
            .offset(offset)
        : afterGroupBy
            .orderBy(patientProfiles.firstName, patientProfiles.lastName)
            .limit(limit)
            .offset(offset),

      needsHaving
        ? db
            .select({ id: patientProfiles.id })
            .from(appointments)
            .innerJoin(patientProfiles, eq(appointments.patientId, patientProfiles.id))
            .innerJoin(users, eq(patientProfiles.userId, users.id))
            .where(baseWhere)
            .groupBy(patientProfiles.id)
            .having(havingClause!)
            .then((r) => [{ total: r.length }] as const)
        : db
            .select({ total: countDistinct(patientProfiles.id) })
            .from(appointments)
            .innerJoin(patientProfiles, eq(appointments.patientId, patientProfiles.id))
            .innerJoin(users, eq(patientProfiles.userId, users.id))
            .where(baseWhere),
    ]);

    const total = Number(countResult[0]?.total ?? 0);

    // Drizzle v0.45 doesn't propagate sql<T> through groupBy chain — cast to recover the field
    type RowWithCount = typeof rows[number] & { consultationCount: number };
    const typedRows = rows as RowWithCount[];

    return {
      items: typedRows.map((r) => ({
        id: r.id,
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        dateOfBirth: r.dateOfBirth ?? null,
        sex: r.sex ?? null,
        bloodType: r.bloodType ?? null,
        allergies: r.allergies ?? null,
        currentMedications: r.currentMedications ?? null,
        pastMedicalConditions: r.pastMedicalConditions ?? null,
        familyMedicalHistory: r.familyMedicalHistory ?? null,
        profilePictureUrl: r.profilePictureUrl ?? null,
        consultationCount: r.consultationCount ?? 0,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  // ── checkConflict ─────────────────────────────────────────────────────────
  // Returns true if any non-cancelled appointment overlaps the proposed slot.
  async checkConflict(
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number,
  ): Promise<boolean> {
    const proposedEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

    const conflicts = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          ne(appointments.status, "cancelled"),
          lt(appointments.scheduledAt, proposedEnd),   // existing starts before proposed end
          gt(appointments.endsAt, scheduledAt),        // existing ends after proposed start
        ),
      );

    return conflicts.length > 0;
  },

  // ── saveChatMessage ───────────────────────────────────────────────────────
  async saveChatMessage(appointmentId: string, senderId: string, message: string) {
    const result = await db
      .insert(chatMessages)
      .values({ appointmentId, senderId, message })
      .returning();
    return result[0];
  },

  // ── getChatMessages ───────────────────────────────────────────────────────
  async getChatMessages(appointmentId: string) {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.appointmentId, appointmentId))
      .orderBy(chatMessages.sentAt);
  },

  // ── markJoined ────────────────────────────────────────────────────────────
  async markJoined(appointmentId: string, role: "patient" | "doctor", timestamp: Date): Promise<void> {
    if (role === "patient") {
      await db.update(appointments).set({ patientJoinedAt: timestamp }).where(eq(appointments.id, appointmentId));
    } else {
      await db.update(appointments).set({ doctorJoinedAt: timestamp }).where(eq(appointments.id, appointmentId));
    }
  },
};