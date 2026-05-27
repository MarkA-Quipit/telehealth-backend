import { sql } from 'drizzle-orm';
import { db } from '../config/db';

// Tables in reverse dependency order — children first, parents last — so FK
// constraints are never violated.  RESTART IDENTITY resets auto-increment
// sequences; CASCADE handles any FK references not already covered by the order.
const TABLES = [
  'notifications',
  'prescriptions',
  'consultation_notes',
  'appointments',
  'doctor_blocked_slots',
  'doctor_availability',
  'doctor_profiles',
  'patient_profiles',
  'user_roles',
  'role_permissions',
  'permissions',
  'roles',
  'users',
] as const;

async function truncateAll(): Promise<void> {
  console.log('⚡ Truncating all tables…\n');

  for (const table of TABLES) {
    await db.execute(sql.raw(`TRUNCATE ${table} RESTART IDENTITY CASCADE`));
    console.log(`  ✓ Truncated ${table}`);
  }

  console.log(`\n✅ Done — ${TABLES.length} tables truncated, sequences reset.`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  truncateAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('✗ Truncation failed:', err);
      process.exit(1);
    });
}
