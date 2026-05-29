import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod/v4";
import { doctorProfiles } from "../doctors/doctors.schema";
import { patientProfiles } from "../patients/patients.schema";
import { users } from "../users/users.schema";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",      // booked, awaiting confirmation
  "confirmed",    // doctor/system confirmed
  "cancelled",    // cancelled by patient or doctor
  "completed",    // session ended
  "no_show",      // patient did not join
]);

// ---------------------------------------------------------------------------
// appointments
// ---------------------------------------------------------------------------
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patientProfiles.id, { onDelete: "restrict" }),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctorProfiles.id, { onDelete: "restrict" }),

  // Scheduling
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),

  status: appointmentStatusEnum("status").notNull().default("pending"),

  // Jitsi room — generated as `telehealth-<appointmentId>` on booking
  // Stored so both parties always resolve the same room name
  jitsiRoomName: varchar("jitsi_room_name", { length: 255 }).notNull(),

  // Rescheduling audit
  rescheduledFrom: uuid("rescheduled_from"), // self-ref: previous appointmentId
  cancellationReason: text("cancellation_reason"),
  cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

  // Patient note at booking time (symptoms, concerns)
  patientNote: text("patient_note"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// chat_messages
// ---------------------------------------------------------------------------
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patientProfiles, {
    fields: [appointments.patientId],
    references: [patientProfiles.id],
  }),
  doctor: one(doctorProfiles, {
    fields: [appointments.doctorId],
    references: [doctorProfiles.id],
  }),
  cancelledByUser: one(users, {
    fields: [appointments.cancelledBy],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------
export const sendChatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

export const createAppointmentSchema = z.object({
  doctorId: z.uuid(),
  scheduledAt: z.iso.datetime(),               // ISO UTC, must be future (checked in service)
  durationMinutes: z.number().int().min(15).max(120).default(30).optional(),
  reasonForVisit: z.string().max(500).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(["confirmed", "completed"]),
});

export const cancelAppointmentSchema = z.object({
  cancellationReason: z.string().max(500).optional(),
});

export const rescheduleAppointmentSchema = z.object({
  newScheduledAt: z.iso.datetime(),            // ISO UTC, must be future (checked in service)
  durationMinutes: z.number().int().min(15).max(120).default(30).optional(),
});

export const searchPatientsSchema = z.object({
  q: z.string().min(2).max(200).optional(),
  bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]).optional(),
  sex: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  minConsultations: z.coerce.number().int().min(1).optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type SearchPatientsInput = z.infer<typeof searchPatientsSchema>;
