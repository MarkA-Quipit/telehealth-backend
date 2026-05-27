import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { patientProfiles } from '../../modules/patients/patients.schema';
import { DEMO_EMAILS } from './04-users';

export async function seedPatients(): Promise<void> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAILS.patient1));

  if (!user) {
    console.warn(`  ⚠ user '${DEMO_EMAILS.patient1}' not found — skipping patient profile`);
    console.log('✓ Seeded patient profiles (0 inserted, 1 skipped)');
    return;
  }

  const result = await db
    .insert(patientProfiles)
    .values({
      userId:                user.id,
      firstName:             'Ana',
      lastName:              'Cruz',
      dateOfBirth:           '1990-05-15',
      bloodType:             'O+',
      allergies:             'Penicillin, Aspirin',
      pastMedicalConditions: 'Hypertension diagnosed 2019, currently managed with medication.',
      emergencyContactName:  'Juan Cruz',
      emergencyContactPhone: '+63 912 345 6789',
    })
    .onConflictDoNothing()
    .returning();

  const insertedCount = result.length;
  const skippedCount  = 1 - insertedCount;
  console.log(`✓ Seeded patient profiles (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedPatients()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedPatients failed:', err); process.exit(1); });
}
