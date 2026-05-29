import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../index';
import { doctorsService } from '../doctors.service';

jest.mock('../doctors.service');
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

const mockDocService = doctorsService as jest.Mocked<typeof doctorsService>;

function makeToken(roles: string[]) {
  return jwt.sign(
    { sub: 'user-1', email: 'user@test.com', roles },
    'test-jwt-secret-for-tests-only',
    { expiresIn: '15m' },
  );
}

const doctorToken = makeToken(['doctor']);
const patientToken = makeToken(['patient']);

describe('GET /api/doctors', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/doctors');
    expect(res.status).toBe(401);
  });

  it('returns 200 when authenticated', async () => {
    mockDocService.listDoctors.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const res = await request(app).get('/api/doctors').set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
  });

  it('passes specialization filter to service', async () => {
    mockDocService.listDoctors.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    await request(app)
      .get('/api/doctors?specialization=Cardiology')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(mockDocService.listDoctors).toHaveBeenCalledWith(
      expect.objectContaining({ specialization: 'Cardiology' }),
    );
  });
});

describe('GET /api/doctors/:id', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/doctors/doctor-1');
    expect(res.status).toBe(401);
  });

  it('returns 200 for a valid doctor ID when authenticated', async () => {
    mockDocService.getDoctorById.mockResolvedValue({ id: 'doctor-1' } as never);
    const res = await request(app)
      .get('/api/doctors/doctor-1')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when service throws a 404 AppError', async () => {
    const { AppError } = require('../../../shared/types');
    mockDocService.getDoctorById.mockRejectedValue(new AppError('Doctor not found', 404));
    const res = await request(app)
      .get('/api/doctors/unknown')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/doctors/:id', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).put('/api/doctors/doctor-1').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/doctors/:id/slots', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/doctors/doctor-1/slots').query({ date: '2025-06-15' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with slots when authenticated', async () => {
    mockDocService.getAvailableSlots.mockResolvedValue([{ startTime: '09:00', endTime: '09:30' }] as never);
    const res = await request(app)
      .get('/api/doctors/doctor-1/slots')
      .set('Authorization', `Bearer ${patientToken}`)
      .query({ date: '2025-06-15' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/doctors/:id/reviews', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/doctors/doctor-1/reviews')
      .send({ appointmentId: 'appt-1', rating: 5 });
    expect(res.status).toBe(401);
  });
});
