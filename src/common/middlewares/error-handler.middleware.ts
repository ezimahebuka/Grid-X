import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { AppError } from "../utils/app-error";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : "Internal server error";

  logger.error({ err, path: req.path, statusCode }, "Request error");

  res.status(statusCode).json({ message });
}
