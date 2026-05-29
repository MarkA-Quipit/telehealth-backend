import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { appointments } from '../../modules/appointments/appointments.schema';
import { chatMessages } from '../../modules/appointments/appointments.schema';
import { doctorProfiles } from '../../modules/doctors/doctors.schema';
import { patientProfiles } from '../../modules/patients/patients.schema';

// ---------------------------------------------------------------------------
// Deterministic UUID: bc{6-digit-n}-0000-0000-0000-000000000000
// ---------------------------------------------------------------------------
function chatMsgId(n: number): string {
  return `bc${String(n).padStart(6, '0')}-0000-0000-0000-000000000000`;
}

// ---------------------------------------------------------------------------
// Sample message pools (doctor opens, then alternates with patient)
// ---------------------------------------------------------------------------
const DOCTOR_MESSAGES = [
  'Hello, thank you for joining. Let\'s go over your symptoms today.',
  'I understand. Based on what you\'ve described, let me ask a few more questions.',
  'That\'s helpful. Have you noticed any changes since your last visit?',
  'I\'m going to recommend a follow-up examination. Please monitor this closely.',
  'Your results look manageable. I\'ll update your prescription accordingly.',
  'Good progress. Continue your current medication and stay hydrated.',
  'Please make sure to rest adequately and avoid strenuous activity this week.',
] as const;

const PATIENT_MESSAGES = [
  'Hello doctor. Yes, I\'ve been experiencing the symptoms I mentioned.',
  'The pain has been on and off for the past few days, mostly in the evening.',
  'Should I be worried? It\'s been affecting my daily routine.',
  'I\'ve been taking the medication you prescribed but it doesn\'t seem to be fully working.',
  'Thank you, I feel reassured. I\'ll follow your advice.',
  'Is there anything I should avoid eating or doing in the meantime?',
  'I\'ll schedule the follow-up as suggested. Thank you, doctor.',
] as const;

// ---------------------------------------------------------------------------
// Seeder — 5 alternating messages per completed appointment
// ---------------------------------------------------------------------------
export async function seedChatMessages(): Promise<void> {
  // Fetch all completed appointments with patient and doctor user IDs
  const completedAppts = await db
    .select({
      id:            appointments.id,
      scheduledAt:   appointments.scheduledAt,
      patientUserId: patientProfiles.userId,
      doctorUserId:  doctorProfiles.userId,
    })
    .from(appointments)
    .innerJoin(patientProfiles, eq(appointments.patientId, patientProfiles.id))
    .innerJoin(doctorProfiles,  eq(appointments.doctorId,  doctorProfiles.id))
    .where(eq(appointments.status, 'completed'));

  if (completedAppts.length === 0) {
    console.log('✓ Seeded chat messages (0 inserted, 0 skipped)');
    return;
  }

  const rows: {
    id: string; appointmentId: string; senderId: string;
    message: string; sentAt: Date;
  }[] = [];

  let msgIndex = 0;

  for (let i = 0; i < completedAppts.length; i++) {
    const appt      = completedAppts[i]!;
    const baseTime  = new Date(appt.scheduledAt);

    // 5 messages per appointment: doctor → patient → doctor → patient → doctor
    const TURNS: Array<{ sender: 'doctor' | 'patient'; offsetMin: number }> = [
      { sender: 'doctor',  offsetMin: 1  },
      { sender: 'patient', offsetMin: 3  },
      { sender: 'doctor',  offsetMin: 6  },
      { sender: 'patient', offsetMin: 10 },
      { sender: 'doctor',  offsetMin: 14 },
    ];

    for (const turn of TURNS) {
      const pool    = turn.sender === 'doctor' ? DOCTOR_MESSAGES : PATIENT_MESSAGES;
      const msgText = pool[(i + msgIndex) % pool.length]!;
      const sentAt  = new Date(baseTime.getTime() + turn.offsetMin * 60 * 1000);

      rows.push({
        id:            chatMsgId(msgIndex + 1),
        appointmentId: appt.id,
        senderId:      turn.sender === 'doctor' ? appt.doctorUserId : appt.patientUserId,
        message:       msgText,
        sentAt,
      });

      msgIndex++;
    }
  }

  let inserted = 0;
  for (let start = 0; start < rows.length; start += 50) {
    const batch = rows.slice(start, start + 50);
    const result = await db
      .insert(chatMessages)
      .values(batch)
      .onConflictDoNothing()
      .returning();
    inserted += result.length;
  }

  console.log(`✓ Seeded chat messages (${inserted} inserted, ${rows.length - inserted} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedChatMessages()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedChatMessages failed:', err); process.exit(1); });
}
