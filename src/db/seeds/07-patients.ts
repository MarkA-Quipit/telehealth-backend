import { eq, like } from 'drizzle-orm';
import { faker } from '@faker-js/faker';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { patientProfiles } from '../../modules/patients/patients.schema';

// ---------------------------------------------------------------------------
// Static data pools (Philippines-specific)
// ---------------------------------------------------------------------------
const PH_ADDRESSES = [
  '123 Rizal Street, Quezon City, Metro Manila',
  '45 Mabini Ave, Makati City, Metro Manila',
  '78 Bonifacio Road, Pasig City, Metro Manila',
  '12 Del Pilar Street, Manila City, Metro Manila',
  '55 Aguinaldo Blvd, Paranaque City, Metro Manila',
  '88 Sampaguita Street, Caloocan City, Metro Manila',
  '34 Burgos Avenue, Taguig City, Metro Manila',
  '101 Magsaysay Road, Mandaluyong City, Metro Manila',
  '67 Lapu-Lapu Street, Las Piñas City, Metro Manila',
  '22 Pres. Quirino Ave, Manila City, Metro Manila',
] as const;

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const SEX_VALUES = ['male', 'female', 'female', 'male', 'female', 'male', 'female', 'male', 'other', 'female'] as const;

const ALLERGIES_POOL = [
  'Penicillin, Aspirin',
  'Sulfa drugs',
  'None known',
  'Ibuprofen',
  'Latex, Shellfish',
  'Peanuts, Tree nuts',
  'Codeine',
  'Contrast dye',
  'None',
  'Amoxicillin',
] as const;

const MEDICATIONS_POOL = [
  'Amlodipine 5mg once daily',
  null,
  'Metformin 500mg twice daily, Atorvastatin 20mg once daily',
  'Losartan 50mg once daily',
  null,
  'Levothyroxine 50mcg once daily',
  'Omeprazole 20mg once daily',
  null,
  'Aspirin 81mg once daily',
  'Atenolol 25mg once daily',
] as const;

const CONDITIONS_POOL = [
  'Hypertension diagnosed 2019, currently managed with medication.',
  'Asthma (mild intermittent), well-controlled.',
  'Type 2 Diabetes diagnosed 2018, hyperlipidemia.',
  'Hypertension diagnosed 2015, lower back injury 2020.',
  'No significant past medical history.',
  'Hypothyroidism diagnosed 2017.',
  'GERD, managed with proton pump inhibitors.',
  'No significant past medical history.',
  'Coronary artery disease, post-angioplasty 2021.',
  'Chronic kidney disease stage 2.',
] as const;

const FAMILY_HISTORY_POOL = [
  'Father has Type 2 Diabetes; mother has hypertension.',
  'Mother has asthma; no other significant family history.',
  'Both parents have Type 2 Diabetes; grandfather had a stroke.',
  'Father had a heart attack at age 60; maternal history of hypertension.',
  'No known hereditary conditions.',
  'Mother has thyroid disease; father has hypertension.',
  'Grandfather had colon cancer; no other significant history.',
  'No known hereditary conditions.',
  'Strong family history of cardiovascular disease.',
  'Maternal grandmother had breast cancer.',
] as const;

// ---------------------------------------------------------------------------
// Hardcoded patients 1–5 (preserves existing profiles exactly)
// ---------------------------------------------------------------------------
interface PatientData {
  email: string; firstName: string; lastName: string; dateOfBirth: string;
  sex: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  weightKg: string; heightCm: string; phoneNumber: string; address: string;
  bloodType: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
  allergies: string | null; currentMedications: string | null;
  pastMedicalConditions: string | null; familyMedicalHistory: string | null;
  emergencyContactName: string; emergencyContactPhone: string;
  insuranceProvider?: string | null; insurancePolicyNumber?: string | null;
}

const HARDCODED: PatientData[] = [
  {
    email: 'patient1@demo.com', firstName: 'Ana',    lastName: 'Cruz',      dateOfBirth: '1990-05-15', sex: 'female',
    weightKg: '58.00', heightCm: '160.00', phoneNumber: '+63 912 345 6789',
    address: '123 Rizal Street, Quezon City, Metro Manila', bloodType: 'O+',
    allergies: 'Penicillin, Aspirin', currentMedications: 'Amlodipine 5mg once daily',
    pastMedicalConditions: 'Hypertension diagnosed 2019, currently managed with medication.',
    familyMedicalHistory: 'Father has Type 2 Diabetes; mother has hypertension.',
    emergencyContactName: 'Juan Cruz', emergencyContactPhone: '+63 912 345 6780',
  },
  {
    email: 'patient2@demo.com', firstName: 'Julia',  lastName: 'Rodriguez', dateOfBirth: '1995-08-22', sex: 'female',
    weightKg: '52.00', heightCm: '155.00', phoneNumber: '+63 917 234 5678',
    address: '45 Mabini Ave, Makati City, Metro Manila', bloodType: 'A+',
    allergies: 'Sulfa drugs', currentMedications: null,
    pastMedicalConditions: 'Asthma (mild intermittent), well-controlled.',
    familyMedicalHistory: 'Mother has asthma; no other significant family history.',
    emergencyContactName: 'Roberto Rodriguez', emergencyContactPhone: '+63 917 234 5670',
  },
  {
    email: 'patient3@demo.com', firstName: 'Maria',  lastName: 'Gonzalez',  dateOfBirth: '1985-03-10', sex: 'female',
    weightKg: '65.00', heightCm: '163.00', phoneNumber: '+63 918 876 5432',
    address: '78 Bonifacio Road, Pasig City, Metro Manila', bloodType: 'B+',
    allergies: 'None known', currentMedications: 'Metformin 500mg twice daily, Atorvastatin 20mg once daily',
    pastMedicalConditions: 'Type 2 Diabetes diagnosed 2018, hyperlipidemia.',
    familyMedicalHistory: 'Both parents have Type 2 Diabetes; grandfather had a stroke.',
    emergencyContactName: 'Pedro Gonzalez', emergencyContactPhone: '+63 918 876 5430',
  },
  {
    email: 'patient4@demo.com', firstName: 'Carlos', lastName: 'Lopez',     dateOfBirth: '1978-11-30', sex: 'male',
    weightKg: '82.00', heightCm: '175.00', phoneNumber: '+63 920 111 2233',
    address: '12 Del Pilar Street, Manila City, Metro Manila', bloodType: 'AB+',
    allergies: 'Ibuprofen', currentMedications: 'Losartan 50mg once daily',
    pastMedicalConditions: 'Hypertension diagnosed 2015, lower back injury 2020.',
    familyMedicalHistory: 'Father had a heart attack at age 60; maternal history of hypertension.',
    emergencyContactName: 'Elena Lopez', emergencyContactPhone: '+63 920 111 2230',
  },
  {
    email: 'patient5@demo.com', firstName: 'Sofia',  lastName: 'Martinez',  dateOfBirth: '2000-07-04', sex: 'female',
    weightKg: '49.00', heightCm: '158.00', phoneNumber: '+63 915 999 8877',
    address: '55 Aguinaldo Blvd, Paranaque City, Metro Manila', bloodType: 'O-',
    allergies: 'Latex, Shellfish', currentMedications: null,
    pastMedicalConditions: 'No significant past medical history.',
    familyMedicalHistory: 'No known hereditary conditions.',
    emergencyContactName: 'Rosa Martinez', emergencyContactPhone: '+63 915 999 8870',
  },
];

// ---------------------------------------------------------------------------
// Generator for bulk patients 6–100
// ---------------------------------------------------------------------------
function generatePatient(n: number): PatientData {
  faker.seed(n * 200);
  const idx = (n - 1) % 10;
  const sex = SEX_VALUES[idx]!;
  const dob = faker.date.between({ from: new Date('1960-01-01'), to: new Date('2005-12-31') });

  const weightRaw = faker.number.float({ min: 45, max: 100, fractionDigits: 2 });
  const heightRaw = faker.number.float({ min: 150, max: 185, fractionDigits: 2 });

  // ~50% have insurance
  const hasInsurance = n % 2 === 0;
  const insurers = ['PhilHealth', 'Maxicare', 'MediCard', 'Intellicare', 'Careplus'];

  return {
    email:                 `patient${n}@demo.com`,
    firstName:             faker.person.firstName(sex === 'male' ? 'male' : 'female'),
    lastName:              faker.person.lastName(),
    dateOfBirth:           dob.toISOString().split('T')[0]!,
    sex,
    weightKg:              weightRaw.toFixed(2),
    heightCm:              heightRaw.toFixed(2),
    phoneNumber:           `+63 9${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`,
    address:               PH_ADDRESSES[idx]!,
    bloodType:             BLOOD_TYPES[idx % BLOOD_TYPES.length]!,
    allergies:             ALLERGIES_POOL[idx]!,
    currentMedications:    MEDICATIONS_POOL[idx],
    pastMedicalConditions: CONDITIONS_POOL[idx]!,
    familyMedicalHistory:  FAMILY_HISTORY_POOL[idx]!,
    emergencyContactName:  `${faker.person.firstName()} ${faker.person.lastName()}`,
    emergencyContactPhone: `+63 9${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`,
    insuranceProvider:     hasInsurance ? insurers[n % insurers.length]! : null,
    insurancePolicyNumber: hasInsurance ? `POL-${faker.string.alphanumeric(8).toUpperCase()}` : null,
  };
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------
export async function seedPatients(): Promise<void> {
  let insertedCount = 0;
  let skippedCount  = 0;

  // Pre-fetch all patient users
  const patientUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(like(users.email, 'patient%@demo.com'));

  const userByEmail = new Map(patientUsers.map((u) => [u.email, u.id]));

  for (let n = 1; n <= 100; n++) {
    const email  = `patient${n}@demo.com`;
    const userId = userByEmail.get(email);
    if (!userId) {
      console.warn(`  ⚠ user '${email}' not found — skipping patient profile`);
      skippedCount++;
      continue;
    }

    const p = n <= 5 ? HARDCODED[n - 1]! : generatePatient(n);

    const result = await db
      .insert(patientProfiles)
      .values({
        userId,
        firstName:             p.firstName,
        lastName:              p.lastName,
        dateOfBirth:           p.dateOfBirth,
        sex:                   p.sex,
        weightKg:              p.weightKg,
        heightCm:              p.heightCm,
        phoneNumber:           p.phoneNumber,
        address:               p.address,
        bloodType:             p.bloodType,
        allergies:             p.allergies,
        currentMedications:    p.currentMedications ?? null,
        pastMedicalConditions: p.pastMedicalConditions,
        familyMedicalHistory:  p.familyMedicalHistory,
        emergencyContactName:  p.emergencyContactName,
        emergencyContactPhone: p.emergencyContactPhone,
        insuranceProvider:     p.insuranceProvider ?? null,
        insurancePolicyNumber: p.insurancePolicyNumber ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (result.length > 0) insertedCount++;
    else skippedCount++;
  }

  console.log(`✓ Seeded patient profiles (${insertedCount} inserted, ${skippedCount} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedPatients()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedPatients failed:', err); process.exit(1); });
}
