import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import { consultationNotes } from "./consultations.schema";
import type { ConsultationNote, CreateNoteData } from "./consultations.schema";

export type { ConsultationNote };

export const consultationsRepository = {
  // ── findNotesByAppointmentId ──────────────────────────────────────────────
  async findNotesByAppointmentId(appointmentId: string): Promise<ConsultationNote | null> {
    const rows = await db
      .select()
      .from(consultationNotes)
      .where(eq(consultationNotes.appointmentId, appointmentId))
      .limit(1);
    return rows[0] ?? null;
  },

  // ── createNote ────────────────────────────────────────────────────────────
  async createNote(data: {
    appointmentId: string;
    doctorId: string;
    patientId: string;
  } & CreateNoteData): Promise<ConsultationNote> {
    const result = await db
      .insert(consultationNotes)
      .values({
        appointmentId: data.appointmentId,
        doctorId: data.doctorId,
        patientId: data.patientId,
        chiefComplaint: data.chiefComplaint ?? null,
        diagnosis: data.diagnosis ?? null,
        notes: data.notes ?? null,
        followUpDate: data.followUpDate ?? null,
      })
      .returning();
    return result[0];
  },

  // ── updateNote ────────────────────────────────────────────────────────────
  async updateNote(appointmentId: string, data: Partial<CreateNoteData>): Promise<ConsultationNote> {
    const dbData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.chiefComplaint !== undefined) dbData.chiefComplaint = data.chiefComplaint;
    if (data.diagnosis !== undefined) dbData.diagnosis = data.diagnosis;
    if (data.notes !== undefined) dbData.notes = data.notes;
    if (data.followUpDate !== undefined) dbData.followUpDate = data.followUpDate;

    const result = await db
      .update(consultationNotes)
      .set(dbData)
      .where(eq(consultationNotes.appointmentId, appointmentId))
      .returning();
    return result[0];
  },
};
