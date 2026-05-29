import bcrypt from 'bcryptjs';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';

// ---------------------------------------------------------------------------
// Exported email constants — downstream seeders use these to look up by email
// ---------------------------------------------------------------------------
export const DEMO_EMAILS = {
  admin:    'admin1@demo.com',
  doctor1:  'doctor1@demo.com',
  doctor2:  'doctor2@demo.com',
  doctor3:  'doctor3@demo.com',
  doctor4:  'doctor4@demo.com',
  doctor5:  'doctor5@demo.com',
  patient1: 'patient1@demo.com',
  patient2: 'patient2@demo.com',
  patient3: 'patient3@demo.com',
  patient4: 'patient4@demo.com',
  patient5: 'patient5@demo.com',
} as const;

// ---------------------------------------------------------------------------
// Build all 201 email rows
// admin1 + doctor1..100 + patient1..100
// ---------------------------------------------------------------------------
function buildAllEmails(): string[] {
  const emails: string[] = ['admin1@demo.com'];
  for (let n = 1; n <= 100; n++) emails.push(`doctor${n}@demo.com`);
  for (let n = 1; n <= 100; n++) emails.push(`patient${n}@demo.com`);
  return emails;
}

export async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('pass1234', 10);
  const allEmails = buildAllEmails();

  const inserted = await db
    .insert(users)
    .values(allEmails.map((email) => ({ email, passwordHash })))
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = allEmails.length - insertedCount;
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
