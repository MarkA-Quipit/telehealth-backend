import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { roles, permissions, rolePermissions } from '../../modules/auth/auth.schema';

// Admin is intentionally omitted here — it receives every permission dynamically.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  patient: [
    'appointments:create',
    'appointments:read',
    'appointments:update',
    'appointments:cancel',
    'doctors:read',
    'patients:read',
    'patients:update',
    'prescriptions:read',
    'notifications:read',
  ],
  doctor: [
    'appointments:read',
    'appointments:update',
    'patients:read',
    'notes:create',
    'notes:read',
    'prescriptions:create',
    'prescriptions:read',
    'availability:manage',
    'notifications:read',
  ],
};

export async function seedRolePermissions(): Promise<void> {
  const allRoles       = await db.select({ id: roles.id, name: roles.name }).from(roles);
  const allPermissions = await db.select({ id: permissions.id, name: permissions.name }).from(permissions);

  const roleMap = new Map(allRoles.map((r)       => [r.name, r.id]));
  const permMap = new Map(allPermissions.map((p) => [p.name, p.id]));

  const rows: { roleId: string; permissionId: string }[] = [];

  // Admin gets every permission that exists — no hardcoded list needed.
  const adminRoleId = roleMap.get('admin');
  if (!adminRoleId) {
    console.warn(`  ⚠ role 'admin' not found — skipping admin permissions`);
  } else {
    for (const { id: permissionId } of allPermissions) {
      rows.push({ roleId: adminRoleId, permissionId });
    }
  }

  // Remaining roles use their explicit lists.
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) {
      console.warn(`  ⚠ role '${roleName}' not found — skipping its permissions`);
      continue;
    }
    for (const permName of permNames) {
      const permissionId = permMap.get(permName);
      if (!permissionId) {
        console.warn(`  ⚠ permission '${permName}' not found — skipping`);
        continue;
      }
      rows.push({ roleId, permissionId });
    }
  }

  if (rows.length === 0) {
    console.log('✓ Seeded role-permissions (0 inserted, 0 skipped)');
    return;
  }

  const inserted = await db
    .insert(rolePermissions)
    .values(rows)
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = rows.length - insertedCount;
  console.log(`✓ Seeded role-permissions (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedRolePermissions()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedRolePermissions failed:', err); process.exit(1); });
}
