import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { appointments } from '../../modules/appointments/appointments.schema';
import { consultationNotes } from '../../modules/consultations/consultations.schema';
import { DEMO_APPOINTMENT_IDS } from './08-appointments';

export async function seedNotes(): Promise<void> {
  // Resolve doctor_id and patient_id from the completed appointment row
  const [appt] = await db
    .select({ doctorId: appointments.doctorId, patientId: appointments.patientId })
    .from(appointments)
    .where(eq(appointments.id, DEMO_APPOINTMENT_IDS.completed));

  if (!appt) {
    console.warn('  ⚠ Completed appointment not found — skipping notes');
    console.log('✓ Seeded consultation notes (0 inserted, 1 skipped)');
    return;
  }

  // follow_up_date: 30 days from today
  const followUp = new Date();
  followUp.setDate(followUp.getDate() + 30);
  const followUpDate = followUp.toISOString().split('T')[0]!;

  const result = await db
    .insert(consultationNotes)
    .values({
      appointmentId: DEMO_APPOINTMENT_IDS.completed,
      doctorId:      appt.doctorId,
      patientId:     appt.patientId,
      chiefComplaint: 'Follow-up on ECG results showing mild arrhythmia',
      diagnosis:      'Mild sinus arrhythmia, clinically insignificant',
      notes:          'Patient reports no chest pain or palpitations since last visit. ECG results reviewed — no intervention required at this time. Continue current medications.',
      followUpDate,
    })
    .onConflictDoNothing()
    .returning();

  const insertedCount = result.length;
  const skippedCount  = 1 - insertedCount;
  console.log(`✓ Seeded consultation notes (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedNotes()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedNotes failed:', err); process.exit(1); });
}
