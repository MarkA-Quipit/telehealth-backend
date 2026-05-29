import { authService } from '../auth.service';
import { authRepository } from '../auth.repository';
import { AppError } from '../../../shared/types';

// Prevent real DB connections
jest.mock('../../../config/db', () => ({
  db: {
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}));

jest.mock('../auth.repository');
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockRepo = authRepository as jest.Mocked<typeof authRepository>;

const baseUser = {
  id: 'user-1',
  email: 'pat@test.com',
  passwordHash: 'hashed-password',
  isActive: true,
  isEmailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  deletedAt: null,
};

describe('authService.register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(409) when email is already in use', async () => {
    mockRepo.findByEmail.mockResolvedValue(baseUser);
    await expect(
      authService.register({
        email: 'pat@test.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'patient',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('calls createUser, assignRole, createPatientProfile inside a transaction', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    mockRepo.createUser.mockResolvedValue(baseUser);
    mockRepo.assignRole.mockResolvedValue(undefined);
    mockRepo.createPatientProfile.mockResolvedValue(undefined);
    mockRepo.getUserRoles.mockResolvedValue(['patient']);
    mockRepo.storeRefreshToken.mockResolvedValue(undefined);

    await authService.register({
      email: 'new@test.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'patient',
    });

    expect(mockRepo.createUser).toHaveBeenCalled();
    expect(mockRepo.assignRole).toHaveBeenCalledWith('user-1', 'patient', expect.anything());
    expect(mockRepo.createPatientProfile).toHaveBeenCalled();
  });

  it('calls createDoctorProfile when role is doctor', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    mockRepo.createUser.mockResolvedValue(baseUser);
    mockRepo.assignRole.mockResolvedValue(undefined);
    mockRepo.createDoctorProfile.mockResolvedValue(undefined);
    mockRepo.getUserRoles.mockResolvedValue(['doctor']);
    mockRepo.storeRefreshToken.mockResolvedValue(undefined);

    await authService.register({
      email: 'doc@test.com',
      password: 'password123',
      firstName: 'Dr',
      lastName: 'Smith',
      role: 'doctor',
      specialization: 'Cardiology',
    });

    expect(mockRepo.createDoctorProfile).toHaveBeenCalled();
  });

  it('returns accessToken, refreshToken, and sanitized user', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    mockRepo.createUser.mockResolvedValue(baseUser);
    mockRepo.assignRole.mockResolvedValue(undefined);
    mockRepo.createPatientProfile.mockResolvedValue(undefined);
    mockRepo.getUserRoles.mockResolvedValue(['patient']);
    mockRepo.storeRefreshToken.mockResolvedValue(undefined);

    const result = await authService.register({
      email: 'new@test.com',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'patient',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('pat@test.com');
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});

describe('authService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(401) when user is not found — same message as wrong password', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    await expect(
      authService.login({ email: 'nobody@test.com', password: 'pass' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });

  it('throws AppError(401) when password does not match', async () => {
    const bcrypt = await import('bcryptjs');
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    mockRepo.findByEmail.mockResolvedValue(baseUser);
    await expect(
      authService.login({ email: 'pat@test.com', password: 'wrong' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });

  it('throws AppError(403) when account is deactivated', async () => {
    mockRepo.findByEmail.mockResolvedValue({ ...baseUser, isActive: false });
    await expect(
      authService.login({ email: 'pat@test.com', password: 'pass' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns token pair and sanitized user on success', async () => {
    mockRepo.findByEmail.mockResolvedValue(baseUser);
    mockRepo.updateLastLogin.mockResolvedValue(undefined);
    mockRepo.getUserRoles.mockResolvedValue(['patient']);
    mockRepo.storeRefreshToken.mockResolvedValue(undefined);

    const result = await authService.login({ email: 'pat@test.com', password: 'pass' });
    expect(result.accessToken).toBeDefined();
    expect(result.user.roles).toEqual(['patient']);
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});

describe('authService.refresh', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws AppError(401) when refresh token hash is not in the store', async () => {
    mockRepo.findRefreshToken.mockResolvedValue(null);
    await expect(authService.refresh('invalid-token')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('returns a new accessToken on success', async () => {
    mockRepo.findRefreshToken.mockResolvedValue({ id: 'rt-1', userId: 'user-1', tokenHash: 'h', expiresAt: new Date(), revokedAt: null, createdAt: new Date() });
    mockRepo.findById.mockResolvedValue(baseUser);
    mockRepo.getUserRoles.mockResolvedValue(['patient']);

    const result = await authService.refresh('valid-token');
    expect(result.accessToken).toBeDefined();
  });
});

describe('authService.verifyToken', () => {
  it('returns the decoded payload for a valid JWT', () => {
    const token = authService['verifyToken'] ? undefined : undefined; // not exported, use indirectly
    // verifyToken is called by the middleware — test through middleware instead
    // Here we test that a well-formed JWT signed with the correct secret passes
    const jwt = require('jsonwebtoken');
    const signed = jwt.sign(
      { sub: 'u1', email: 'a@b.com', roles: ['patient'] },
      'test-jwt-secret-for-tests-only',
      { expiresIn: '15m' },
    );
    const payload = authService.verifyToken(signed);
    expect(payload.sub).toBe('u1');
    void token;
  });

  it('throws for a tampered JWT', () => {
    expect(() => authService.verifyToken('not.a.valid.token')).toThrow();
  });
});
