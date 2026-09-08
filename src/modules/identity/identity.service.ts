import { env } from "../../config/env";
import { AppError } from "../../common/utils/app-error";
import { VerifyIdentityInput } from "./identity.schema";

const KORAPAY_BASE_URL = env.KORAPAY_BASE_URL;
const REQUEST_TIMEOUT_MS = 15_000;

export async function verifyIdentity(input: VerifyIdentityInput) {
  const isNin = input.type === "NIN";
  const endpoint = `${KORAPAY_BASE_URL}/${isNin ? "nin" : "bvn"}`;
  const identityNumber = input.id ?? input.number;
  const payload = {
    id: identityNumber,
    verification_consent: true,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.KORAPAY_SECRET_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = (await response.json()) as unknown;

    if (!response.ok) {
      throw new AppError(
        getKorapayError(result),
        response.status >= 500 ? 502 : 400,
      );
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Identity verification provider timed out", 504);
    }

    throw new AppError("Unable to reach identity verification provider", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function getKorapayError(result: unknown) {
  if (typeof result === "object" && result !== null && "message" in result) {
    const message = (result as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Identity verification failed";
}
