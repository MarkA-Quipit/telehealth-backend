import { db } from '../../config/db';
import { permissions } from '../../modules/auth/auth.schema';

const PERMISSIONS = [
  { name: 'appointments:create',    description: 'Book a new appointment'           },
  { name: 'appointments:read',      description: 'View appointments'                 },
  { name: 'appointments:update',    description: 'Update appointment details'        },
  { name: 'appointments:cancel',    description: 'Cancel an appointment'             },
  { name: 'doctors:read',           description: 'Browse doctor profiles'            },
  { name: 'patients:read',          description: 'View patient records'              },
  { name: 'patients:update',        description: 'Update patient profile'            },
  { name: 'notes:create',           description: 'Write consultation notes'          },
  { name: 'notes:read',             description: 'Read consultation notes'           },
  { name: 'prescriptions:create',   description: 'Issue prescriptions'               },
  { name: 'prescriptions:read',     description: 'View prescriptions'                },
  { name: 'availability:manage',    description: 'Manage doctor availability'        },
  { name: 'notifications:read',     description: 'Read own notifications'            },
] as const;

export async function seedPermissions(): Promise<void> {
  const inserted = await db
    .insert(permissions)
    .values(PERMISSIONS.map((p) => ({ name: p.name, description: p.description })))
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = PERMISSIONS.length - insertedCount;
  console.log(`✓ Seeded permissions (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedPermissions()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedPermissions failed:', err); process.exit(1); });
}
