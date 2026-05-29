import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../index';
import { appointmentsService } from '../appointments.service';

jest.mock('../appointments.service');
jest.mock('../../../config/db', () => ({
  db: { execute: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../../config/pusher', () => ({ pusher: { trigger: jest.fn() } }));
jest.mock('../../../modules/auth/auth.service', () => ({
  authService: {
    verifyToken: jest.fn((token: string) => {
      const jwt = require('jsonwebtoken');
      return jwt.verify(token, 'test-jwt-secret-for-tests-only');
    }),
  },
}));

const mockApptService = appointmentsService as jest.Mocked<typeof appointmentsService>;

function makeToken(roles: string[]) {
  return jwt.sign(
    { sub: 'user-1', email: 'user@test.com', roles },
    'test-jwt-secret-for-tests-only',
    { expiresIn: '15m' },
  );
}

const patientToken = makeToken(['patient']);
const doctorToken = makeToken(['doctor']);

describe('POST /api/appointments', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).post('/api/appointments').send({});
    expect(res.status).toBe(401);
  });

  it('returns 201 on valid patient booking', async () => {
    mockApptService.createAppointment.mockResolvedValue({ id: 'appt-1' } as never);
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: '550e8400-e29b-41d4-a716-446655440000',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(res.status).toBe(201);
  });

  it('returns 400 for invalid scheduledAt', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: '550e8400-e29b-41d4-a716-446655440000',
        scheduledAt: 'not-a-date',
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/appointments', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/appointments');
    expect(res.status).toBe(401);
  });

  it('returns 200 when authenticated', async () => {
    mockApptService.listAppointments.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 } as never);
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/appointments/patients/search', () => {
  it('returns 403 when requested by a patient', async () => {
    const res = await request(app)
      .get('/api/appointments/patients/search')
      .set('Authorization', `Bearer ${patientToken}`)
      .query({ q: 'Jo' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when q is too short (1 char)', async () => {
    const res = await request(app)
      .get('/api/appointments/patients/search')
      .set('Authorization', `Bearer ${doctorToken}`)
      .query({ q: 'J' });
    expect(res.status).toBe(400);
  });

  it('returns 200 with valid doctor token and q', async () => {
    mockApptService.searchPatients.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 } as never);
    const res = await request(app)
      .get('/api/appointments/patients/search')
      .set('Authorization', `Bearer ${doctorToken}`)
      .query({ q: 'Jo' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/appointments/:id/calendar', () => {
  it('returns a text/calendar content-type', async () => {
    mockApptService.generateIcsContent.mockResolvedValue('BEGIN:VCALENDAR\nEND:VCALENDAR');
    const res = await request(app)
      .get('/api/appointments/appt-1/calendar')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
  });
});

describe('PATCH /api/appointments/:id/status', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .patch('/api/appointments/appt-1/status')
      .send({ status: 'confirmed' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/appointments/:id', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).delete('/api/appointments/appt-1');
    expect(res.status).toBe(401);
  });
});
