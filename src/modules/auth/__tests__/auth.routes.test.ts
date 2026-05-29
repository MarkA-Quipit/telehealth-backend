import request from 'supertest';
import app from '../../../index';
import { authService } from '../auth.service';

jest.mock('../auth.service');
jest.mock('../../../config/db', () => ({
  db: { execute: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../../config/pusher', () => ({ pusher: { trigger: jest.fn() } }));

const mockAuthService = authService as jest.Mocked<typeof authService>;

// Make verifyToken behave correctly for signed tokens — the real logic is simple
mockAuthService.verifyToken.mockImplementation((token: string) => {
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, 'test-jwt-secret-for-tests-only') as { sub: string; email: string; roles: string[] };
});

const tokenData = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  user: { id: 'user-1', email: 'pat@test.com', roles: ['patient'], createdAt: new Date(), lastLoginAt: null },
};

describe('POST /api/auth/register', () => {
  it('returns 201 with token data on valid patient registration', async () => {
    mockAuthService.register.mockResolvedValue(tokenData);
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'new@test.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'patient',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'password123', firstName: 'Jane', lastName: 'Doe', role: 'patient' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation error');
  });

  it('returns 400 when doctor is missing specialization', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'doc@test.com',
        password: 'password123',
        firstName: 'Dr',
        lastName: 'Smith',
        role: 'doctor',
        // no specialization
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 200 on valid credentials', async () => {
    mockAuthService.login.mockResolvedValue(tokenData);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pat@test.com', password: 'pass' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('test-access-token');
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pat@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user data when authenticated', async () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { sub: 'user-1', email: 'pat@test.com', roles: ['patient'] },
      'test-jwt-secret-for-tests-only',
      { expiresIn: '15m' },
    );
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('user-1');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 200 with new access token', async () => {
    mockAuthService.refresh.mockResolvedValue({ accessToken: 'new-token' });
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'valid-refresh-token' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new-token');
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'rt' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout-all', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/auth/logout-all');
    expect(res.status).toBe(401);
  });
});
