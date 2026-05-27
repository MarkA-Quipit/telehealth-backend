import { pgTable, uuid, text, date, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod/v4";
import { appointments } from "../appointments/appointments.schema";
import { doctorProfiles } from "../doctors/doctors.schema";
import { patientProfiles } from "../patients/patients.schema";

// ---------------------------------------------------------------------------
// consultation_notes  (one per appointment — doctor-authored)
// ---------------------------------------------------------------------------
export const consultationNotes = pgTable("consultation_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .unique()
    .references(() => appointments.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctorProfiles.id, { onDelete: "restrict" }),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patientProfiles.id, { onDelete: "restrict" }),

  chiefComplaint: text("chief_complaint"),
  diagnosis: text("diagnosis"),
  notes: text("notes"),
  followUpDate: date("follow_up_date"),               // stored as YYYY-MM-DD string

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const consultationNotesRelations = relations(consultationNotes, ({ one }) => ({
  appointment: one(appointments, {
    fields: [consultationNotes.appointmentId],
    references: [appointments.id],
  }),
  doctor: one(doctorProfiles, {
    fields: [consultationNotes.doctorId],
    references: [doctorProfiles.id],
  }),
  patient: one(patientProfiles, {
    fields: [consultationNotes.patientId],
    references: [patientProfiles.id],
  }),
}));

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------
export const createNotesSchema = z.object({
  chiefComplaint: z.string().max(1000).optional(),
  diagnosis: z.string().max(1000).optional(),
  notes: z.string().max(3000).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateNotesSchema = createNotesSchema;

export type CreateNoteData = z.infer<typeof createNotesSchema>;
export type ConsultationNote = typeof consultationNotes.$inferSelect;
