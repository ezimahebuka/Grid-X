import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express does not automatically catch rejected promises in async route handlers —
 * an unhandled rejection here would crash the process instead of hitting error-handler.middleware.ts.
 * Wrap every controller function with this.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
