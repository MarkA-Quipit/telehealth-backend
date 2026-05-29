import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  decimal,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod/v4";
import { users } from "../users/users.schema";
import { appointments } from "../appointments/appointments.schema";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const sexEnum = pgEnum("sex", ["male", "female", "other", "prefer_not_to_say"]);
export const bloodTypeEnum = pgEnum("blood_type", ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]);

// ---------------------------------------------------------------------------
// patient_profiles
// ---------------------------------------------------------------------------
export const patientProfiles = pgTable("patient_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  // Identity
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: date("date_of_birth"),
  sex: sexEnum("sex"),
  profilePictureUrl: text("profile_picture_url"),           // external URL

  // Physical
  weightKg: decimal("weight_kg", { precision: 5, scale: 2 }),  // stored in kg
  heightCm: decimal("height_cm", { precision: 5, scale: 2 }),  // stored in cm

  // Contact
  phoneNumber: varchar("phone_number", { length: 30 }),
  address: text("address"),
  emergencyContactName: varchar("emergency_contact_name", { length: 200 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 30 }),

  // Basic medical history (structured fields — spec says "Basic Medical History")
  bloodType: bloodTypeEnum("blood_type").default("unknown"),
  allergies: text("allergies"),                             // free text; comma-separated or prose
  currentMedications: text("current_medications"),
  pastMedicalConditions: text("past_medical_conditions"),
  familyMedicalHistory: text("family_medical_history"),

  // Insurance
  insuranceProvider: varchar("insurance_provider", { length: 150 }),
  insurancePolicyNumber: varchar("insurance_policy_number", { length: 100 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// patient_documents
// ---------------------------------------------------------------------------
export const patientDocuments = pgTable("patient_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patientProfiles.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const patientProfilesRelations = relations(patientProfiles, ({ one, many }) => ({
  user: one(users, { fields: [patientProfiles.userId], references: [users.id] }),
  appointments: many(appointments),
}));

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------
export const updatePatientSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),       // YYYY-MM-DD
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  allergies: z.string().max(1000).optional(),
  medicalHistory: z.string().max(2000).optional(),                       // maps to pastMedicalConditions
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  insuranceProvider: z.string().max(150).optional(),
  insurancePolicyNumber: z.string().max(100).optional(),
});

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
