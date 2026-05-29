import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../middleware/auth.middleware';

jest.mock('../../modules/auth/auth.service', () => ({
  authService: {
    verifyToken: jest.fn((token: string) => {
      return jwt.verify(token, 'test-jwt-secret-for-tests-only') as {
        sub: string;
        email: string;
        roles: string[];
      };
    }),
  },
}));

function makeReqRes(headers: Record<string, string> = {}) {
  const req = {
    headers,
    user: undefined,
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

function makeToken(payload: object, secret = 'test-jwt-secret-for-tests-only') {
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

describe('authenticate middleware', () => {
  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = makeReqRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with "Bearer "', () => {
    const { req, res, next } = makeReqRes({ authorization: 'Basic abc123' });
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token signature is invalid', () => {
    const badToken = makeToken({ sub: 'u1', email: 'a@b.com', roles: ['patient'] }, 'wrong-secret');
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${badToken}` });
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token is expired', () => {
    const expiredToken = jwt.sign(
      { sub: 'u1', email: 'a@b.com', roles: ['patient'] },
      'test-jwt-secret-for-tests-only',
      { expiresIn: -1 },
    );
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${expiredToken}` });
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next() and sets req.user when token is valid', () => {
    const token = makeToken({ sub: 'user-1', email: 'pat@test.com', roles: ['patient'] });
    const { req, res, next } = makeReqRes({ authorization: `Bearer ${token}` });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as Request & { user: { id: string } }).user.id).toBe('user-1');
  });
});

describe('requireRole middleware', () => {
  function reqWithUser(roles: string[]) {
    return { user: { id: 'u1', email: 'a@b.com', roles } } as unknown as Request;
  }

  it('returns 403 when user does not have the required role', () => {
    const { res, next } = makeReqRes();
    const req = reqWithUser(['patient']);
    requireRole('doctor')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when req.user is undefined', () => {
    const { req, res, next } = makeReqRes();
    requireRole('doctor')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next() when user has the required role', () => {
    const { res, next } = makeReqRes();
    const req = reqWithUser(['doctor']);
    requireRole('doctor')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when any of multiple allowed roles match', () => {
    const { res, next } = makeReqRes();
    const req = reqWithUser(['patient']);
    requireRole('doctor', 'patient')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
