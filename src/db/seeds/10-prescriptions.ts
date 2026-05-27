import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { appointments } from '../../modules/appointments/appointments.schema';
import { prescriptions } from '../../modules/prescriptions/prescriptions.schema';
import { DEMO_APPOINTMENT_IDS } from './08-appointments';

const DEMO_PRESCRIPTIONS = [
  {
    id:             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    medicationName: 'Metoprolol Succinate',
    dosage:         '25mg',
    frequency:      'Once daily',
    duration:       '30 days',
    instructions:   'Take with or without food. Do not stop abruptly.',
  },
  {
    id:             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    medicationName: 'Omega-3 Fish Oil',
    dosage:         '1000mg',
    frequency:      'Twice daily',
    duration:       '30 days',
    instructions:   'Take with meals to reduce GI side effects.',
  },
] as const;

export async function seedPrescriptions(): Promise<void> {
  // Resolve doctor_id and patient_id from the completed appointment row
  const [appt] = await db
    .select({ doctorId: appointments.doctorId, patientId: appointments.patientId })
    .from(appointments)
    .where(eq(appointments.id, DEMO_APPOINTMENT_IDS.completed));

  if (!appt) {
    console.warn('  ⚠ Completed appointment not found — skipping prescriptions');
    console.log('✓ Seeded prescriptions (0 inserted, 2 skipped)');
    return;
  }

  const rows = DEMO_PRESCRIPTIONS.map((rx) => ({
    id:             rx.id,
    appointmentId:  DEMO_APPOINTMENT_IDS.completed,
    doctorId:       appt.doctorId,
    patientId:      appt.patientId,
    medicationName: rx.medicationName,
    dosage:         rx.dosage,
    frequency:      rx.frequency,
    duration:       rx.duration,
    instructions:   rx.instructions,
  }));

  const inserted = await db
    .insert(prescriptions)
    .values(rows)
    .onConflictDoNothing()
    .returning();

  const insertedCount = inserted.length;
  const skippedCount  = rows.length - insertedCount;
  console.log(`✓ Seeded prescriptions (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedPrescriptions()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedPrescriptions failed:', err); process.exit(1); });
}
