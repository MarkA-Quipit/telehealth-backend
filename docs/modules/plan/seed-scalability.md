# Seed Scalability Plan: Every Doctor Gets Appointments + Consultation Notes

## Context

Currently `08-appointments.ts` seeds 200 bulk appointments using a "2 per patient" loop, giving each
doctor exactly 2 appointments with only ~51 `completed`. `09-notes.ts` seeds exactly 1 consultation
note (for the hardcoded demo appointment only). The goal is to ensure every doctor has multiple
appointments and every completed appointment has a consultation note, enabling realistic scalability
testing of the system.

---

## Files to Change

| File | Change Summary |
|---|---|
| `08-appointments.ts` | Restructure loop + add `APPOINTMENTS_PER_DOCTOR = 20` |
| `09-notes.ts` | Add bulk note generation for all completed appointments |
| `10-prescriptions.ts` | Add bulk prescriptions for all completed appointments |
| `13-ai-logs.ts` | Increase AI logs per patient from 2 to 5 |
| `15-chat-messages.ts` | Extend chat turns per appointment from 5 to 10 |

---

## Change 1 — `08-appointments.ts`

**Goal:** Every doctor gets exactly 20 appointments, with at least 6 `completed` (30%).

Add near the top after `DEMO_APPOINTMENT_IDS`:

```ts
const APPOINTMENTS_PER_DOCTOR = 20;

// Repeats twice for j=0..19 → 6 'completed' per doctor (30%)
const STATUS_CYCLE = [
  'pending', 'confirmed', 'completed', 'cancelled',
  'completed', 'confirmed', 'pending', 'completed',
  'cancelled', 'confirmed',
] as const satisfies ReadonlyArray<typeof STATUSES[number]>;
```

Replace the current bulk loop (inner loop over `[doctorIndexA, doctorIndexB]` per patient) with:

```
for i in 0..allDoctors.length          (100 doctors)
  for j in 0..APPOINTMENTS_PER_DOCTOR  (20 per doctor)
    k = i * APPOINTMENTS_PER_DOCTOR + j
    patientIndex = k % allPatients.length
    status = STATUS_CYCLE[j % STATUS_CYCLE.length]
    apptId = bulkApptId(k + 1)          // ba000001 → ba002000
```

The `bulkApptId()` helper already pads to 6 digits — no change needed.
Keep all 4 demo appointments (`DEMO_APPOINTMENT_IDS`) completely unchanged.

---

## Change 2 — `09-notes.ts`

**Goal:** Seed 1 consultation note for every completed appointment (not just the demo one).

Keep the existing demo note block unchanged. Add data pools before `seedNotes()`:

```ts
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
```

After the demo note block, add:

```ts
// New imports needed: and, notInArray from drizzle-orm; faker from @faker-js/faker
const DEMO_IDS = Object.values(DEMO_APPOINTMENT_IDS);

const completedAppts = await db
  .select({ id: appointments.id, doctorId: appointments.doctorId, patientId: appointments.patientId })
  .from(appointments)
  .where(and(eq(appointments.status, 'completed'), notInArray(appointments.id, DEMO_IDS)));

const bulkNoteRows = completedAppts.map((appt, i) => {
  faker.seed(i + 9000);
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
  const result = await db.insert(consultationNotes).values(batch).onConflictDoNothing().returning();
  bulkInserted += result.length;
}
```

No explicit `id` needed — `consultationNotes.id` uses `defaultRandom()`.
Idempotency is safe: `onConflictDoNothing()` targets the `appointmentId` unique constraint (confirmed in schema).

---

## Change 3 — `10-prescriptions.ts`

**Goal:** 1 prescription per completed bulk appointment.

Add a medications pool (10 entries) and UUID generator `rxId(n)` using prefix `rx{6-digit}`. After the
2 demo prescriptions block, query all completed bulk appointments excluding `DEMO_APPOINTMENT_IDS`,
then insert 1 prescription row per appointment cycling the pool.

New imports needed: `and`, `notInArray` from `drizzle-orm` (same pattern as notes).

---

## Change 4 — `13-ai-logs.ts`

**Goal:** More AI log history per patient.

Change the inner loop from:

```ts
for (let j = 0; j < 2; j++) {
```

to:

```ts
for (let j = 0; j < 5; j++) {
```

The existing `logIndex` and `specIndex` formulas handle arbitrary `j` values without collision.
UUID range expands from `ca000200` to `ca000500`.

---

## Change 5 — `15-chat-messages.ts`

**Goal:** More conversational depth per appointment.

Extend the `TURNS` array from 5 to 10 entries. Append 5 more alternating doctor/patient turns:

```ts
{ role: 'doctor',  offsetMin: 18 },
{ role: 'patient', offsetMin: 22 },
{ role: 'doctor',  offsetMin: 25 },
{ role: 'patient', offsetMin: 28 },
{ role: 'doctor',  offsetMin: 30 },
```

The existing `DOCTOR_MESSAGES` (7) and `PATIENT_MESSAGES` (7) pools cycle cleanly across 10 turns.

---

## Auto-Scaling Side Effects (no changes needed)

These files already loop over DB-queried completed appointments and scale automatically:

- `12-reviews.ts` → ~600 reviews (was ~51)
- `11-notifications.ts` → ~2,000 notifications (was ~200)

---

## Final Record Counts

| Entity | Before | After |
|---|---|---|
| Bulk appointments | 200 | 2,000 (100 doctors × 20) |
| Completed appointments | ~51 | ~600 (6 per doctor, 30%) |
| Consultation notes | 1 | ~601 |
| Prescriptions | 2 | ~602 |
| AI logs | 200 | 500 |
| Reviews | ~51 | ~600 (auto) |
| Chat messages | ~255 | ~6,000 |
| Notifications | ~200 | ~2,000 (auto) |

---

## Blocked Option

**Multi-note appointments** — `consultation_notes.appointment_id` has a `.unique()` DB constraint
(one note per appointment). Allowing multiple notes per appointment would require a schema migration
to drop that constraint and updates to the consultations service upsert logic. Not in scope for now.

---

## Verification

After running the seed:

```sql
-- Every doctor should have exactly 20 appointments
SELECT doctor_id, COUNT(*) FROM appointments GROUP BY doctor_id ORDER BY count;

-- Total notes should be ~601
SELECT COUNT(*) FROM consultation_notes;

-- Every doctor should have at least 6 notes
SELECT dp.id, COUNT(cn.id) AS notes
FROM doctor_profiles dp
LEFT JOIN appointments a ON a.doctor_id = dp.id
LEFT JOIN consultation_notes cn ON cn.appointment_id = a.id
GROUP BY dp.id;

-- Re-run seed to confirm idempotency (should report 0 new inserts)
```
