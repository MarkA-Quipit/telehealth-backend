import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod/v4";
import { appointments } from "../appointments/appointments.schema";
import { doctorProfiles } from "../doctors/doctors.schema";
import { patientProfiles } from "../patients/patients.schema";

// ---------------------------------------------------------------------------
// prescriptions  (many per appointment)
// ---------------------------------------------------------------------------
export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctorProfiles.id, { onDelete: "restrict" }),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patientProfiles.id, { onDelete: "restrict" }),

  medicationName: varchar("medication_name", { length: 200 }).notNull(),
  dosage: varchar("dosage", { length: 100 }),
  frequency: varchar("frequency", { length: 100 }),
  duration: varchar("duration", { length: 100 }),
  instructions: text("instructions"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  appointment: one(appointments, {
    fields: [prescriptions.appointmentId],
    references: [appointments.id],
  }),
  doctor: one(doctorProfiles, {
    fields: [prescriptions.doctorId],
    references: [doctorProfiles.id],
  }),
  patient: one(patientProfiles, {
    fields: [prescriptions.patientId],
    references: [patientProfiles.id],
  }),
}));

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------
export const createPrescriptionSchema = z.object({
  medicationName: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  duration: z.string().max(100).optional(),
  instructions: z.string().max(500).optional(),
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type Prescription = typeof prescriptions.$inferSelect;
