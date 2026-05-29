import { eq, like } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../modules/users/users.schema';
import { doctorProfiles, doctorBlockedSlots } from '../../modules/doctors/doctors.schema';

// ---------------------------------------------------------------------------
// Deterministic UUID: bd{6-digit-n}-0000-0000-0000-000000000000
// ---------------------------------------------------------------------------
function blockedSlotId(n: number): string {
  return `bd${String(n).padStart(6, '0')}-0000-0000-0000-000000000000`;
}

// ---------------------------------------------------------------------------
// Block templates — [startTime, endTime, reason]
// ---------------------------------------------------------------------------
const BLOCK_TEMPLATES = [
  { startTime: '12:00', endTime: '13:00', reason: 'Lunch break' },
  { startTime: '15:00', endTime: '16:00', reason: 'Administrative work' },
  { startTime: '07:00', endTime: '08:00', reason: 'Morning rounds' },
  { startTime: '17:00', endTime: '18:00', reason: 'Staff meeting' },
  { startTime: '13:00', endTime: '14:00', reason: 'Personal appointment' },
] as const;

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ---------------------------------------------------------------------------
// Seeder — 2 blocked slots per doctor (1 one-time, 1 weekly recurring)
// ---------------------------------------------------------------------------
export async function seedBlockedSlots(): Promise<void> {
  // Fetch all doctor profiles with their index ordering
  const doctorRows = await db
    .select({ id: doctorProfiles.id })
    .from(doctorProfiles)
    .innerJoin(users, eq(doctorProfiles.userId, users.id))
    .where(like(users.email, 'doctor%@demo.com'))
    .orderBy(users.email);

  if (doctorRows.length === 0) {
    console.log('✓ Seeded doctor blocked slots (0 inserted, 0 skipped)');
    return;
  }

  const rows: {
    id: string; doctorId: string;
    blockedDate: Date; startTime: string; endTime: string;
    reason: string; recurrenceType: string;
  }[] = [];

  let slotIndex = 0;

  for (let i = 0; i < doctorRows.length; i++) {
    const doctor  = doctorRows[i]!;
    const tmplA   = BLOCK_TEMPLATES[i % BLOCK_TEMPLATES.length]!;
    const tmplB   = BLOCK_TEMPLATES[(i + 2) % BLOCK_TEMPLATES.length]!;

    // Slot 1 — one-time block, spread across next 7–60 days
    rows.push({
      id:             blockedSlotId(slotIndex + 1),
      doctorId:       doctor.id,
      blockedDate:    daysFromNow((i % 53) + 7),
      startTime:      tmplA.startTime,
      endTime:        tmplA.endTime,
      reason:         tmplA.reason,
      recurrenceType: 'none',
    });
    slotIndex++;

    // Slot 2 — weekly recurring, starts within next 7 days
    rows.push({
      id:             blockedSlotId(slotIndex + 1),
      doctorId:       doctor.id,
      blockedDate:    daysFromNow((i % 7) + 1),
      startTime:      tmplB.startTime,
      endTime:        tmplB.endTime,
      reason:         tmplB.reason,
      recurrenceType: 'weekly',
    });
    slotIndex++;
  }

  let inserted = 0;
  for (let start = 0; start < rows.length; start += 50) {
    const batch = rows.slice(start, start + 50);
    const result = await db
      .insert(doctorBlockedSlots)
      .values(batch)
      .onConflictDoNothing()
      .returning();
    inserted += result.length;
  }

  console.log(`✓ Seeded doctor blocked slots (${inserted} inserted, ${rows.length - inserted} skipped)`);
}

// ---------------------------------------------------------------------------
// Standalone execution
// ---------------------------------------------------------------------------
if (require.main === module) {
  seedBlockedSlots()
    .then(() => process.exit(0))
    .catch((err) => { console.error('✗ seedBlockedSlots failed:', err); process.exit(1); });
}
