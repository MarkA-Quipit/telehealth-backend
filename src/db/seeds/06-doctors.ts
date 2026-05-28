import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { doctorProfiles, doctorAvailability } from '../../modules/doctors/doctors.schema';
import { DEMO_EMAILS } from './04-users';

// ---------------------------------------------------------------------------
// Doctor seed data
// ---------------------------------------------------------------------------
const DOCTORS = [
  {
    email:               DEMO_EMAILS.doctor1,
    firstName:           'Maria',
    lastName:            'Santos',
    specialization:      'Cardiology',
    bio:                 'Board-certified cardiologist with 10 years of experience in cardiovascular medicine.',
    yearsOfExperience:   10,
    consultationFee:     500,
    isAcceptingPatients: true,
    licenseNumber:       'PRC-12345',
    availability: [
      { dayOfWeek: 'monday'    as const, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'tuesday'   as const, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'wednesday' as const, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'thursday'  as const, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'friday'    as const, startTime: '09:00', endTime: '17:00' },
    ],
  },
  {
    email:               DEMO_EMAILS.doctor2,
    firstName:           'Jose',
    lastName:            'Reyes',
    specialization:      'General Practice',
    bio:                 'Family medicine physician focused on preventive care and chronic disease management.',
    yearsOfExperience:   7,
    consultationFee:     300,
    isAcceptingPatients: true,
    licenseNumber:       'PRC-67890',
    availability: [
      { dayOfWeek: 'monday'    as const, startTime: '08:00', endTime: '16:00' },
      { dayOfWeek: 'wednesday' as const, startTime: '08:00', endTime: '16:00' },
      { dayOfWeek: 'friday'    as const, startTime: '08:00', endTime: '16:00' },
    ],
  },
  {
    email:               DEMO_EMAILS.doctor3,
    firstName:           'John',
    lastName:            'Gonzales',
    specialization:      'Dermatology',
    bio:                 'Dermatologist specializing in skin disorders, acne treatment, and cosmetic dermatology with 8 years of clinical practice.',
    yearsOfExperience:   8,
    consultationFee:     450,
    isAcceptingPatients: true,
    licenseNumber:       'PRC-24680',
    availability: [
      { dayOfWeek: 'tuesday'   as const, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 'thursday'  as const, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 'saturday'  as const, startTime: '09:00', endTime: '13:00' },
    ],
  },
  {
    email:               DEMO_EMAILS.doctor4,
    firstName:           'Carlos',
    lastName:            'Lopez',
    specialization:      'Orthopedics',
    bio:                 'Orthopedic surgeon with expertise in sports injuries, joint replacement, and musculoskeletal rehabilitation.',
    yearsOfExperience:   12,
    consultationFee:     600,
    isAcceptingPatients: false,
    licenseNumber:       'PRC-13579',
    availability: [
      { dayOfWeek: 'monday'    as const, startTime: '07:00', endTime: '15:00' },
      { dayOfWeek: 'tuesday'   as const, startTime: '07:00', endTime: '15:00' },
      { dayOfWeek: 'thursday'  as const, startTime: '07:00', endTime: '15:00' },
    ],
  },
  {
    email:               DEMO_EMAILS.doctor5,
    firstName:           'Alex',
    lastName:            'Smith',
    specialization:      'Neurology',
    bio:                 'Neurologist focused on the diagnosis and treatment of headaches, epilepsy, and progressive neurological conditions.',
    yearsOfExperience:   9,
    consultationFee:     550,
    isAcceptingPatients: true,
    licenseNumber:       'PRC-97531',
    availability: [
      { dayOfWeek: 'monday'    as const, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'wednesday' as const, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'friday'    as const, startTime: '09:00', endTime: '17:00' },
    ],
  },
] as const;

export async function seedDoctors(): Promise<void> {
  let profilesInserted = 0;
  let profilesSkipped  = 0;
  let availInserted    = 0;
  let availSkipped     = 0;

  for (const doctor of DOCTORS) {
    // Resolve user
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, doctor.email));
    if (!user) {
      console.warn(`  ⚠ user '${doctor.email}' not found — skipping doctor profile`);
      profilesSkipped++;
      continue;
    }

    // Insert doctor profile (ON CONFLICT on unique user_id)
    const profileResult = await db
      .insert(doctorProfiles)
      .values({
        userId:              user.id,
        firstName:           doctor.firstName,
        lastName:            doctor.lastName,
        specialization:      doctor.specialization,
        bio:                 doctor.bio,
        yearsOfExperience:   doctor.yearsOfExperience,
        consultationFee:     doctor.consultationFee,
        isAcceptingPatients: doctor.isAcceptingPatients,
        licenseNumber:       doctor.licenseNumber,
      })
      .onConflictDoNothing()
      .returning({ id: doctorProfiles.id });

    if (profileResult.length > 0) {
      profilesInserted++;
    } else {
      profilesSkipped++;
    }

    // Get doctor profile id (either just inserted or pre-existing)
    const [profile] = await db
      .select({ id: doctorProfiles.id })
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, user.id));

    if (!profile) continue;

    // Check if availability already exists for this doctor
    const existingAvail = await db
      .select({ id: doctorAvailability.id })
      .from(doctorAvailability)
      .where(eq(doctorAvailability.doctorId, profile.id));

    if (existingAvail.length > 0) {
      availSkipped += doctor.availability.length;
      continue;
    }

    // Insert availability slots
    const availResult = await db
      .insert(doctorAvailability)
      .values(
        doctor.availability.map((slot) => ({
          doctorId:  profile.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime:   slot.endTime,
          isActive:  true,
        })),
      )
      .onConflictDoNothing()
      .returning();

    availInserted += availResult.length;
    availSkipped  += doctor.availability.length - availResult.length;
  }

  console.log(`✓ Seeded doctor profiles (${profilesInserted} inserted, ${profilesSkipped} skipped)`);
  console.log(`✓ Seeded doctor availability (${availInserted} inserted, ${availSkipped} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedDoctors()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedDoctors failed:', err); process.exit(1); });
}
