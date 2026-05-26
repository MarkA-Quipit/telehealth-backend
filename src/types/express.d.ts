import type { JwtPayload } from "../modules/auth/auth.validators";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
