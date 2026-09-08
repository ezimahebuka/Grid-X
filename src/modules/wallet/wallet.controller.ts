import { Request, Response } from "express";
import { AppError } from "../../common/utils/app-error";
import {
  getWalletBalance,
  getWalletActivity,
  getWalletTopup,
  chargeWalletTopupWithCard,
  initializeWalletTopup,
  processKorapayWebhook,
  verifyWalletTopup,
} from "./wallet.service";

export async function walletBalance(req: Request, res: Response) {
  res.status(200).json({ data: await getWalletBalance(requireUser(req)) });
}

export async function walletActivity(req: Request, res: Response) {
  res.status(200).json({
    data: await getWalletActivity(
      requireUser(req),
      Number(req.query.limit ?? 10),
    ),
  });
}

export async function initializeTopup(req: Request, res: Response) {
  res.status(201).json({
    message: "Wallet top-up initialized",
    data: await initializeWalletTopup(requireUser(req), req.body),
  });
}

export async function cardTopup(req: Request, res: Response) {
  const data = await chargeWalletTopupWithCard(requireUser(req), req.body);

  res.status(data.status === "failed" ? 402 : 201).json({
    message:
      data.status === "failed"
        ? (data.response_message ?? data.message ?? "Card payment failed")
        : "Card top-up submitted",
    data,
  });
}

export async function topupStatus(req: Request, res: Response) {
  res.status(200).json({
    data: await getWalletTopup(requireUser(req), req.params.reference),
  });
}

export async function verifyTopup(req: Request, res: Response) {
  res.status(200).json({
    data: await verifyWalletTopup(requireUser(req), req.params.reference),
  });
}

export async function korapayWebhook(req: Request, res: Response) {
  const result = await processKorapayWebhook(
    req.body,
    req.header("x-korapay-signature"),
  );
  res.status(200).json(result);
}

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }
  return req.user.id;
}
