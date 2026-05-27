import { and, eq } from "drizzle-orm";
import { db } from "../../config/db";
import { prescriptions } from "./prescriptions.schema";
import type { CreatePrescriptionInput, Prescription } from "./prescriptions.schema";

export type { Prescription };

export const prescriptionsRepository = {
  // ── findByAppointmentId ───────────────────────────────────────────────────
  async findByAppointmentId(appointmentId: string): Promise<Prescription[]> {
    return db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.appointmentId, appointmentId))
      .orderBy(prescriptions.createdAt);
  },

  // ── create ────────────────────────────────────────────────────────────────
  async create(data: {
    appointmentId: string;
    doctorId: string;
    patientId: string;
  } & CreatePrescriptionInput): Promise<Prescription> {
    const result = await db
      .insert(prescriptions)
      .values({
        appointmentId: data.appointmentId,
        doctorId: data.doctorId,
        patientId: data.patientId,
        medicationName: data.medicationName,
        dosage: data.dosage ?? null,
        frequency: data.frequency ?? null,
        duration: data.duration ?? null,
        instructions: data.instructions ?? null,
      })
      .returning();
    return result[0];
  },

  // ── deleteById ────────────────────────────────────────────────────────────
  // Ownership check: only deletes when doctor_id matches
  async deleteById(prescriptionId: string, doctorId: string): Promise<void> {
    await db
      .delete(prescriptions)
      .where(
        and(
          eq(prescriptions.id, prescriptionId),
          eq(prescriptions.doctorId, doctorId),
        ),
      );
  },
};
