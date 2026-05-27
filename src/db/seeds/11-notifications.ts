import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { notifications } from '../../modules/notifications/notifications.schema';
import { DEMO_APPOINTMENT_IDS } from './08-appointments';
import { DEMO_EMAILS } from './04-users';

// ---------------------------------------------------------------------------
// Fixed UUIDs for idempotent seeding
// ---------------------------------------------------------------------------
const DEMO_NOTIFICATION_IDS = {
  confirmed:  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  completed:  'dddddddd-dddd-dddd-dddd-dddddddddddd',
} as const;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
export async function seedNotifications(): Promise<void> {
  // Look up patient1 user
  const [patientUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAILS.patient1));

  if (!patientUser) {
    console.warn('  ⚠ patient1 user not found — skipping notifications seed');
    console.log('✓ Seeded notifications (0 inserted, 2 skipped)');
    return;
  }

  const rows = [
    {
      id:      DEMO_NOTIFICATION_IDS.confirmed,
      userId:  patientUser.id,
      type:    'appointment_confirmed' as const,
      title:   'Appointment Confirmed',
      message: 'Dr. Jose Reyes confirmed your appointment.',
      data:    { appointmentId: DEMO_APPOINTMENT_IDS.confirmed },
      isRead:  false,
    },
    {
      id:      DEMO_NOTIFICATION_IDS.completed,
      userId:  patientUser.id,
      type:    'appointment_completed' as const,
      title:   'Consultation Complete',
      message: 'Your consultation with Dr. Maria Santos is complete. View your notes and prescriptions.',
      data:    { appointmentId: DEMO_APPOINTMENT_IDS.completed },
      isRead:  true,
    },
  ];

  const inserted = await db
    .insert(notifications)
    .values(rows)
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = rows.length - insertedCount;
  console.log(`✓ Seeded notifications (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedNotifications()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('✗ seedNotifications failed:', err);
      process.exit(1);
    });
}
