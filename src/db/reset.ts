import { sql } from 'drizzle-orm';
import { db } from '../config/db';

async function resetAll(): Promise<void> {
  console.log('⚡ Dropping everything (full schema wipe)…\n');

  // Drop the entire public schema and immediately recreate it — this removes
  // all tables, types, sequences, and other objects in one shot without
  // needing to know what's in there.
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS public CASCADE`));
  await db.execute(sql.raw(`CREATE SCHEMA public`));
  console.log('  ✓ Wiped and recreated public schema');

  // Drop Drizzle's migration-tracking schema so db:migrate re-applies
  // all migrations from scratch on the next run.
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS drizzle CASCADE`));
  console.log('  ✓ Dropped drizzle migration-tracking schema');

  console.log('\n✅ Done. Run db:migrate to rebuild the schema.');
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
