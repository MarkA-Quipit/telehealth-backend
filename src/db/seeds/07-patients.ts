import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { patientProfiles } from '../../modules/patients/patients.schema';
import { DEMO_EMAILS } from './04-users';

const PATIENTS = [
  {
    email:                 DEMO_EMAILS.patient1,
    firstName:             'Ana',
    lastName:              'Cruz',
    dateOfBirth:           '1990-05-15',
    sex:                   'female'  as const,
    weightKg:              '58.00',
    heightCm:              '160.00',
    phoneNumber:           '+63 912 345 6789',
    address:               '123 Rizal Street, Quezon City, Metro Manila',
    bloodType:             'O+'      as const,
    allergies:             'Penicillin, Aspirin',
    currentMedications:    'Amlodipine 5mg once daily',
    pastMedicalConditions: 'Hypertension diagnosed 2019, currently managed with medication.',
    familyMedicalHistory:  'Father has Type 2 Diabetes; mother has hypertension.',
    emergencyContactName:  'Juan Cruz',
    emergencyContactPhone: '+63 912 345 6780',
  },
  {
    email:                 DEMO_EMAILS.patient2,
    firstName:             'Julia',
    lastName:              'Rodriguez',
    dateOfBirth:           '1995-08-22',
    sex:                   'female'  as const,
    weightKg:              '52.00',
    heightCm:              '155.00',
    phoneNumber:           '+63 917 234 5678',
    address:               '45 Mabini Ave, Makati City, Metro Manila',
    bloodType:             'A+'      as const,
    allergies:             'Sulfa drugs',
    currentMedications:    null,
    pastMedicalConditions: 'Asthma (mild intermittent), well-controlled.',
    familyMedicalHistory:  'Mother has asthma; no other significant family history.',
    emergencyContactName:  'Roberto Rodriguez',
    emergencyContactPhone: '+63 917 234 5670',
  },
  {
    email:                 DEMO_EMAILS.patient3,
    firstName:             'Maria',
    lastName:              'Gonzalez',
    dateOfBirth:           '1985-03-10',
    sex:                   'female'  as const,
    weightKg:              '65.00',
    heightCm:              '163.00',
    phoneNumber:           '+63 918 876 5432',
    address:               '78 Bonifacio Road, Pasig City, Metro Manila',
    bloodType:             'B+'      as const,
    allergies:             'None known',
    currentMedications:    'Metformin 500mg twice daily, Atorvastatin 20mg once daily',
    pastMedicalConditions: 'Type 2 Diabetes diagnosed 2018, hyperlipidemia.',
    familyMedicalHistory:  'Both parents have Type 2 Diabetes; grandfather had a stroke.',
    emergencyContactName:  'Pedro Gonzalez',
    emergencyContactPhone: '+63 918 876 5430',
  },
  {
    email:                 DEMO_EMAILS.patient4,
    firstName:             'Carlos',
    lastName:              'Lopez',
    dateOfBirth:           '1978-11-30',
    sex:                   'male'    as const,
    weightKg:              '82.00',
    heightCm:              '175.00',
    phoneNumber:           '+63 920 111 2233',
    address:               '12 Del Pilar Street, Manila City, Metro Manila',
    bloodType:             'AB+'     as const,
    allergies:             'Ibuprofen',
    currentMedications:    'Losartan 50mg once daily',
    pastMedicalConditions: 'Hypertension diagnosed 2015, lower back injury 2020.',
    familyMedicalHistory:  'Father had a heart attack at age 60; maternal history of hypertension.',
    emergencyContactName:  'Elena Lopez',
    emergencyContactPhone: '+63 920 111 2230',
  },
  {
    email:                 DEMO_EMAILS.patient5,
    firstName:             'Sofia',
    lastName:              'Martinez',
    dateOfBirth:           '2000-07-04',
    sex:                   'female'  as const,
    weightKg:              '49.00',
    heightCm:              '158.00',
    phoneNumber:           '+63 915 999 8877',
    address:               '55 Aguinaldo Blvd, Paranaque City, Metro Manila',
    bloodType:             'O-'      as const,
    allergies:             'Latex, Shellfish',
    currentMedications:    null,
    pastMedicalConditions: 'No significant past medical history.',
    familyMedicalHistory:  'No known hereditary conditions.',
    emergencyContactName:  'Rosa Martinez',
    emergencyContactPhone: '+63 915 999 8870',
  },
] as const;

export async function seedPatients(): Promise<void> {
  let insertedCount = 0;
  let skippedCount  = 0;

  for (const patient of PATIENTS) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, patient.email));

    if (!user) {
      console.warn(`  ⚠ user '${patient.email}' not found — skipping patient profile`);
      skippedCount++;
      continue;
    }

    const result = await db
      .insert(patientProfiles)
      .values({
        userId:                user.id,
        firstName:             patient.firstName,
        lastName:              patient.lastName,
        dateOfBirth:           patient.dateOfBirth,
        sex:                   patient.sex,
        weightKg:              patient.weightKg,
        heightCm:              patient.heightCm,
        phoneNumber:           patient.phoneNumber,
        address:               patient.address,
        bloodType:             patient.bloodType,
        allergies:             patient.allergies,
        currentMedications:    patient.currentMedications,
        pastMedicalConditions: patient.pastMedicalConditions,
        familyMedicalHistory:  patient.familyMedicalHistory,
        emergencyContactName:  patient.emergencyContactName,
        emergencyContactPhone: patient.emergencyContactPhone,
      })
      .onConflictDoNothing()
      .returning();

    if (result.length > 0) {
      insertedCount++;
    } else {
      skippedCount++;
    }
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
