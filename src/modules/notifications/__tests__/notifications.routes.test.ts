import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../index';
import { notificationsService } from '../notifications.service';

jest.mock('../notifications.service');
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

const mockNotifService = notificationsService as jest.Mocked<typeof notificationsService>;

function makeToken(roles: string[] = ['patient']) {
  return jwt.sign(
    { sub: 'user-1', email: 'user@test.com', roles },
    'test-jwt-secret-for-tests-only',
    { expiresIn: '15m' },
  );
}

const authToken = makeToken();

describe('GET /api/notifications', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns 200 with authenticated user', async () => {
    mockNotifService.getNotifications.mockResolvedValue({
      items: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      limit: 20,
    });
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('filters by valid type query param', async () => {
    mockNotifService.getNotifications.mockResolvedValue({
      items: [],
      total: 0,
      unreadCount: 0,
      page: 1,
      limit: 20,
    });
    const res = await request(app)
      .get('/api/notifications?type=appointment_booked')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(mockNotifService.getNotifications).toHaveBeenCalledWith(
      'user-1',
      'appointment_booked',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('returns 400 for an invalid type', async () => {
    const res = await request(app)
      .get('/api/notifications?type=invalid_type')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('is matched before /:id/read (critical route ordering test)', async () => {
    mockNotifService.markAllRead.mockResolvedValue(undefined);
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${authToken}`);
    // Must call markAllRead, not markRead with id='read-all'
    expect(res.status).toBe(200);
    expect(mockNotifService.markAllRead).toHaveBeenCalledWith('user-1');
    expect(mockNotifService.markRead).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).patch('/api/notifications/notif-1/read');
    expect(res.status).toBe(401);
  });

  it('calls markRead with the correct id', async () => {
    mockNotifService.markRead.mockResolvedValue(undefined);
    const res = await request(app)
      .patch('/api/notifications/notif-42/read')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(mockNotifService.markRead).toHaveBeenCalledWith('user-1', 'notif-42');
  });
});

describe('DELETE /api/notifications/:id', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).delete('/api/notifications/notif-1');
    expect(res.status).toBe(401);
  });

  it('returns 403 when deleting another user\'s notification', async () => {
    const { AppError } = require('../../../shared/types');
    mockNotifService.deleteNotification.mockRejectedValue(new AppError('Forbidden', 403));
    const res = await request(app)
      .delete('/api/notifications/notif-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful deletion', async () => {
    mockNotifService.deleteNotification.mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/api/notifications/notif-1')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});
