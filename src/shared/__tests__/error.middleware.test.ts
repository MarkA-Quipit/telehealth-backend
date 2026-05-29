import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod/v4';
import { z } from 'zod/v4';
import { errorMiddleware } from '../middleware/error.middleware';
import { AppError } from '../types';

function makeRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

const req = {} as Request;
const next = jest.fn() as NextFunction;

describe('errorMiddleware', () => {
  it('returns correct statusCode and message for AppError', () => {
    const res = makeRes();
    errorMiddleware(new AppError('Conflict', 409), req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body).toEqual({ success: false, message: 'Conflict' });
  });

  it('includes errors array in AppError response when errors are provided', () => {
    const res = makeRes();
    errorMiddleware(new AppError('Validation', 400, ['field is required']), req, res, next);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.errors).toEqual(['field is required']);
  });

  it('returns 400 with field-level errors for ZodError', () => {
    const schema = z.object({ email: z.email() });
    let zodErr!: ZodError;
    try {
      schema.parse({ email: 'not-an-email' });
    } catch (err) {
      zodErr = err as ZodError;
    }

    const res = makeRes();
    errorMiddleware(zodErr, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.message).toBe('Validation error');
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors[0]).toHaveProperty('field');
    expect(body.errors[0]).toHaveProperty('message');
  });

  it('returns 500 for unknown errors', () => {
    const res = makeRes();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    errorMiddleware(new Error('Unexpected'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
    consoleErrorSpy.mockRestore();
  });

  it('does not include a stack trace in any error response body', () => {
    const res = makeRes();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    errorMiddleware(new Error('Unexpected'), req, res, next);
    const body = (res.status as jest.Mock).mock.results[0].value.json.mock.calls[0][0];
    expect(body).not.toHaveProperty('stack');
    consoleErrorSpy.mockRestore();
  });
});
