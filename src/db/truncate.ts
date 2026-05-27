import { sql } from 'drizzle-orm';
import { db } from '../config/db';

async function truncateAll(): Promise<void> {
  console.log('⚡ Truncating all tables…\n');

  // Discover every table currently in the public schema at runtime.
  const result = await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );

  const tables = result.rows.map((r) => (r as { tablename: string }).tablename);

  if (tables.length === 0) {
    console.log('  ℹ No tables found — nothing to truncate.');
    return;
  }

  // Truncate all tables in a single statement with CASCADE so FK order
  // doesn't matter, and RESTART IDENTITY resets all sequences.
  const tableList = tables.map((t) => `"${t}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE`));

  for (const table of tables) {
    console.log(`  ✓ Truncated ${table}`);
  }

  console.log(`\n✅ Done — ${tables.length} tables truncated, sequences reset.`);
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
