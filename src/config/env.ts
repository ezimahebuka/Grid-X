import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("9000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  KORAPAY_SECRET_KEY: z.string().min(1, "KORAPAY_SECRET_KEY is required"),
  KORAPAY_BASE_URL: z
    .string()
    .url("KORAPAY_BASE_URL must be a valid URL")
    .min(1, "KORAPAY_BASE_URL is required"),
  KORAPAY_API_BASE_URL: z
    .string()
    .url("KORAPAY_API_BASE_URL must be a valid URL")
    .default("https://api.korapay.com/merchant/api/v1"),
  KORAPAY_WEBHOOK_URL: z.string().url().optional(),
  KORAPAY_ENCRYPTION_KEY: z.string().length(32).optional(),

  // Third-party integrations — optional for now so Sprint 1 can boot without them,
  // but each provider's own service module should refuse to run without its keys.
  TUYA_CLIENT_ID: z.string().optional(),
  TUYA_CLIENT_SECRET: z.string().optional(),
  BUYPOWER_API_KEY: z.string().optional(),
  VTPASS_API_KEY: z.string().min(1, "VTPASS_API_KEY is required"),
  VTPASS_SECRET_KEY: z.string().min(1, "VTPASS_SECRET_KEY is required"),
  VTPASS_BASE_URL: z
    .string()
    .url("VTPASS_BASE_URL must be a valid URL")
    .default("https://vtpass.com/api"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  MONNIFY_API_KEY: z.string().optional(),
  MONNIFY_SECRET_KEY: z.string().optional(),
  TERMII_API_KEY: z.string().optional(),
  FCM_SERVER_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a bad/missing env var should crash the app on boot,
  // never surface as a confusing runtime error later.
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
