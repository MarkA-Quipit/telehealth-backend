// Central schema barrel — import from here in drizzle.config.ts or anywhere
// you need the full schema object (e.g. for db.query.* relational queries).

// Users
export * from "./users/users.schema";

// Auth / RBAC
export * from "./auth/auth.schema";

// Doctors
export * from "./doctors/doctors.schema";

// Patients
export * from "./patients/patients.schema";

// Appointments + Notifications
export * from "./appointments/appointments.schema";

// Consultation Notes (now its own module)
export * from "./consultations/consultations.schema";

// Prescriptions
export * from "./prescriptions/prescriptions.schema";