import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '../../config/db';
import { appointments } from '../../modules/appointments/appointments.schema';
import { consultationNotes } from '../../modules/consultations/consultations.schema';
import { DEMO_APPOINTMENT_IDS } from './08-appointments';

const CHIEF_COMPLAINTS_POOL = [
  'Persistent headaches and dizziness for the past two weeks',
  'Chest tightness and occasional shortness of breath',
  'Lower back pain radiating down the left leg',
  'Recurring abdominal pain after meals',
  'Skin rash spreading across the forearms',
  'Fatigue and difficulty concentrating at work',
  'Swollen joints in both hands in the mornings',
  'Frequent urination and excessive thirst',
  'Cough persisting for more than three weeks',
  'Blurred vision and eye strain when reading',
] as const;

const DIAGNOSIS_POOL = [
  'Tension-type headache, likely stress-related',
  'Mild sinus arrhythmia, clinically insignificant',
  'Lumbar disc herniation at L4-L5, conservative management',
  'Gastroesophageal reflux disease (GERD)',
  'Contact dermatitis, likely allergic origin',
  'Burnout syndrome with mild depressive features',
  'Early-stage rheumatoid arthritis, referral recommended',
  'Type 2 diabetes mellitus, newly diagnosed',
  'Chronic bronchitis, non-smoking etiology',
  'Refractive error, prescription update required',
] as const;

const CLINICAL_NOTES_POOL = [
  'Patient reports improvement since last visit. Medication regime maintained. Lifestyle modification advised.',
  'ECG results reviewed and discussed. No acute changes noted. Follow-up in 4 weeks.',
  'Physical examination performed. Range of motion slightly restricted. Physiotherapy referral provided.',
  'Dietary review completed. Low-acid diet and meal timing adjustments recommended.',
  'Patch test results reviewed. Avoidance of identified allergen advised. Topical steroid prescribed.',
  'Sleep hygiene discussed. CBT referral initiated. Reduced workload recommended.',
  'Blood markers elevated. Rheumatology referral letter issued. NSAID therapy commenced.',
  'HbA1c and fasting glucose reviewed. Metformin initiated at low dose. Dietary plan shared.',
  'Spirometry performed. Results consistent with obstructive pattern. Inhaler technique reviewed.',
  'Visual acuity assessment completed. New prescription issued. Follow-up in 12 months.',
] as const;

// null = no follow-up scheduled
const FOLLOWUP_OFFSETS: Array<number | null> = [14, 30, null, 21, 60, 14, null, 30, 45, null];

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

  const demoInsertedCount = result.length;
  const demoSkippedCount  = 1 - demoInsertedCount;

  // ── Bulk notes: 1 note per completed non-demo appointment ─────────────────
  const DEMO_IDS = Object.values(DEMO_APPOINTMENT_IDS);

  const completedAppts = await db
    .select({ id: appointments.id, doctorId: appointments.doctorId, patientId: appointments.patientId })
    .from(appointments)
    .where(and(eq(appointments.status, 'completed'), notInArray(appointments.id, DEMO_IDS)));

  const bulkNoteRows = completedAppts.map((appt, i) => {
    const offsetDays = FOLLOWUP_OFFSETS[i % FOLLOWUP_OFFSETS.length];
    let followUpDate: string | null = null;
    if (offsetDays !== null) {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      followUpDate = d.toISOString().split('T')[0]!;
    }
    return {
      appointmentId:  appt.id,
      doctorId:       appt.doctorId,
      patientId:      appt.patientId,
      chiefComplaint: CHIEF_COMPLAINTS_POOL[i % CHIEF_COMPLAINTS_POOL.length]!,
      diagnosis:      DIAGNOSIS_POOL[i % DIAGNOSIS_POOL.length]!,
      notes:          CLINICAL_NOTES_POOL[i % CLINICAL_NOTES_POOL.length]!,
      followUpDate,
    };
  });

  let bulkInserted = 0;
  for (let start = 0; start < bulkNoteRows.length; start += 50) {
    const batch = bulkNoteRows.slice(start, start + 50);
    const batchResult = await db.insert(consultationNotes).values(batch).onConflictDoNothing().returning();
    bulkInserted += batchResult.length;
  }

  const totalInserted = demoInsertedCount + bulkInserted;
  const totalSkipped  = demoSkippedCount + (bulkNoteRows.length - bulkInserted);
  console.log(`✓ Seeded consultation notes (${totalInserted} inserted, ${totalSkipped} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedNotes()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedNotes failed:', err); process.exit(1); });
}
