import { like } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { aiRecommendationLogs } from '../../modules/ai/ai.schema';

// ---------------------------------------------------------------------------
// Static data pools
// ---------------------------------------------------------------------------
const SYMPTOMS_POOL = [
  'I have been experiencing chest pain and shortness of breath for the past few days.',
  'Persistent headaches and dizziness for over a week, especially in the mornings.',
  'My skin has developed a rash that spreads across my arms and seems to be worsening.',
  'I feel constant fatigue and have difficulty staying awake during the day.',
  'Sharp joint pain in both knees, especially after physical activity.',
  'Recurring stomach pain and bloating after meals, sometimes with nausea.',
  'I have had a cough and low-grade fever for the past five days.',
  'Blurry vision in my right eye and occasional flashes of light.',
  'Frequent urination and excessive thirst, especially at night.',
  'Lower back pain radiating down my left leg when standing for long periods.',
] as const;

const SPEC_POOL = [
  'Cardiology', 'Neurology', 'Dermatology', 'General Practice', 'Orthopedics',
  'Gastroenterology', 'Pulmonology', 'Ophthalmology', 'Endocrinology', 'Nephrology',
] as const;

const REASON_MAP: Record<string, string> = {
  'Cardiology':        'Chest pain symptoms suggest possible cardiac involvement.',
  'Neurology':         'Headache and dizziness may indicate a neurological issue.',
  'Dermatology':       'Skin rash requires dermatological evaluation.',
  'General Practice':  'Fatigue and general symptoms warrant a GP consultation.',
  'Orthopedics':       'Joint pain is consistent with musculoskeletal conditions.',
  'Gastroenterology':  'Digestive symptoms suggest gastrointestinal evaluation.',
  'Pulmonology':       'Cough and fever may indicate a respiratory condition.',
  'Ophthalmology':     'Vision changes require ophthalmological assessment.',
  'Endocrinology':     'Frequent urination and thirst may indicate metabolic disorder.',
  'Nephrology':        'Urinary symptoms and fatigue may indicate kidney involvement.',
};

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------
export async function seedAiLogs(): Promise<void> {
  // Fetch all patient users
  const patientUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, 'patient%@demo.com'));

  if (patientUsers.length === 0) {
    console.log('✓ Seeded AI recommendation logs (0 inserted, 0 skipped)');
    return;
  }

  const rows: {
    id: string;
    userId: string;
    symptoms: string;
    recommendations: unknown;
    createdAt: Date;
  }[] = [];

  // 5 log entries per patient
  patientUsers.forEach((patient, i) => {
    for (let j = 0; j < 5; j++) {
      const logIndex  = i * 5 + j;
      const sympIndex = (logIndex) % SYMPTOMS_POOL.length;
      const specIndex = (logIndex + j * 3) % SPEC_POOL.length;
      const spec      = SPEC_POOL[specIndex]!;
      const logId     = `ca${String(logIndex + 1).padStart(6, '0')}-0000-0000-0000-000000000000`;

      // Stagger createdAt: ~12 hours apart over ~50 days
      const createdAt = new Date(Date.now() - logIndex * 12 * 60 * 60 * 1000);

      rows.push({
        id:              logId,
        userId:          patient.id,
        symptoms:        SYMPTOMS_POOL[sympIndex]!,
        recommendations: JSON.stringify([
          {
            specialization: spec,
            reason:         REASON_MAP[spec] ?? 'Symptoms match this specialization.',
            doctors:        [],
          },
        ]),
        createdAt,
      });
    }
  });

  let inserted = 0;
  for (let start = 0; start < rows.length; start += 50) {
    const batch = rows.slice(start, start + 50);
    const result = await db
      .insert(aiRecommendationLogs)
      .values(batch)
      .onConflictDoNothing()
      .returning();
    inserted += result.length;
  }

  console.log(`✓ Seeded AI recommendation logs (${inserted} inserted, ${rows.length - inserted} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedAiLogs()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedAiLogs failed:', err); process.exit(1); });
}
