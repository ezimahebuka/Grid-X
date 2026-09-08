import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import type {} from "../types/express";

interface JwtPayload {
  id: string;
  role: "USER" | "ADMIN";
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;

  const [scheme, token] = header?.trim().split(/\s+/, 2) ?? [];

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    if (
      typeof payload.id !== "string" ||
      (payload.role !== "USER" && payload.role !== "ADMIN")
    ) {
      throw new Error("Invalid token payload");
    }

    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
