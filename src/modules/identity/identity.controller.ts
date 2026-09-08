import { Request, Response } from "express";
import { AppError } from "../../common/utils/app-error";
import { verifyIdentity } from "./identity.service";

export async function verify(req: Request, res: Response) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }
  const result = await verifyIdentity(req.body);
  res.status(200).json({ message: "Identity verified successfully", result });
}
