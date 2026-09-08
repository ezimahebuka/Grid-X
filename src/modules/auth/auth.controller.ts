import { Request, Response } from "express";
import {
  forgotPassword,
  loginUser,
  registerUser,
  resetPassword,
  verifyEmail,
  verifyResetCode,
} from "./auth.service";

export async function register(req: Request, res: Response) {
  const user = await registerUser(req.body);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response) {
  const { user, token } = await loginUser(req.body);
  res.setHeader("Authorization", `Bearer ${token}`);
  res.status(200).json({ user });
}

export async function verify(req: Request, res: Response) {
  const user = await verifyEmail(req.body);
  res.status(200).json({ message: "Email verified successfully", user });
}

export async function requestPasswordReset(req: Request, res: Response) {
  const result = await forgotPassword(req.body);
  res.status(200).json(result);
}

export async function verifyPasswordResetCode(req: Request, res: Response) {
  const result = await verifyResetCode(req.body);
  res.status(200).json(result);
}

export async function updatePassword(req: Request, res: Response) {
  const result = await resetPassword(req.body);
  res.status(200).json(result);
}
