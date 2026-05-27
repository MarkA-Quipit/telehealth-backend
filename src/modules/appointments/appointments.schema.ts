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

export const notificationTypeEnum = pgEnum("notification_type", [
  "appointment_booked",
  "appointment_confirmed",
  "appointment_cancelled",
  "appointment_rescheduled",
  "appointment_reminder",   // upcoming appointment nudge
  "appointment_completed",
  "prescription_added",
  "general",
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
// notifications  (persistent inbox — Pusher handles real-time fanout)
// ---------------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),

  // Optional deep-link context
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),

  isRead: timestamp("is_read", { withTimezone: true }),   // null = unread; timestamp = read-at

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
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
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  appointment: one(appointments, {
    fields: [notifications.appointmentId],
    references: [appointments.id],
  }),
}));

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------
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

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;
