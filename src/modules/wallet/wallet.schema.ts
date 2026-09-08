import { z } from "zod";

export const initializeTopupSchema = z.object({
  body: z.object({
    amount: z.coerce.number().int().min(100, "Minimum top-up is NGN 100"),
    redirect_url: z.string().url().optional(),
  }),
});

export const walletActivitySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const cardTopupSchema = z.object({
  body: z.object({
    amount: z.coerce.number().int().min(100, "Minimum top-up is NGN 100"),
    redirect_url: z.string().url().optional(),
    card: z.object({
      name: z.string().trim().min(2).optional(),
      number: z.string().regex(/^\d{12,19}$/, "Invalid card number"),
      cvv: z.string().regex(/^\d{3,4}$/, "Invalid CVV"),
      expiry_month: z
        .string()
        .regex(/^(0[1-9]|1[0-2])$/, "Invalid expiry month"),
      expiry_year: z.string().regex(/^\d{2}$/, "Invalid expiry year"),
      pin: z
        .string()
        .regex(/^\d{4}$/, "Invalid card PIN")
        .optional(),
    }),
  }),
});

export type InitializeTopupInput = z.infer<
  typeof initializeTopupSchema
>["body"];

export type CardTopupInput = z.infer<typeof cardTopupSchema>["body"];
