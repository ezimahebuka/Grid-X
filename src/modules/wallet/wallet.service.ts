import {
  createCipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { env } from "../../config/env";
import { AppError } from "../../common/utils/app-error";
import { CardTopupInput, InitializeTopupInput } from "./wallet.schema";

const REQUEST_TIMEOUT_MS = 15_000;
const KORAPAY_PROVIDER = "KORAPAY";

type KorapayResponse = {
  status?: boolean | string;
  message?: string;
  data?: {
    reference?: string;
    checkout_url?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type KorapayChargeResponse = {
  status?: boolean | string;
  message?: string;
  data?: {
    reference?: string;
    payment_reference?: string;
    amount?: number | string;
    amount_paid?: number | string;
    currency?: string;
    status?: string;
    response_message?: string;
    auth_model?: string;
    authorization?: Record<string, unknown>;
    transaction_reference?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type KorapayCardResponse = KorapayChargeResponse;

type KorapayWebhook = {
  event?: string;
  data?: {
    reference?: string;
    payment_reference?: string;
    currency?: string;
    amount?: number | string;
    status?: string;
    transaction_status?: string;
    [key: string]: unknown;
  };
};

export async function getWalletBalance(userId: string) {
  const wallet = await prisma.wallet.upsert({
    where: { userId },
    create: { userId, balanceKobo: 0 },
    update: {},
  });

  return {
    balance: wallet.balanceKobo / 100,
    currency: "NGN",
  };
}

export async function getWalletActivity(userId: string, limit = 10) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  if (!wallet) {
    return [];
  }

  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    amount: Math.abs(transaction.amountKobo) / 100,
    direction: transaction.amountKobo >= 0 ? "credit" : "debit",
    currency: "NGN",
    provider: transaction.provider,
    status: transaction.status.toLowerCase(),
    reference: transaction.reference,
    created_at: transaction.createdAt,
  }));
}

export async function initializeWalletTopup(
  userId: string,
  input: InitializeTopupInput,
) {
  if (!env.KORAPAY_WEBHOOK_URL) {
    throw new AppError("KORAPAY_WEBHOOK_URL is not configured", 503);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) {
    throw new AppError("A verified email is required to fund your wallet", 400);
  }

  await prisma.wallet.upsert({
    where: { userId },
    create: { userId, balanceKobo: 0 },
    update: {},
  });

  const reference = `KPY-WALLET-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  await prisma.walletTopup.create({
    data: {
      userId,
      reference,
      amountKobo: input.amount * 100,
      status: "PENDING",
    },
  });

  const providerPayload = {
    amount: input.amount,
    currency: "NGN",
    reference,
    customer: {
      name: user.fullName,
      email: user.email,
    },
    notification_url: env.KORAPAY_WEBHOOK_URL,
    ...(input.redirect_url ? { redirect_url: input.redirect_url } : {}),
    narration: "Grid X wallet funding",
    metadata: {
      userId,
      walletTopup: reference,
    },
  };

  try {
    const result = await callKorapay(providerPayload);
    const checkoutUrl = result.data?.checkout_url;

    if (!checkoutUrl) {
      throw new AppError("Korapay did not return a checkout URL", 502);
    }

    await prisma.walletTopup.update({
      where: { reference },
      data: { providerData: toJson(result) },
    });

    return {
      reference,
      amount: input.amount,
      currency: "NGN",
      checkout_url: checkoutUrl,
    };
  } catch (error) {
    await prisma.walletTopup.update({
      where: { reference },
      data: {
        status: "FAILED",
        providerData:
          error instanceof AppError ? { message: error.message } : undefined,
      },
    });
    throw error;
  }
}

export async function chargeWalletTopupWithCard(
  userId: string,
  input: CardTopupInput,
) {
  if (!env.KORAPAY_ENCRYPTION_KEY) {
    throw new AppError("KORAPAY_ENCRYPTION_KEY is not configured", 503);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) {
    throw new AppError("A verified email is required to fund your wallet", 400);
  }

  const reference = `KPY-CARD-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${randomUUID().replace(/-/g, "").slice(0, 16)}`;

  await prisma.walletTopup.create({
    data: {
      userId,
      reference,
      amountKobo: input.amount * 100,
      status: "PENDING",
    },
  });

  const paymentData = JSON.stringify({
    reference,
    card: input.card,
    amount: input.amount,
    currency: "NGN",
    ...(input.redirect_url ? { redirect_url: input.redirect_url } : {}),
    customer: { name: user.fullName, email: user.email },
    metadata: { userId, walletTopup: reference },
  });

  try {
    const result = await chargeKorapayCard(encryptCardPayload(paymentData));
    const status = result.data?.status?.toLowerCase();

    await prisma.walletTopup.update({
      where: { reference },
      data: { providerData: toJson(result) },
    });

    if (status === "success") {
      const verified = await verifyKorapayCharge(reference);
      if (isSuccessfulCharge(verified.data, input.amount)) {
        await creditWalletTopup(reference, verified);
        return { reference, status: "success", credited: true };
      }
    }

    if (status === "failed") {
      await prisma.walletTopup.update({
        where: { reference },
        data: { status: "FAILED" },
      });
    }

    return {
      reference,
      status: status ?? "processing",
      credited: false,
      message: result.message,
      response_message: result.data?.response_message,
      payment_reference: result.data?.payment_reference,
      auth_model: result.data?.auth_model,
      authorization: result.data?.authorization,
      transaction_reference: result.data?.transaction_reference,
    };
  } catch (error) {
    await prisma.walletTopup.update({
      where: { reference },
      data: {
        status: "FAILED",
        providerData:
          error instanceof AppError ? { message: error.message } : undefined,
      },
    });
    throw error;
  }
}

export async function getWalletTopup(userId: string, reference: string) {
  const topup = await prisma.walletTopup.findUnique({ where: { reference } });

  if (!topup || topup.userId !== userId) {
    throw new AppError("Wallet top-up not found", 404);
  }

  return {
    reference: topup.reference,
    amount: topup.amountKobo / 100,
    currency: "NGN",
    status: topup.status.toLowerCase(),
    credited_at: topup.creditedAt,
  };
}

export async function verifyWalletTopup(userId: string, reference: string) {
  const topup = await prisma.walletTopup.findUnique({ where: { reference } });

  if (!topup || topup.userId !== userId) {
    throw new AppError("Wallet top-up not found", 404);
  }

  const result = await verifyKorapayCharge(reference);
  const charge = result.data;
  const paidAmount = Number(charge?.amount_paid ?? charge?.amount);

  if (!isSuccessfulCharge(charge, topup.amountKobo / 100)) {
    return {
      reference,
      status: charge?.status?.toLowerCase() ?? "pending",
      credited: Boolean(topup.creditedAt),
    };
  }

  await creditWalletTopup(reference, result);

  return {
    reference,
    status: "success",
    credited: true,
  };
}

function isSuccessfulCharge(
  charge: KorapayChargeResponse["data"],
  expectedAmount: number,
) {
  const paidAmount = Number(charge?.amount_paid ?? charge?.amount);
  return (
    charge?.status === "success" &&
    charge.currency === "NGN" &&
    paidAmount === expectedAmount
  );
}

export async function processKorapayWebhook(
  payload: KorapayWebhook,
  signature: string | undefined,
) {
  if (
    !signature ||
    !payload.data ||
    !isValidSignature(payload.data, signature)
  ) {
    return { received: true, processed: false };
  }

  if (payload.event !== "charge.success") {
    return { received: true, processed: false };
  }

  const data = payload.data;
  const reference = data.payment_reference ?? data.reference;
  const paidAmount = Number(data.amount);

  if (
    !reference ||
    data.currency !== "NGN" ||
    data.status !== "success" ||
    data.transaction_status === "underpaid" ||
    !Number.isFinite(paidAmount)
  ) {
    return { received: true, processed: false };
  }

  const topup = await prisma.walletTopup.findUnique({
    where: { reference },
  });

  if (!topup || paidAmount !== topup.amountKobo / 100) {
    return { received: true, processed: false };
  }

  await creditWalletTopup(reference, payload);

  return { received: true, processed: true, reference };
}

async function creditWalletTopup(reference: string, providerData: unknown) {
  await prisma.$transaction(async (transaction) => {
    const currentTopup = await transaction.walletTopup.findUnique({
      where: { reference },
    });

    if (!currentTopup || currentTopup.creditedAt) {
      return;
    }

    const wallet = await transaction.wallet.upsert({
      where: { userId: currentTopup.userId },
      create: {
        userId: currentTopup.userId,
        balanceKobo: currentTopup.amountKobo,
      },
      update: { balanceKobo: { increment: currentTopup.amountKobo } },
    });

    await transaction.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amountKobo: currentTopup.amountKobo,
        provider: KORAPAY_PROVIDER,
        status: "SUCCESS",
        reference: `${currentTopup.reference}:credit`,
      },
    });

    await transaction.walletTopup.update({
      where: { reference },
      data: {
        status: "COMPLETED",
        creditedAt: new Date(),
        providerData: toJson(providerData),
      },
    });
  });
}

function isValidSignature(
  data: NonNullable<KorapayWebhook["data"]>,
  signature: string,
) {
  const expected = createHmac("sha256", env.KORAPAY_SECRET_KEY)
    .update(JSON.stringify(data))
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

async function callKorapay(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${env.KORAPAY_API_BASE_URL}/charges/initialize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.KORAPAY_SECRET_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
    const result = (await response.json()) as KorapayResponse;

    if (!response.ok || result.status !== true) {
      throw new AppError(
        result.message ?? "Korapay payment initialization failed",
        response.status >= 500 ? 502 : 400,
      );
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Korapay request timed out", 504);
    }
    throw new AppError("Unable to reach Korapay", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyKorapayCharge(reference: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${env.KORAPAY_API_BASE_URL}/charges/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${env.KORAPAY_SECRET_KEY}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );
    const result = (await response.json()) as KorapayChargeResponse;

    if (!response.ok || result.status !== true) {
      throw new AppError(
        result.message ?? "Korapay payment verification failed",
        response.status >= 500 ? 502 : 400,
      );
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Korapay verification timed out", 504);
    }
    throw new AppError("Unable to verify payment with Korapay", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function encryptCardPayload(payload: string) {
  const key = Buffer.from(env.KORAPAY_ENCRYPTION_KEY!, "utf8");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("hex"),
    encrypted.toString("hex"),
    cipher.getAuthTag().toString("hex"),
  ].join(":");
}

async function chargeKorapayCard(chargeData: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.KORAPAY_API_BASE_URL}/charges/card`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.KORAPAY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ charge_data: chargeData }),
      signal: controller.signal,
    });
    const result = (await response.json()) as KorapayCardResponse;

    if (!response.ok || result.status !== true) {
      throw new AppError(
        result.message ?? "Korapay card payment failed",
        response.status >= 500 ? 502 : 400,
      );
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Korapay card payment timed out", 504);
    }
    throw new AppError("Unable to reach Korapay", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
