import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { db } from '../config/db';

async function runMigrations(): Promise<void> {
  console.log('⚡ Running migrations…\n');

  await migrate(db, { migrationsFolder: 'drizzle/migrations' });

  console.log('\n✅ All migrations applied successfully.');
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('✗ Migration failed:', err);
      process.exit(1);
    });
}
