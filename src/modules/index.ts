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

// Appointments + Consultation Notes + Notifications
export * from "./appointments/appointments.schema";
// (notifications.schema.ts is a re-export shim, already covered above)