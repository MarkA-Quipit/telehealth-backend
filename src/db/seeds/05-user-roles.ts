import { like, or } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { roles, userRoles } from '../../modules/auth/auth.schema';

export async function seedUserRoles(): Promise<void> {
  // Resolve all roles into a map once
  const allRoles = await db.select({ id: roles.id, name: roles.name }).from(roles);
  const roleMap  = new Map(allRoles.map((r) => [r.name, r.id]));

  // Fetch all demo users in one query — classify by email prefix
  const allDemoUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      or(
        like(users.email, 'doctor%@demo.com'),
        like(users.email, 'patient%@demo.com'),
        like(users.email, 'admin%@demo.com'),
      ),
    );

  const rows: { userId: string; roleId: string }[] = [];

  for (const user of allDemoUsers) {
    let roleName: 'admin' | 'doctor' | 'patient';
    if (user.email.startsWith('admin'))   roleName = 'admin';
    else if (user.email.startsWith('doctor')) roleName = 'doctor';
    else roleName = 'patient';

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
