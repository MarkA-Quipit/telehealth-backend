import bcrypt from 'bcryptjs';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';

// ---------------------------------------------------------------------------
// Exported email constants — downstream seeders use these to look up by email
// ---------------------------------------------------------------------------
export const DEMO_EMAILS = {
  admin:  'admin1@demo.com',
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

const DEMO_USERS = [
  { email: DEMO_EMAILS.admin,    firstName: 'Admin',  lastName: 'User'   },
  { email: DEMO_EMAILS.doctor1,  firstName: 'Maria', lastName: 'Santos' },
  { email: DEMO_EMAILS.doctor2,  firstName: 'Jose',  lastName: 'Reyes'  },
  { email: DEMO_EMAILS.doctor3,  firstName: 'John',  lastName: 'Gonzales'  },
  { email: DEMO_EMAILS.doctor4,  firstName: 'Carlos',  lastName: 'Lopez'  },
  { email: DEMO_EMAILS.doctor5,  firstName: 'Alex',  lastName: 'Smith'  },
  { email: DEMO_EMAILS.patient1, firstName: 'Ana',   lastName: 'Cruz'   },
  { email: DEMO_EMAILS.patient2, firstName: 'Julia',   lastName: 'Rodriguez'   },
  { email: DEMO_EMAILS.patient3, firstName: 'Maria',   lastName: 'Gonzalez'   },
  { email: DEMO_EMAILS.patient4, firstName: 'Carlos',   lastName: 'Lopez'   },
  { email: DEMO_EMAILS.patient5, firstName: 'Sofia',   lastName: 'Martinez'   },
] as const;

export async function seedUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash('pass1234', 10);

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
