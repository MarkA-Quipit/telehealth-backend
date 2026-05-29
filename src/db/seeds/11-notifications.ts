import { eq, notInArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { doctorProfiles } from '../../modules/doctors/doctors.schema';
import { patientProfiles } from '../../modules/patients/patients.schema';
import { appointments } from '../../modules/appointments/appointments.schema';
import { notifications } from '../../modules/notifications/notifications.schema';
import { DEMO_APPOINTMENT_IDS } from './08-appointments';
import { DEMO_EMAILS } from './04-users';

// Fixed UUIDs for the 2 original demo notifications
const DEMO_NOTIFICATION_IDS = {
  confirmed: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  completed: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
} as const;

// Bulk notification UUID: bb{6-digit-index}-0000-0000-0000-000000000000
function bulkNotifId(k: number): string {
  return `bb${String(k).padStart(6, '0')}-0000-0000-0000-000000000000`;
}

const STATUS_TO_TYPE = {
  pending:   'appointment_booked',
  confirmed: 'appointment_confirmed',
  completed: 'appointment_completed',
  cancelled: 'appointment_cancelled',
} as const;

const STATUS_TO_TITLE = {
  pending:   'Appointment Booked',
  confirmed: 'Appointment Confirmed',
  completed: 'Consultation Complete',
  cancelled: 'Appointment Cancelled',
} as const;

export async function seedNotifications(): Promise<void> {
  // ── Demo notifications (2 fixed) ─────────────────────────────────────────
  const [patientUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAILS.patient1));

  if (patientUser) {
    const demoRows = [
      {
        id: DEMO_NOTIFICATION_IDS.confirmed, userId: patientUser.id,
        type: 'appointment_confirmed' as const, title: 'Appointment Confirmed',
        message: 'Dr. Jose Reyes confirmed your appointment.',
        data: { appointmentId: DEMO_APPOINTMENT_IDS.confirmed }, isRead: false,
      },
      {
        id: DEMO_NOTIFICATION_IDS.completed, userId: patientUser.id,
        type: 'appointment_completed' as const, title: 'Consultation Complete',
        message: 'Your consultation with Dr. Maria Santos is complete. View your notes and prescriptions.',
        data: { appointmentId: DEMO_APPOINTMENT_IDS.completed }, isRead: true,
      },
    ];
    const demoInserted = await db.insert(notifications).values(demoRows).onConflictDoNothing().returning();
    console.log(`✓ Seeded demo notifications (${demoInserted.length} inserted, ${demoRows.length - demoInserted.length} skipped)`);
  } else {
    console.warn('  ⚠ patient1 user not found — skipping demo notifications');
  }

  // ── Bulk notifications (1 per bulk appointment) ───────────────────────────
  // Join appointments → patient profile → patient user → doctor profile
  const DEMO_IDS = Object.values(DEMO_APPOINTMENT_IDS);

  const bulkAppts = await db
    .select({
      id:              appointments.id,
      status:          appointments.status,
      patientUserId:   patientProfiles.userId,
      doctorFirstName: doctorProfiles.firstName,
      doctorLastName:  doctorProfiles.lastName,
    })
    .from(appointments)
    .innerJoin(patientProfiles, eq(appointments.patientId, patientProfiles.id))
    .innerJoin(doctorProfiles,  eq(appointments.doctorId,  doctorProfiles.id))
    .where(notInArray(appointments.id, DEMO_IDS));

  if (bulkAppts.length === 0) {
    console.log('✓ Seeded bulk notifications (0 inserted, 0 skipped)');
    return;
  }

  const bulkRows = bulkAppts.map((appt, k) => {
    const status   = appt.status as 'pending' | 'confirmed' | 'completed' | 'cancelled';
    const type     = STATUS_TO_TYPE[status];
    const title    = STATUS_TO_TITLE[status];
    const docName  = `Dr. ${appt.doctorFirstName} ${appt.doctorLastName}`;

    const messageMap: Record<string, string> = {
      appointment_booked:    `Your appointment with ${docName} has been booked.`,
      appointment_confirmed: `${docName} confirmed your appointment.`,
      appointment_completed: `Your consultation with ${docName} is complete.`,
      appointment_cancelled: `Your appointment with ${docName} has been cancelled.`,
    };

    return {
      id:      bulkNotifId(k + 1),
      userId:  appt.patientUserId,
      type,
      title,
      message: messageMap[type]!,
      data:    { appointmentId: appt.id },
      isRead:  status === 'completed', // completed notifications are pre-read
    };
  });

  let bulkInserted = 0;
  for (let start = 0; start < bulkRows.length; start += 50) {
    const batch = bulkRows.slice(start, start + 50);
    const result = await db.insert(notifications).values(batch).onConflictDoNothing().returning();
    bulkInserted += result.length;
  }

  console.log(`✓ Seeded bulk notifications (${bulkInserted} inserted, ${bulkRows.length - bulkInserted} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedNotifications()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedNotifications failed:', err); process.exit(1); });
}
