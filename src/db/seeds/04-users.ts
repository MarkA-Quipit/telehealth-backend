import bcrypt from 'bcryptjs';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';

// ---------------------------------------------------------------------------
// Exported email constants — downstream seeders use these to look up by email
// ---------------------------------------------------------------------------
export const DEMO_EMAILS = {
  doctor1:  'doctor1@demo.com',
  doctor2:  'doctor2@demo.com',
  patient1: 'patient1@demo.com',
} as const;

const DEMO_USERS = [
  { email: DEMO_EMAILS.doctor1,  firstName: 'Maria', lastName: 'Santos' },
  { email: DEMO_EMAILS.doctor2,  firstName: 'Jose',  lastName: 'Reyes'  },
  { email: DEMO_EMAILS.patient1, firstName: 'Ana',   lastName: 'Cruz'   },
] as const;

export async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 10);

  const inserted = await db
    .insert(users)
    .values(DEMO_USERS.map((u) => ({ email: u.email, passwordHash })))
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = DEMO_USERS.length - insertedCount;
  console.log(`✓ Seeded users (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedUsers()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedUsers failed:', err); process.exit(1); });
}
