import { db } from '../../config/db';
import { roles } from '../../modules/auth/auth.schema';

const ROLES = [
  { name: 'admin',   description: 'Admin user'    },
  { name: 'patient', description: 'Patient user' },
  { name: 'doctor',  description: 'Doctor user'  },
] as const;

export async function seedRoles(): Promise<void> {
  const inserted = await db
    .insert(roles)
    .values(ROLES.map((r) => ({ name: r.name, description: r.description })))
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = ROLES.length - insertedCount;
  console.log(`✓ Seeded roles (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedRoles()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedRoles failed:', err); process.exit(1); });
}
