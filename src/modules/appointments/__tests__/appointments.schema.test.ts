import {
  createAppointmentSchema,
  updateStatusSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  searchPatientsSchema,
} from '../appointments.schema';

describe('createAppointmentSchema', () => {
  const validBase = {
    doctorId: '550e8400-e29b-41d4-a716-446655440000',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  };

  it('accepts a valid create payload', () => {
    expect(() => createAppointmentSchema.parse(validBase)).not.toThrow();
  });

  it('rejects an invalid UUID for doctorId', () => {
    expect(() =>
      createAppointmentSchema.parse({ ...validBase, doctorId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects a non-ISO datetime for scheduledAt', () => {
    expect(() =>
      createAppointmentSchema.parse({ ...validBase, scheduledAt: 'not-a-date' }),
    ).toThrow();
  });

  it('defaults durationMinutes to 30 when omitted', () => {
    const result = createAppointmentSchema.parse(validBase);
    expect(result.durationMinutes).toBe(30);
  });

  it('rejects durationMinutes below 15', () => {
    expect(() =>
      createAppointmentSchema.parse({ ...validBase, durationMinutes: 10 }),
    ).toThrow();
  });

  it('rejects durationMinutes above 120', () => {
    expect(() =>
      createAppointmentSchema.parse({ ...validBase, durationMinutes: 150 }),
    ).toThrow();
  });
});

describe('updateStatusSchema', () => {
  it('accepts "confirmed"', () => {
    expect(() => updateStatusSchema.parse({ status: 'confirmed' })).not.toThrow();
  });

  it('accepts "completed"', () => {
    expect(() => updateStatusSchema.parse({ status: 'completed' })).not.toThrow();
  });

  it('rejects "pending"', () => {
    expect(() => updateStatusSchema.parse({ status: 'pending' })).toThrow();
  });

  it('rejects "cancelled"', () => {
    expect(() => updateStatusSchema.parse({ status: 'cancelled' })).toThrow();
  });
});

describe('cancelAppointmentSchema', () => {
  it('accepts empty body', () => {
    expect(() => cancelAppointmentSchema.parse({})).not.toThrow();
  });

  it('accepts optional cancellationReason', () => {
    expect(() =>
      cancelAppointmentSchema.parse({ cancellationReason: 'Changed plans' }),
    ).not.toThrow();
  });
});

describe('rescheduleAppointmentSchema', () => {
  it('accepts a valid reschedule payload', () => {
    expect(() =>
      rescheduleAppointmentSchema.parse({
        newScheduledAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).not.toThrow();
  });

  it('rejects invalid ISO datetime', () => {
    expect(() =>
      rescheduleAppointmentSchema.parse({ newScheduledAt: 'not-a-date' }),
    ).toThrow();
  });
});

describe('searchPatientsSchema', () => {
  it('rejects q shorter than 2 characters', () => {
    expect(() => searchPatientsSchema.parse({ q: 'J' })).toThrow();
  });

  it('accepts valid bloodType enum', () => {
    expect(() => searchPatientsSchema.parse({ bloodType: 'O+' })).not.toThrow();
  });

  it('rejects invalid bloodType', () => {
    expect(() => searchPatientsSchema.parse({ bloodType: 'X+' })).toThrow();
  });

  it('coerces minConsultations from string to number', () => {
    const result = searchPatientsSchema.parse({ q: 'Jo', minConsultations: '3' });
    expect(result.minConsultations).toBe(3);
  });
});
