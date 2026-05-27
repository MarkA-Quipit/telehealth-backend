import { sql } from 'drizzle-orm';
import { db } from '../config/db';

// Tables in reverse dependency order — children first, parents last — so FK
// constraints are never violated.  IF EXISTS makes the script re-entrant and
// CASCADE drops any dependent objects not already covered by the order.
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

async function resetAll(): Promise<void> {
  console.log('⚡ Dropping all tables (full schema wipe)…\n');

  for (const table of TABLES) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table} CASCADE`));
    console.log(`  ✓ Dropped ${table}`);
  }

  console.log(`\n✅ Done — ${TABLES.length} tables dropped. Run db:migrate to rebuild the schema.`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  resetAll()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('✗ Reset failed:', err);
      process.exit(1);
    });
}
