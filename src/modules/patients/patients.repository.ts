import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "../../config/db";
import { patientProfiles } from "./patients.schema";
import { users } from "../users/users.schema";
import { appointments } from "../appointments/appointments.schema";
import { consultationNotes } from "../consultations/consultations.schema";
import { prescriptions } from "../prescriptions/prescriptions.schema";
import type { UpdatePatientInput } from "./patients.schema";

// ---------------------------------------------------------------------------
// Return shape — patient profile joined with user identity fields
// ---------------------------------------------------------------------------
export interface PatientWithUser {
  // Patient profile fields
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  weightKg: string | null;
  heightCm: string | null;
  bloodType: string | null;
  allergies: string | null;
  medicalHistory: string | null;       // mapped from pastMedicalConditions
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  profilePictureUrl: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  // User fields
  email: string;
}

// ---------------------------------------------------------------------------
// Map DB row → PatientWithUser
// ---------------------------------------------------------------------------
function mapRow(
  p: typeof patientProfiles.$inferSelect,
  u: { email: string },
): PatientWithUser {
  return {
    id: p.id,
    userId: p.userId,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth ?? null,
    weightKg: p.weightKg ?? null,
    heightCm: p.heightCm ?? null,
    bloodType: p.bloodType ?? null,
    allergies: p.allergies ?? null,
    medicalHistory: p.pastMedicalConditions ?? null,
    emergencyContactName: p.emergencyContactName ?? null,
    emergencyContactPhone: p.emergencyContactPhone ?? null,
    profilePictureUrl: p.profilePictureUrl ?? null,
    phoneNumber: p.phoneNumber ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    email: u.email,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
export const patientsRepository = {
  // ── findByUserId ──────────────────────────────────────────────────────────
  async findByUserId(userId: string): Promise<PatientWithUser | null> {
    const rows = await db
      .select()
      .from(patientProfiles)
      .innerJoin(users, eq(patientProfiles.userId, users.id))
      .where(eq(patientProfiles.userId, userId))
      .limit(1);

    if (!rows[0]) return null;
    return mapRow(rows[0].patient_profiles, rows[0].users);
  },

  // ── findById ──────────────────────────────────────────────────────────────
  async findById(patientId: string): Promise<PatientWithUser | null> {
    const rows = await db
      .select()
      .from(patientProfiles)
      .innerJoin(users, eq(patientProfiles.userId, users.id))
      .where(eq(patientProfiles.id, patientId))
      .limit(1);

    if (!rows[0]) return null;
    return mapRow(rows[0].patient_profiles, rows[0].users);
  },

  // ── getPatientHistory ─────────────────────────────────────────────────────
  async getPatientHistory(patientId: string) {
    const apptRows = await db
      .select()
      .from(appointments)
      .where(and(eq(appointments.patientId, patientId), eq(appointments.status, "completed")))
      .orderBy(desc(appointments.scheduledAt));

    if (apptRows.length === 0) {
      return {
        appointments: [],
        notesByApptId: {} as Record<string, typeof consultationNotes.$inferSelect>,
        rxByApptId: {} as Record<string, Array<typeof prescriptions.$inferSelect>>,
      };
    }

    const ids = apptRows.map((a) => a.id);

    const [noteRows, rxRows] = await Promise.all([
      db.select().from(consultationNotes).where(inArray(consultationNotes.appointmentId, ids)),
      db
        .select()
        .from(prescriptions)
        .where(inArray(prescriptions.appointmentId, ids))
        .orderBy(prescriptions.createdAt),
    ]);

    const notesByApptId = Object.fromEntries(noteRows.map((n) => [n.appointmentId, n]));
    const rxByApptId = rxRows.reduce<Record<string, Array<typeof prescriptions.$inferSelect>>>(
      (acc, rx) => {
        (acc[rx.appointmentId] ??= []).push(rx);
        return acc;
      },
      {},
    );

    return { appointments: apptRows, notesByApptId, rxByApptId };
  },

  // ── upsert ────────────────────────────────────────────────────────────────
  // INSERT ... ON CONFLICT (user_id) DO UPDATE
  async upsert(userId: string, data: Partial<UpdatePatientInput>): Promise<PatientWithUser> {
    const dbData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.dateOfBirth !== undefined) dbData.dateOfBirth = data.dateOfBirth;
    if (data.weightKg !== undefined) dbData.weightKg = String(data.weightKg);
    if (data.heightCm !== undefined) dbData.heightCm = String(data.heightCm);
    if (data.bloodType !== undefined) dbData.bloodType = data.bloodType;
    if (data.allergies !== undefined) dbData.allergies = data.allergies;
    if (data.medicalHistory !== undefined) dbData.pastMedicalConditions = data.medicalHistory;
    if (data.emergencyContactName !== undefined) dbData.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone !== undefined) dbData.emergencyContactPhone = data.emergencyContactPhone;

    // We need firstName/lastName for the initial INSERT values — fetch existing first
    const existing = await this.findByUserId(userId);

    await db
      .insert(patientProfiles)
      .values({
        userId,
        firstName: existing?.firstName ?? "",
        lastName: existing?.lastName ?? "",
        ...dbData,
      })
      .onConflictDoUpdate({
        target: patientProfiles.userId,
        set: dbData,
      });

    const updated = await this.findByUserId(userId);
    return updated!;
  },
};