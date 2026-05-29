import { registerSchema, loginSchema, refreshTokenBodySchema } from '../auth.validators';

describe('registerSchema', () => {
  const validPatient = {
    email: 'patient@test.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'patient',
  };

  it('accepts a valid patient registration', () => {
    expect(() => registerSchema.parse(validPatient)).not.toThrow();
  });

  it('accepts a valid doctor registration with specialization', () => {
    expect(() =>
      registerSchema.parse({ ...validPatient, role: 'doctor', specialization: 'Cardiology' }),
    ).not.toThrow();
  });

  it('rejects a doctor without specialization', () => {
    expect(() =>
      registerSchema.parse({ ...validPatient, role: 'doctor' }),
    ).toThrow(/Specialization is required for doctors/);
  });

  it('rejects an invalid email', () => {
    expect(() =>
      registerSchema.parse({ ...validPatient, email: 'not-an-email' }),
    ).toThrow();
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() =>
      registerSchema.parse({ ...validPatient, password: 'short' }),
    ).toThrow();
  });

  it('rejects a password longer than 72 characters', () => {
    expect(() =>
      registerSchema.parse({ ...validPatient, password: 'a'.repeat(73) }),
    ).toThrow();
  });

  it('rejects an invalid role', () => {
    expect(() =>
      registerSchema.parse({ ...validPatient, role: 'admin' }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(() =>
      loginSchema.parse({ email: 'user@test.com', password: 'pass' }),
    ).not.toThrow();
  });

  it('rejects missing password', () => {
    expect(() =>
      loginSchema.parse({ email: 'user@test.com' }),
    ).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      loginSchema.parse({ email: 'not-valid', password: 'pass' }),
    ).toThrow();
  });
});

describe('refreshTokenBodySchema', () => {
  it('accepts a non-empty string', () => {
    expect(() =>
      refreshTokenBodySchema.parse({ refreshToken: 'some-token' }),
    ).not.toThrow();
  });

  it('rejects an empty string', () => {
    expect(() =>
      refreshTokenBodySchema.parse({ refreshToken: '' }),
    ).toThrow();
  });
});
