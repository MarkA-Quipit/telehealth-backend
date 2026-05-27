-- Day 3: Alter consultation_notes + create prescriptions table
-- consultation_notes: drop old columns, add doctor_id / patient_id / notes,
-- change follow_up_date from timestamptz → date

ALTER TABLE "consultation_notes"
  DROP COLUMN IF EXISTS "clinical_notes",
  DROP COLUMN IF EXISTS "recommendations",
  DROP COLUMN IF EXISTS "prescriptions";
--> statement-breakpoint

ALTER TABLE "consultation_notes"
  ADD COLUMN IF NOT EXISTS "doctor_id" uuid NOT NULL REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "patient_id" uuid NOT NULL REFERENCES "patient_profiles"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "notes" text;
--> statement-breakpoint

-- Change follow_up_date from timestamptz to date (drop & re-add is safest)
ALTER TABLE "consultation_notes"
  DROP COLUMN IF EXISTS "follow_up_date";
--> statement-breakpoint

ALTER TABLE "consultation_notes"
  ADD COLUMN IF NOT EXISTS "follow_up_date" date;
--> statement-breakpoint

-- prescriptions table
CREATE TABLE IF NOT EXISTS "prescriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "appointment_id" uuid NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
  "doctor_id" uuid NOT NULL REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT,
  "patient_id" uuid NOT NULL REFERENCES "patient_profiles"("id") ON DELETE RESTRICT,
  "medication_name" varchar(200) NOT NULL,
  "dosage" varchar(100),
  "frequency" varchar(100),
  "duration" varchar(100),
  "instructions" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
