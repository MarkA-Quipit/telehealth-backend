import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { roles, userRoles } from '../../modules/auth/auth.schema';
import { DEMO_EMAILS } from './04-users';

const ASSIGNMENTS = [
  { email: DEMO_EMAILS.admin,    roleName: 'admin'   },
  { email: DEMO_EMAILS.doctor1,  roleName: 'doctor'  },
  { email: DEMO_EMAILS.doctor2,  roleName: 'doctor'  },
  { email: DEMO_EMAILS.doctor3,  roleName: 'doctor'  },
  { email: DEMO_EMAILS.doctor4,  roleName: 'doctor'  },
  { email: DEMO_EMAILS.doctor5,  roleName: 'doctor'  },
  { email: DEMO_EMAILS.patient1, roleName: 'patient' },
  { email: DEMO_EMAILS.patient2, roleName: 'patient' },
  { email: DEMO_EMAILS.patient3, roleName: 'patient' },
  { email: DEMO_EMAILS.patient4, roleName: 'patient' },
  { email: DEMO_EMAILS.patient5, roleName: 'patient' },
] as const;

export async function seedUserRoles(): Promise<void> {
  // Resolve all roles into a map
  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles);
  const roleMap  = new Map(allRoles.map((r) => [r.name, r.id]));

  const rows: { userId: string; roleId: string }[] = [];

  for (const { email, roleName } of ASSIGNMENTS) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (!user) { console.warn(`  ⚠ user '${email}' not found — skipping`); continue; }

    const roleId = roleMap.get(roleName);
    if (!roleId) { console.warn(`  ⚠ role '${roleName}' not found — skipping`); continue; }

    rows.push({ userId: user.id, roleId });
  }

  if (rows.length === 0) {
    console.log('✓ Seeded user-roles (0 inserted, 0 skipped)');
    return;
  }

  const inserted = await db
    .insert(userRoles)
    .values(rows)
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = rows.length - insertedCount;
  console.log(`✓ Seeded user-roles (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedUserRoles()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedUserRoles failed:', err); process.exit(1); });
}
