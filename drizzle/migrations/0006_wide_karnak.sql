CREATE TABLE "patient_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"url" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(100) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patient_id_patient_profiles_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient_profiles"("id") ON DELETE cascade ON UPDATE no action;