import { Request, Response } from "express";
import { AppError } from "../../common/utils/app-error";
import { handleVtpassWebhook, purchaseBill } from "./bills.service";

export async function purchaseAirtime(req: Request, res: Response) {
  res
    .status(200)
    .json(await purchaseBill(requireUser(req), "airtime", req.body));
}

export async function purchaseData(req: Request, res: Response) {
  res.status(200).json(await purchaseBill(requireUser(req), "data", req.body));
}

export async function purchaseTv(req: Request, res: Response) {
  res.status(200).json(await purchaseBill(requireUser(req), "tv", req.body));
}

export async function purchaseElectricity(req: Request, res: Response) {
  res
    .status(200)
    .json(await purchaseBill(requireUser(req), "electricity", req.body));
}

export async function purchaseEducation(req: Request, res: Response) {
  res
    .status(200)
    .json(await purchaseBill(requireUser(req), "education", req.body));
}

export async function purchaseInsurance(req: Request, res: Response) {
  res
    .status(200)
    .json(await purchaseBill(requireUser(req), "insurance", req.body));
}

export async function vtpassWebhook(req: Request, res: Response) {
  const result = await handleVtpassWebhook(req.body);
  res.status(200).json(result);
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }
  return req.user.id;
}
