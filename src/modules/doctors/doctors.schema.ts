import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  time,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod/v4";
import { users } from "../users/users.schema";
import { appointments } from "../appointments/appointments.schema";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// Days of week for recurring availability
export const dayOfWeekEnum = pgEnum("day_of_week", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

// ---------------------------------------------------------------------------
// doctor_profiles
// ---------------------------------------------------------------------------
export const doctorProfiles = pgTable("doctor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  // Identity & display
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  profilePictureUrl: text("profile_picture_url"),          // external URL (Cloudinary / S3 / etc.)

  // Professional
  specialization: varchar("specialization", { length: 150 }).notNull(),
  bio: text("bio"),
  licenseNumber: varchar("license_number", { length: 100 }),
  yearsOfExperience: integer("years_of_experience"),

  // Contact
  phoneNumber: varchar("phone_number", { length: 30 }),

  // Consultation pricing (optional but useful for UX display)
  consultationFee: integer("consultation_fee"),            // stored in smallest currency unit (centavos)

  // Admin control
  isVerified: boolean("is_verified").notNull().default(false),
  isAcceptingPatients: boolean("is_accepting_patients").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// doctor_availability  (recurring weekly schedule)
// Doctors define their weekly repeating slots here.
// ---------------------------------------------------------------------------
export const doctorAvailability = pgTable("doctor_availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctorProfiles.id, { onDelete: "cascade" }),

  dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
  startTime: time("start_time").notNull(),                 // e.g. "09:00"
  endTime: time("end_time").notNull(),                     // e.g. "10:00"
  slotDurationMinutes: integer("slot_duration_minutes").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// doctor_blocked_slots  (one-off unavailability — "restrict unavailable times")
// ---------------------------------------------------------------------------
export const doctorBlockedSlots = pgTable("doctor_blocked_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id")
    .notNull()
    .references(() => doctorProfiles.id, { onDelete: "cascade" }),

  blockedDate: timestamp("blocked_date", { withTimezone: true }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  reason: text("reason"),                                  // optional note for doctor's own reference

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const doctorProfilesRelations = relations(doctorProfiles, ({ one, many }) => ({
  user: one(users, { fields: [doctorProfiles.userId], references: [users.id] }),
  availability: many(doctorAvailability),
  blockedSlots: many(doctorBlockedSlots),
  appointments: many(appointments),
}));

export const doctorAvailabilityRelations = relations(doctorAvailability, ({ one }) => ({
  doctor: one(doctorProfiles, {
    fields: [doctorAvailability.doctorId],
    references: [doctorProfiles.id],
  }),
}));

export const doctorBlockedSlotsRelations = relations(doctorBlockedSlots, ({ one }) => ({
  doctor: one(doctorProfiles, {
    fields: [doctorBlockedSlots.doctorId],
    references: [doctorProfiles.id],
  }),
}));

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------
export const updateDoctorSchema = z.object({
  specialization: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  licenseNumber: z.string().max(50).optional(),
  yearsOfExperience: z.number().int().min(0).optional(),
  consultationFee: z.number().positive().optional(),
  isAcceptingPatients: z.boolean().optional(),
});

export const setAvailabilitySchema = z.object({
  availability: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      isAvailable: z.boolean(),
    }),
  ),
});

export const blockSlotSchema = z.object({
  blockedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().max(200).optional(),
});

export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
export type BlockSlotInput = z.infer<typeof blockSlotSchema>;
