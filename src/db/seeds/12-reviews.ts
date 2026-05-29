import { eq } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { db } from '../../config/db';
import { appointments } from '../../modules/appointments/appointments.schema';
import { reviews } from '../../modules/doctors/doctors.schema';

// ---------------------------------------------------------------------------
// Comment pools by rating band
// ---------------------------------------------------------------------------
const COMMENTS_POSITIVE = [
  'Excellent doctor! Very thorough and caring. Highly recommend.',
  'Dr. was very attentive and explained everything clearly. Great experience.',
  'Very professional and knowledgeable. I felt at ease during the consultation.',
  'Outstanding care. The doctor took time to listen and address all my concerns.',
  'Wonderful experience. Would definitely book again.',
  'Very impressed with the level of care. The diagnosis was spot-on.',
  'Kind and patient doctor. Made me feel comfortable throughout.',
  'Highly professional. Answered all my questions without rushing.',
] as const;

const COMMENTS_NEUTRAL = [
  'Good consultation overall. Doctor was helpful.',
  'Decent experience. The doctor addressed my main concerns.',
  'Average consultation. Nothing exceptional but got the help I needed.',
  'Satisfactory visit. Doctor was professional.',
] as const;

const COMMENTS_NEGATIVE = [
  'Consultation felt rushed. Would have liked more time to discuss my concerns.',
  'Doctor was a bit dismissive. Expected more thorough examination.',
  'Long wait time and the consultation was shorter than expected.',
  'Needs improvement in communication. Hard to understand the diagnosis.',
] as const;

function pickComment(rating: number, seed: number): string {
  faker.seed(seed);
  if (rating >= 4) return COMMENTS_POSITIVE[faker.number.int({ min: 0, max: COMMENTS_POSITIVE.length - 1 })]!;
  if (rating === 3) return COMMENTS_NEUTRAL[faker.number.int({ min: 0, max: COMMENTS_NEUTRAL.length - 1 })]!;
  return COMMENTS_NEGATIVE[faker.number.int({ min: 0, max: COMMENTS_NEGATIVE.length - 1 })]!;
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------
export async function seedReviews(): Promise<void> {
  // Fetch all completed appointments
  const completedAppts = await db
    .select({
      id:        appointments.id,
      patientId: appointments.patientId,
      doctorId:  appointments.doctorId,
    })
    .from(appointments)
    .where(eq(appointments.status, 'completed'));

  if (completedAppts.length === 0) {
    console.log('✓ Seeded reviews (0 inserted, 0 skipped)');
    return;
  }

  const rows = completedAppts.map((appt, i) => {
    faker.seed(i + 30000);
    const rating = faker.number.int({ min: 1, max: 5 });
    return {
      appointmentId: appt.id,
      patientId:     appt.patientId,
      doctorId:      appt.doctorId,
      rating,
      comment:       pickComment(rating, i + 30000),
    };
  });

  let inserted = 0;
  for (let start = 0; start < rows.length; start += 50) {
    const batch = rows.slice(start, start + 50);
    const result = await db.insert(reviews).values(batch).onConflictDoNothing().returning();
    inserted += result.length;
  }

  console.log(`✓ Seeded reviews (${inserted} inserted, ${rows.length - inserted} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedReviews()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedReviews failed:', err); process.exit(1); });
}
