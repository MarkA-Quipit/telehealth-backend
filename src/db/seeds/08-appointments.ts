import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { doctorProfiles } from '../../modules/doctors/doctors.schema';
import { patientProfiles } from '../../modules/patients/patients.schema';
import { appointments } from '../../modules/appointments/appointments.schema';
import { DEMO_EMAILS } from './04-users';

// ---------------------------------------------------------------------------
// Fixed UUIDs — downstream seeders (notes, prescriptions) import these
// ---------------------------------------------------------------------------
export const DEMO_APPOINTMENT_IDS = {
  pending:   '11111111-1111-1111-1111-111111111111',
  confirmed: '22222222-2222-2222-2222-222222222222',
  completed: '33333333-3333-3333-3333-333333333333',
  cancelled: '44444444-4444-4444-4444-444444444444',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function daysOffset(days: number): Date {
  const d = new Date();
  d.setUTCHours(10, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
export async function seedAppointments(): Promise<void> {
  // Resolve patient profile
  const [patientUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAILS.patient1));

  const [doctor1User] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAILS.doctor1));

  const [doctor2User] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAILS.doctor2));

  if (!patientUser || !doctor1User || !doctor2User) {
    console.warn('  ⚠ One or more required users not found — skipping appointments');
    console.log('✓ Seeded appointments (0 inserted, 4 skipped)');
    return;
  }

  const [patientProfile] = await db
    .select({ id: patientProfiles.id })
    .from(patientProfiles)
    .where(eq(patientProfiles.userId, patientUser.id));

  const [doctor1Profile] = await db
    .select({ id: doctorProfiles.id })
    .from(doctorProfiles)
    .where(eq(doctorProfiles.userId, doctor1User.id));

  const [doctor2Profile] = await db
    .select({ id: doctorProfiles.id })
    .from(doctorProfiles)
    .where(eq(doctorProfiles.userId, doctor2User.id));

  if (!patientProfile || !doctor1Profile || !doctor2Profile) {
    console.warn('  ⚠ One or more required profiles not found — skipping appointments');
    console.log('✓ Seeded appointments (0 inserted, 4 skipped)');
    return;
  }

  // Scheduled times
  const tomorrow  = daysOffset(1);                         // pending: tomorrow 10:00 UTC
  const confirmed = addMinutes(new Date(), 120);           // confirmed: today + 2h (join-window testable)
  const completed = daysOffset(-3);                        // completed: 3 days ago
  const cancelled = daysOffset(-5);                        // cancelled: 5 days ago

  const DURATION = 30; // minutes

  const rows = [
    {
      id:            DEMO_APPOINTMENT_IDS.pending,
      patientId:     patientProfile.id,
      doctorId:      doctor1Profile.id,
      scheduledAt:   tomorrow,
      endsAt:        addMinutes(tomorrow, DURATION),
      status:        'pending'   as const,
      jitsiRoomName: DEMO_APPOINTMENT_IDS.pending,
      patientNote:   'Routine cardiac checkup and blood pressure review',
    },
    {
      id:            DEMO_APPOINTMENT_IDS.confirmed,
      patientId:     patientProfile.id,
      doctorId:      doctor2Profile.id,
      scheduledAt:   confirmed,
      endsAt:        addMinutes(confirmed, DURATION),
      status:        'confirmed' as const,
      jitsiRoomName: DEMO_APPOINTMENT_IDS.confirmed,
      patientNote:   'Feeling fatigued and having trouble sleeping',
    },
    {
      id:            DEMO_APPOINTMENT_IDS.completed,
      patientId:     patientProfile.id,
      doctorId:      doctor1Profile.id,
      scheduledAt:   completed,
      endsAt:        addMinutes(completed, DURATION),
      status:        'completed' as const,
      jitsiRoomName: DEMO_APPOINTMENT_IDS.completed,
      patientNote:   'Follow-up after ECG results',
    },
    {
      id:               DEMO_APPOINTMENT_IDS.cancelled,
      patientId:        patientProfile.id,
      doctorId:         doctor2Profile.id,
      scheduledAt:      cancelled,
      endsAt:           addMinutes(cancelled, DURATION),
      status:           'cancelled'               as const,
      jitsiRoomName:    DEMO_APPOINTMENT_IDS.cancelled,
      patientNote:      'Headache and dizziness',
      cancellationReason: 'Patient requested reschedule',
      cancelledBy:      patientUser.id,
      cancelledAt:      cancelled,
    },
  ];

  const inserted = await db
    .insert(appointments)
    .values(rows)
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = rows.length - insertedCount;
  console.log(`✓ Seeded appointments (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedAppointments()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedAppointments failed:', err); process.exit(1); });
}
