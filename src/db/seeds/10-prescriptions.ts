import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { appointments } from '../../modules/appointments/appointments.schema';
import { prescriptions } from '../../modules/prescriptions/prescriptions.schema';
import { DEMO_APPOINTMENT_IDS } from './08-appointments';

function rxId(n: number): string {
  return `c0${String(n).padStart(6, '0')}-0000-0000-0000-000000000000`;
}

const MEDICATIONS_POOL = [
  { medicationName: 'Metformin',          dosage: '500mg',            frequency: 'Twice daily',                  duration: '90 days', instructions: 'Take with meals to reduce gastrointestinal side effects.' },
  { medicationName: 'Amlodipine',         dosage: '5mg',              frequency: 'Once daily',                   duration: '30 days', instructions: 'Take at the same time each day. May cause ankle swelling.' },
  { medicationName: 'Atorvastatin',       dosage: '20mg',             frequency: 'Once daily at bedtime',        duration: '60 days', instructions: 'Avoid grapefruit juice. Report any muscle pain immediately.' },
  { medicationName: 'Omeprazole',         dosage: '20mg',             frequency: 'Once daily before breakfast',  duration: '14 days', instructions: 'Take 30 minutes before eating. Do not crush or chew capsule.' },
  { medicationName: 'Cetirizine',         dosage: '10mg',             frequency: 'Once daily',                   duration: '30 days', instructions: 'May cause drowsiness. Avoid alcohol and driving if affected.' },
  { medicationName: 'Ibuprofen',          dosage: '400mg',            frequency: 'Three times daily',            duration: '7 days',  instructions: 'Take with food or milk. Do not exceed 1200mg per day.' },
  { medicationName: 'Amoxicillin',        dosage: '500mg',            frequency: 'Three times daily',            duration: '7 days',  instructions: 'Complete the full course even if symptoms improve.' },
  { medicationName: 'Levothyroxine',      dosage: '50mcg',            frequency: 'Once daily on empty stomach',  duration: '90 days', instructions: 'Take 30-60 minutes before breakfast. Avoid calcium within 4 hours.' },
  { medicationName: 'Salbutamol Inhaler', dosage: '100mcg per puff',  frequency: 'As needed',                   duration: '30 days', instructions: 'Use as a rescue inhaler. Shake well before each use.' },
  { medicationName: 'Sertraline',         dosage: '50mg',             frequency: 'Once daily',                   duration: '60 days', instructions: 'May take 2-4 weeks for full effect. Do not stop abruptly.' },
] as const;

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

  const demoInsertedCount = inserted.length;
  const demoSkippedCount  = rows.length - demoInsertedCount;

  // ── Bulk prescriptions: 1 per completed non-demo appointment ─────────────
  const DEMO_IDS = Object.values(DEMO_APPOINTMENT_IDS);

  const completedAppts = await db
    .select({ id: appointments.id, doctorId: appointments.doctorId, patientId: appointments.patientId })
    .from(appointments)
    .where(and(eq(appointments.status, 'completed'), notInArray(appointments.id, DEMO_IDS)));

  const bulkRxRows = completedAppts.map((appt, i) => {
    const med = MEDICATIONS_POOL[i % MEDICATIONS_POOL.length]!;
    return {
      id:             rxId(i + 1),
      appointmentId:  appt.id,
      doctorId:       appt.doctorId,
      patientId:      appt.patientId,
      medicationName: med.medicationName,
      dosage:         med.dosage,
      frequency:      med.frequency,
      duration:       med.duration,
      instructions:   med.instructions,
    };
  });

  let bulkInserted = 0;
  for (let start = 0; start < bulkRxRows.length; start += 50) {
    const batch = bulkRxRows.slice(start, start + 50);
    const batchResult = await db.insert(prescriptions).values(batch).onConflictDoNothing().returning();
    bulkInserted += batchResult.length;
  }

  const totalInserted = demoInsertedCount + bulkInserted;
  const totalSkipped  = demoSkippedCount + (bulkRxRows.length - bulkInserted);
  console.log(`✓ Seeded prescriptions (${totalInserted} inserted, ${totalSkipped} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedPrescriptions()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedPrescriptions failed:', err); process.exit(1); });
}
