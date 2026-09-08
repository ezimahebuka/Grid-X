import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.client";
import { env } from "../../config/env";
import { AppError } from "../../common/utils/app-error";
import { BillPurchaseInput } from "./bills.schema";

const VTPASS_PROVIDER = "VTPASS";
const REQUEST_TIMEOUT_MS = 15_000;
const FAILED_CODES = new Set([
  "016",
  "091",
  "010",
  "011",
  "012",
  "013",
  "014",
  "017",
  "018",
  "019",
  "023",
  "024",
  "027",
  "028",
  "030",
  "034",
  "035",
  "083",
]);

type BillServiceType =
  | "airtime"
  | "data"
  | "tv"
  | "electricity"
  | "education"
  | "insurance";

type VtpassResult = {
  code?: string | number;
  response_description?: string;
  content?: {
    transactions?: {
      status?: string;
      transactionId?: string;
      product_name?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function purchaseBill(
  userId: string,
  serviceType: BillServiceType,
  input: BillPurchaseInput,
) {
  const requestId = input.request_id ?? createRequestId();
  const amountKobo = Math.round(input.amount * 100);

  const existingPayment = await prisma.billPayment.findUnique({
    where: { requestId },
  });

  if (existingPayment) {
    if (existingPayment.userId !== userId) {
      throw new AppError("Request ID already belongs to another user", 409);
    }
    return existingPayment;
  }

  const wallet = await prisma.wallet.upsert({
    where: { userId },
    create: { userId, balanceKobo: 0 },
    update: {},
  });

  if (wallet.balanceKobo < amountKobo) {
    throw new AppError("Insufficient wallet balance", 402);
  }

  const payment = await prisma.billPayment.create({
    data: {
      userId,
      requestId,
      serviceType,
      serviceId: input.serviceID,
      amountKobo,
      status: "INITIATED",
    },
  });

  const providerPayload = {
    ...input,
    request_id: requestId,
  };
  const result = await callVtpass(providerPayload);
  const status = getProviderStatus(result);
  const providerCode = getProviderCode(result);

  await prisma.billPayment.update({
    where: { id: payment.id },
    data: {
      status: status === "DELIVERED" ? "DELIVERED" : status,
      providerCode,
      providerData: toJson(result),
    },
  });

  if (status === "DELIVERED") {
    await debitDeliveredPayment(payment.id);
  }

  if (status === "FAILED") {
    throw new AppError(getProviderMessage(result), 400);
  }

  return {
    request_id: requestId,
    status: status.toLowerCase(),
    provider: result,
  };
}

export async function handleVtpassWebhook(result: VtpassResult) {
  const requestId = getRequestId(result);

  if (!requestId) {
    throw new AppError("Webhook request ID is required", 400);
  }

  const payment = await prisma.billPayment.findUnique({
    where: { requestId },
  });

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  const status = getProviderStatus(result);
  await prisma.billPayment.update({
    where: { id: payment.id },
    data: {
      status: status === "DELIVERED" ? "DELIVERED" : status,
      providerCode: getProviderCode(result),
      providerData: toJson(result),
    },
  });

  if (status === "DELIVERED") {
    await debitDeliveredPayment(payment.id);
  }

  return { request_id: requestId, status: status.toLowerCase() };
}

async function debitDeliveredPayment(paymentId: string) {
  await prisma.$transaction(async (transaction) => {
    const payment = await transaction.billPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.debitedAt) {
      return;
    }

    const wallet = await transaction.wallet.findUnique({
      where: { userId: payment.userId },
    });

    if (!wallet) {
      throw new AppError("User wallet not found", 500);
    }

    const walletUpdate = await transaction.wallet.updateMany({
      where: {
        userId: payment.userId,
        balanceKobo: { gte: payment.amountKobo },
      },
      data: { balanceKobo: { decrement: payment.amountKobo } },
    });

    if (walletUpdate.count !== 1) {
      await transaction.billPayment.update({
        where: { id: payment.id },
        data: { status: "DEBIT_PENDING" },
      });
      return;
    }

    await transaction.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amountKobo: -payment.amountKobo,
        provider: VTPASS_PROVIDER,
        status: "SUCCESS",
        reference: payment.requestId,
      },
    });

    await transaction.billPayment.update({
      where: { id: payment.id },
      data: { status: "COMPLETED", debitedAt: new Date() },
    });
  });
}

async function callVtpass(payload: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": env.VTPASS_API_KEY!,
      "secret-key": env.VTPASS_SECRET_KEY,
    };
    const response = await fetch(`${env.VTPASS_BASE_URL}/pay`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = (await response.json()) as VtpassResult;
    if (!response.ok) {
      throw new AppError(
        getProviderMessage(result),
        response.status >= 500 ? 502 : 400,
      );
    }
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("VTPass request timed out", 504);
    }
    throw new AppError("Unable to reach VTPass", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function createRequestId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${date}-${randomUUID()}`;
}

function getProviderCode(result: VtpassResult) {
  return result.code === undefined
    ? undefined
    : String(result.code).padStart(3, "0");
}

function getProviderStatus(result: VtpassResult) {
  const code = getProviderCode(result);
  const transactionStatus = result.content?.transactions?.status?.toLowerCase();

  if ((code && FAILED_CODES.has(code)) || transactionStatus === "failed")
    return "FAILED";
  if (code === "000" && transactionStatus === "delivered") return "DELIVERED";
  if (
    code === "000" &&
    (transactionStatus === "initiated" || transactionStatus === "pending")
  )
    return "PENDING";
  return "PENDING";
}

function getProviderMessage(result: VtpassResult) {
  return result.response_description ?? "VTPass payment failed";
}

function getRequestId(result: VtpassResult) {
  const transaction = result.content?.transactions;
  const requestId =
    result.requestId ??
    result.request_id ??
    transaction?.requestId ??
    transaction?.request_id;
  return typeof requestId === "string" ? requestId : undefined;
}

function toJson(result: VtpassResult): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
}
