import { eq, like } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { doctorProfiles, doctorAvailability } from '../../modules/doctors/doctors.schema';

// ---------------------------------------------------------------------------
// Specialization pool — 20 specs, ~5 doctors each for 100 total
// ---------------------------------------------------------------------------
const SPECIALIZATIONS = [
  'Cardiology', 'General Practice', 'Dermatology', 'Orthopedics', 'Neurology',
  'Pediatrics', 'Gynecology', 'Psychiatry', 'Ophthalmology', 'ENT',
  'Endocrinology', 'Gastroenterology', 'Pulmonology', 'Nephrology', 'Urology',
  'Rheumatology', 'Oncology', 'Hematology', 'Surgery (General)', 'Infectious Disease',
] as const;

const BIO_TEMPLATES: Record<string, string> = {
  'Cardiology':          'Board-certified cardiologist with extensive experience in cardiovascular medicine.',
  'General Practice':    'Family medicine physician focused on preventive care and chronic disease management.',
  'Dermatology':         'Dermatologist specializing in skin disorders, acne treatment, and cosmetic dermatology.',
  'Orthopedics':         'Orthopedic surgeon with expertise in sports injuries, joint replacement, and rehabilitation.',
  'Neurology':           'Neurologist focused on the diagnosis and treatment of headaches, epilepsy, and neurological conditions.',
  'Pediatrics':          'Pediatrician dedicated to the health and well-being of infants, children, and adolescents.',
  'Gynecology':          'OB-GYN providing comprehensive women\'s health care including prenatal and reproductive services.',
  'Psychiatry':          'Psychiatrist specializing in mental health disorders including depression, anxiety, and mood disorders.',
  'Ophthalmology':       'Ophthalmologist with expertise in eye diseases, vision correction, and surgical procedures.',
  'ENT':                 'Otolaryngologist treating disorders of the ear, nose, throat, and related head and neck structures.',
  'Endocrinology':       'Endocrinologist managing diabetes, thyroid disorders, and hormonal imbalances.',
  'Gastroenterology':    'Gastroenterologist specializing in digestive system disorders and gastrointestinal diseases.',
  'Pulmonology':         'Pulmonologist treating respiratory conditions including asthma, COPD, and sleep apnea.',
  'Nephrology':          'Nephrologist managing kidney diseases, hypertension, and electrolyte imbalances.',
  'Urology':             'Urologist treating urinary tract conditions and male reproductive health issues.',
  'Rheumatology':        'Rheumatologist specializing in autoimmune diseases, arthritis, and musculoskeletal conditions.',
  'Oncology':            'Oncologist providing comprehensive cancer care, diagnosis, and treatment planning.',
  'Hematology':          'Hematologist managing blood disorders, anemia, and coagulation conditions.',
  'Surgery (General)':   'General surgeon with expertise in abdominal, laparoscopic, and emergency surgical procedures.',
  'Infectious Disease':  'Infectious disease specialist managing complex infections, tropical diseases, and antimicrobial therapy.',
};

// Weekly availability templates — [days], startTime, endTime
const AVAIL_TEMPLATES: Array<{ days: string[]; start: string; end: string }> = [
  { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], start: '09:00', end: '17:00' },
  { days: ['monday', 'wednesday', 'friday'],                         start: '08:00', end: '16:00' },
  { days: ['tuesday', 'thursday'],                                   start: '10:00', end: '18:00' },
  { days: ['monday', 'tuesday', 'thursday', 'friday'],               start: '07:00', end: '15:00' },
  { days: ['tuesday', 'wednesday', 'thursday'],                      start: '09:00', end: '17:00' },
  { days: ['monday', 'wednesday', 'thursday', 'friday'],             start: '08:00', end: '16:00' },
  { days: ['tuesday', 'thursday', 'saturday'],                       start: '10:00', end: '18:00' },
] as const;

// ---------------------------------------------------------------------------
// Hardcoded data for doctors 1–5 (preserves existing profiles)
// ---------------------------------------------------------------------------
interface HardcodedDoctor {
  n: number;
  firstName: string; lastName: string; specialization: string; bio: string;
  yearsOfExperience: number; consultationFee: number; isAcceptingPatients: boolean;
  licenseNumber: string;
  availTemplate: number; // index into AVAIL_TEMPLATES
}

const HARDCODED: HardcodedDoctor[] = [
  { n: 1, firstName: 'Maria',  lastName: 'Santos',   specialization: 'Cardiology',       bio: 'Board-certified cardiologist with 10 years of experience in cardiovascular medicine.',                                                    yearsOfExperience: 10, consultationFee: 500, isAcceptingPatients: true,  licenseNumber: 'PRC-12345', availTemplate: 0 },
  { n: 2, firstName: 'Jose',   lastName: 'Reyes',    specialization: 'General Practice', bio: 'Family medicine physician focused on preventive care and chronic disease management.',                                                     yearsOfExperience: 7,  consultationFee: 300, isAcceptingPatients: true,  licenseNumber: 'PRC-67890', availTemplate: 1 },
  { n: 3, firstName: 'John',   lastName: 'Gonzales', specialization: 'Dermatology',      bio: 'Dermatologist specializing in skin disorders, acne treatment, and cosmetic dermatology with 8 years of clinical practice.',               yearsOfExperience: 8,  consultationFee: 450, isAcceptingPatients: true,  licenseNumber: 'PRC-24680', availTemplate: 2 },
  { n: 4, firstName: 'Carlos', lastName: 'Lopez',    specialization: 'Orthopedics',      bio: 'Orthopedic surgeon with expertise in sports injuries, joint replacement, and musculoskeletal rehabilitation.',                            yearsOfExperience: 12, consultationFee: 600, isAcceptingPatients: false, licenseNumber: 'PRC-13579', availTemplate: 3 },
  { n: 5, firstName: 'Alex',   lastName: 'Smith',    specialization: 'Neurology',        bio: 'Neurologist focused on the diagnosis and treatment of headaches, epilepsy, and progressive neurological conditions.',                     yearsOfExperience: 9,  consultationFee: 550, isAcceptingPatients: true,  licenseNumber: 'PRC-97531', availTemplate: 4 },
];

// ---------------------------------------------------------------------------
// Generator for bulk doctors 6–100
// ---------------------------------------------------------------------------
function generateDoctor(n: number): Omit<HardcodedDoctor, 'n'> {
  faker.seed(n * 100);
  const specIndex = (n - 1) % SPECIALIZATIONS.length;
  const specialization = SPECIALIZATIONS[specIndex]!;
  return {
    firstName:           faker.person.firstName(),
    lastName:            faker.person.lastName(),
    specialization,
    bio:                 BIO_TEMPLATES[specialization] ?? 'Experienced physician dedicated to patient care.',
    yearsOfExperience:   faker.number.int({ min: 2, max: 25 }),
    consultationFee:     faker.number.int({ min: 2, max: 10 }) * 100,
    isAcceptingPatients: n % 10 !== 0, // 90% accepting
    licenseNumber:       `PRC-${String(100000 + n).slice(1)}`,
    availTemplate:       n % AVAIL_TEMPLATES.length,
  };
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------
export async function seedDoctors(): Promise<void> {
  let profilesInserted = 0;
  let profilesSkipped  = 0;
  let availInserted    = 0;
  let availSkipped     = 0;

  // Pre-fetch all doctor users in one query
  const doctorUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(like(users.email, 'doctor%@demo.com'));

  const userByEmail = new Map(doctorUsers.map((u) => [u.email, u.id]));

  for (let n = 1; n <= 100; n++) {
    const email  = `doctor${n}@demo.com`;
    const userId = userByEmail.get(email);
    if (!userId) {
      console.warn(`  ⚠ user '${email}' not found — skipping`);
      profilesSkipped++;
      continue;
    }

    const data = n <= 5
      ? HARDCODED[n - 1]!
      : generateDoctor(n);

    // Insert doctor profile
    const profileResult = await db
      .insert(doctorProfiles)
      .values({
        userId,
        firstName:           data.firstName,
        lastName:            data.lastName,
        specialization:      data.specialization,
        bio:                 data.bio,
        yearsOfExperience:   data.yearsOfExperience,
        consultationFee:     data.consultationFee,
        isAcceptingPatients: data.isAcceptingPatients,
        licenseNumber:       data.licenseNumber,
      })
      .onConflictDoNothing()
      .returning({ id: doctorProfiles.id });

    if (profileResult.length > 0) profilesInserted++;
    else profilesSkipped++;

    // Resolve profile id
    const [profile] = await db
      .select({ id: doctorProfiles.id })
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, userId));

    if (!profile) continue;

    // Skip if availability already exists
    const existingAvail = await db
      .select({ id: doctorAvailability.id })
      .from(doctorAvailability)
      .where(eq(doctorAvailability.doctorId, profile.id));

    if (existingAvail.length > 0) {
      availSkipped += AVAIL_TEMPLATES[data.availTemplate]!.days.length;
      continue;
    }

    const tmpl = AVAIL_TEMPLATES[data.availTemplate]!;
    const availResult = await db
      .insert(doctorAvailability)
      .values(
        tmpl.days.map((day) => ({
          doctorId:  profile.id,
          dayOfWeek: day as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
          startTime: tmpl.start,
          endTime:   tmpl.end,
          isActive:  true,
        })),
      )
      .onConflictDoNothing()
      .returning();

    availInserted += availResult.length;
    availSkipped  += tmpl.days.length - availResult.length;
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
