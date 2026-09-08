import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

/**
 * Usage: router.get('/admin-only', authMiddleware, requireRole('ADMIN'), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}
