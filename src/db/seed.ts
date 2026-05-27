/**
 * seed.ts
 * Run with: npx tsx src/db/seed.ts
 *
 * Seeds:
 *  - roles: patient, doctor
 *  - permissions: scoped action strings
 *  - role_permissions: maps permissions to roles
 *  - users: 5 patients + 5 doctors (dev accounts)
 *  - user_roles, patient_profiles, doctor_profiles
 *
 * All inserts are idempotent — safe to re-run.
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../config/db";
import { roles, permissions, rolePermissions, userRoles } from "../modules/auth/auth.schema";
import { users } from "../modules/users/users.schema";
import { patientProfiles } from "../modules/patients/patients.schema";
import { doctorProfiles } from "../modules/doctors/doctors.schema";

// ---------------------------------------------------------------------------
// Permission definitions
// Format: "<resource>:<action>"
// ---------------------------------------------------------------------------
const PERMISSIONS = [
  // Appointments
  { name: "appointments:book",        description: "Book a new appointment" },
  { name: "appointments:cancel_own",  description: "Cancel own appointment" },
  { name: "appointments:reschedule",  description: "Reschedule an appointment" },
  { name: "appointments:view_own",    description: "View own appointments" },
  { name: "appointments:view_all",    description: "View all appointments (doctor scope)" },
  { name: "appointments:manage",      description: "Manage all appointments (admin scope)" },

  // Consultation
  { name: "consultation:join",        description: "Join a consultation session" },
  { name: "consultation:notes_write", description: "Write consultation notes and prescriptions" },
  { name: "consultation:notes_read",  description: "Read consultation notes" },

  // Doctors
  { name: "doctors:view",             description: "Browse doctor profiles" },
  { name: "doctors:manage_schedule",  description: "Manage own availability and blocked slots" },
  { name: "doctors:block_slot",       description: "Block unavailable time slots" },

  // Patients
  { name: "patients:view_own",        description: "View own patient profile and records" },
  { name: "patients:view_all",        description: "View all patient records (doctor scope)" },

  // Profiles
  { name: "profile:update_own",       description: "Update own profile" },

  // Notifications
  { name: "notifications:read_own",   description: "Read own notifications" },

  // AI
  { name: "ai:recommend_doctor",      description: "Use AI doctor recommendation" },
] as const;

// ---------------------------------------------------------------------------
// Role → permission mappings
// ---------------------------------------------------------------------------
const ROLE_PERMISSIONS: Record<string, string[]> = {
  patient: [
    "appointments:book",
    "appointments:cancel_own",
    "appointments:reschedule",
    "appointments:view_own",
    "consultation:join",
    "consultation:notes_read",
    "doctors:view",
    "patients:view_own",
    "profile:update_own",
    "notifications:read_own",
    "ai:recommend_doctor",
  ],
  doctor: [
    "appointments:view_all",
    "appointments:cancel_own",
    "consultation:join",
    "consultation:notes_write",
    "consultation:notes_read",
    "doctors:manage_schedule",
    "doctors:block_slot",
    "patients:view_all",
    "profile:update_own",
    "notifications:read_own",
  ],
};

// ---------------------------------------------------------------------------
// Seed users
// Default password for all dev accounts: pass1234
// ---------------------------------------------------------------------------
const SEED_PASSWORD = "pass1234";

const SEED_PATIENTS = [
  { email: "jane.cooper@example.com",    firstName: "Jane",    lastName: "Cooper"    },
  { email: "michael.torres@example.com", firstName: "Michael", lastName: "Torres"   },
  { email: "emily.chen@example.com",     firstName: "Emily",   lastName: "Chen"     },
  { email: "david.okafor@example.com",   firstName: "David",   lastName: "Okafor"   },
  { email: "sarah.williams@example.com", firstName: "Sarah",   lastName: "Williams" },
];

const SEED_DOCTORS = [
  { email: "robert.smith@example.com",  firstName: "Robert",  lastName: "Smith",   specialization: "Cardiology"    },
  { email: "maria.santos@example.com",  firstName: "Maria",   lastName: "Santos",  specialization: "Dermatology"   },
  { email: "james.lee@example.com",     firstName: "James",   lastName: "Lee",     specialization: "Neurology"     },
  { email: "priya.patel@example.com",   firstName: "Priya",   lastName: "Patel",   specialization: "Pediatrics"    },
  { email: "carlos.rivera@example.com", firstName: "Carlos",  lastName: "Rivera",  specialization: "Orthopedics"   },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inserts a user if not present; returns the user row either way. */
async function findOrCreateUser(email: string, passwordHash: string) {
  await db.insert(users).values({ email, passwordHash }).onConflictDoNothing();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------
async function seed() {
  console.log("🌱 Starting seed...");

  // 1. Upsert permissions
  console.log("  → Seeding permissions...");
  for (const perm of PERMISSIONS) {
    await db
      .insert(permissions)
      .values(perm)
      .onConflictDoUpdate({
        target: permissions.name,
        set: { description: perm.description },
      });
  }

  // 2. Upsert roles
  console.log("  → Seeding roles...");
  const roleNames = Object.keys(ROLE_PERMISSIONS);
  for (const roleName of roleNames) {
    await db
      .insert(roles)
      .values({ name: roleName, description: `${roleName} role` })
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: `${roleName} role` },
      });
  }

  // 3. Fetch inserted roles and permissions for FK resolution
  const allRoles = await db.select().from(roles);
  const allPermissions = await db.select().from(permissions);

  const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));
  const permMap = Object.fromEntries(allPermissions.map((p) => [p.name, p.id]));

  // 4. Upsert role_permissions
  console.log("  → Seeding role_permissions...");
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap[roleName];
    if (!roleId) {
      console.warn(`    ⚠ Role '${roleName}' not found — skipping`);
      continue;
    }
    for (const permName of permNames) {
      const permissionId = permMap[permName];
      if (!permissionId) {
        console.warn(`    ⚠ Permission '${permName}' not found — skipping`);
        continue;
      }
      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId })
        .onConflictDoNothing();
    }
  }

  // 5. Hash shared password once
  console.log("  → Hashing seed password...");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  // 6. Seed patients
  console.log("  → Seeding 5 patients...");
  const patientRoleId = roleMap["patient"];
  for (const p of SEED_PATIENTS) {
    const user = await findOrCreateUser(p.email, passwordHash);
    await db.insert(userRoles).values({ userId: user.id, roleId: patientRoleId }).onConflictDoNothing();
    await db
      .insert(patientProfiles)
      .values({ userId: user.id, firstName: p.firstName, lastName: p.lastName })
      .onConflictDoNothing();
    console.log(`     ✓ patient ${p.email}`);
  }

  // 7. Seed doctors
  console.log("  → Seeding 5 doctors...");
  const doctorRoleId = roleMap["doctor"];
  for (const d of SEED_DOCTORS) {
    const user = await findOrCreateUser(d.email, passwordHash);
    await db.insert(userRoles).values({ userId: user.id, roleId: doctorRoleId }).onConflictDoNothing();
    await db
      .insert(doctorProfiles)
      .values({ userId: user.id, firstName: d.firstName, lastName: d.lastName, specialization: d.specialization })
      .onConflictDoNothing();
    console.log(`     ✓ doctor  ${d.email}`);
  }

  console.log("✅ Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
