import { and, eq, lt, gt, ne, count, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../../config/db";
import type { DrizzleTx } from "../../config/db";
import { appointments } from "./appointments.schema";
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
};