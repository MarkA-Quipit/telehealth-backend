import { eq, like } from 'drizzle-orm';
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

// Bulk appointment UUID pattern: ba{6-digit-index}-0000-0000-0000-000000000000
function bulkApptId(k: number): string {
  return `ba${String(k).padStart(6, '0')}-0000-0000-0000-000000000000`;
}

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

const PATIENT_NOTES = [
  'Experiencing persistent headaches for the past week',
  'Routine checkup and blood pressure review',
  'Chest pain and shortness of breath',
  'Skin rash that has been worsening',
  'Joint pain in knees and lower back',
  'Feeling fatigued and difficulty sleeping',
  'Cough and fever for 3 days',
  'Follow-up on previous test results',
  'Abdominal pain and digestive issues',
  'Dizziness and loss of appetite',
] as const;

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
const DURATION = 30;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
export async function seedAppointments(): Promise<void> {
  // ── Demo appointments (4 fixed, unchanged) ───────────────────────────────
  const [patientUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAILS.patient1));
  const [doctor1User] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAILS.doctor1));
  const [doctor2User] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAILS.doctor2));

  if (!patientUser || !doctor1User || !doctor2User) {
    console.warn('  ⚠ One or more required users not found — skipping demo appointments');
  } else {
    const [patientProfile] = await db.select({ id: patientProfiles.id }).from(patientProfiles).where(eq(patientProfiles.userId, patientUser.id));
    const [doctor1Profile] = await db.select({ id: doctorProfiles.id }).from(doctorProfiles).where(eq(doctorProfiles.userId, doctor1User.id));
    const [doctor2Profile] = await db.select({ id: doctorProfiles.id }).from(doctorProfiles).where(eq(doctorProfiles.userId, doctor2User.id));

    if (!patientProfile || !doctor1Profile || !doctor2Profile) {
      console.warn('  ⚠ One or more required profiles not found — skipping demo appointments');
    } else {
      const tomorrow  = daysOffset(1);
      const confirmed = addMinutes(new Date(), 120);
      const completed = daysOffset(-3);
      const cancelled = daysOffset(-5);

      const demoRows = [
        {
          id: DEMO_APPOINTMENT_IDS.pending,   patientId: patientProfile.id, doctorId: doctor1Profile.id,
          scheduledAt: tomorrow,              endsAt: addMinutes(tomorrow, DURATION),
          status: 'pending'    as const,      jitsiRoomName: DEMO_APPOINTMENT_IDS.pending,
          patientNote: 'Routine cardiac checkup and blood pressure review',
        },
        {
          id: DEMO_APPOINTMENT_IDS.confirmed, patientId: patientProfile.id, doctorId: doctor2Profile.id,
          scheduledAt: confirmed,             endsAt: addMinutes(confirmed, DURATION),
          status: 'confirmed'  as const,      jitsiRoomName: DEMO_APPOINTMENT_IDS.confirmed,
          patientNote: 'Feeling fatigued and having trouble sleeping',
        },
        {
          id: DEMO_APPOINTMENT_IDS.completed, patientId: patientProfile.id, doctorId: doctor1Profile.id,
          scheduledAt: completed,             endsAt: addMinutes(completed, DURATION),
          status: 'completed'  as const,      jitsiRoomName: DEMO_APPOINTMENT_IDS.completed,
          patientNote: 'Follow-up after ECG results',
        },
        {
          id: DEMO_APPOINTMENT_IDS.cancelled, patientId: patientProfile.id, doctorId: doctor2Profile.id,
          scheduledAt: cancelled,             endsAt: addMinutes(cancelled, DURATION),
          status: 'cancelled'  as const,      jitsiRoomName: DEMO_APPOINTMENT_IDS.cancelled,
          patientNote: 'Headache and dizziness',
          cancellationReason: 'Patient requested reschedule',
          cancelledBy: patientUser.id,        cancelledAt: cancelled,
        },
      ];

      const demoInserted = await db.insert(appointments).values(demoRows).onConflictDoNothing().returning();
      console.log(`✓ Seeded demo appointments (${demoInserted.length} inserted, ${demoRows.length - demoInserted.length} skipped)`);
    }
  }

  // ── Bulk appointments (2 per patient × 100 patients = 200) ───────────────
  // Fetch all patient and doctor profiles ordered by email
  const allPatients = await db
    .select({ id: patientProfiles.id, userId: patientProfiles.userId })
    .from(patientProfiles)
    .innerJoin(users, eq(patientProfiles.userId, users.id))
    .where(like(users.email, 'patient%@demo.com'))
    .orderBy(users.email);

  const allDoctors = await db
    .select({ id: doctorProfiles.id })
    .from(doctorProfiles)
    .innerJoin(users, eq(doctorProfiles.userId, users.id))
    .where(like(users.email, 'doctor%@demo.com'))
    .orderBy(users.email);

  if (allPatients.length === 0 || allDoctors.length === 0) {
    console.warn('  ⚠ No patient/doctor profiles found — skipping bulk appointments');
    return;
  }

  const bulkRows: Parameters<typeof db.insert>[0] extends unknown ? never[] : never[] = [];
  const bulkRowsTyped: {
    id: string; patientId: string; doctorId: string;
    scheduledAt: Date; endsAt: Date; status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    jitsiRoomName: string; patientNote: string;
    cancellationReason?: string; cancelledBy?: string; cancelledAt?: Date;
  }[] = [];

  let k = 0; // global appointment index for UUID + status cycling
  for (let i = 0; i < allPatients.length; i++) {
    const patient = allPatients[i]!;

    // Two appointments per patient with different doctors
    const doctorIndexA = i % allDoctors.length;
    const doctorIndexB = (i + 37) % allDoctors.length;

    for (const doctorIndex of [doctorIndexA, doctorIndexB]) {
      const doctor = allDoctors[doctorIndex]!;
      const status = STATUSES[k % 4]!;
      const apptId = bulkApptId(k + 1);
      const noteText = PATIENT_NOTES[k % PATIENT_NOTES.length]!;

      // Deterministic schedule based on k
      let scheduledAt: Date;
      if (status === 'pending') {
        scheduledAt = daysOffset((k % 28) + 1);
      } else if (status === 'confirmed') {
        scheduledAt = daysOffset((k % 14) + 1);
      } else if (status === 'completed') {
        scheduledAt = daysOffset(-((k % 88) + 2));
      } else {
        scheduledAt = daysOffset(-((k % 58) + 2));
      }

      const row: (typeof bulkRowsTyped)[0] = {
        id:            apptId,
        patientId:     patient.id,
        doctorId:      doctor.id,
        scheduledAt,
        endsAt:        addMinutes(scheduledAt, DURATION),
        status,
        jitsiRoomName: apptId,
        patientNote:   noteText,
      };

      if (status === 'cancelled') {
        row.cancellationReason = 'Patient requested cancellation';
        row.cancelledBy        = patient.userId;
        row.cancelledAt        = scheduledAt;
      }

      bulkRowsTyped.push(row);
      k++;
    }
  }

  if (bulkRowsTyped.length === 0) {
    console.log('✓ Seeded bulk appointments (0 inserted, 0 skipped)');
    return;
  }

  // Insert in batches of 50 to avoid parameter limits
  let bulkInserted = 0;
  for (let start = 0; start < bulkRowsTyped.length; start += 50) {
    const batch = bulkRowsTyped.slice(start, start + 50);
    const result = await db.insert(appointments).values(batch).onConflictDoNothing().returning();
    bulkInserted += result.length;
  }

  console.log(`✓ Seeded bulk appointments (${bulkInserted} inserted, ${bulkRowsTyped.length - bulkInserted} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedAppointments()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedAppointments failed:', err); process.exit(1); });
}
