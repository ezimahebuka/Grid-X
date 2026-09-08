import { z } from "zod";

const phone = z.string().regex(/^0\d{10}$/, "Phone must be 11 digits");
const amount = z.coerce.number().positive().finite();

const commonPurchaseFields = {
  serviceID: z.string().min(1),
  amount,
  phone,
  request_id: z.string().min(8).max(100).optional(),
};

export const airtimeSchema = z.object({
  body: z.object(commonPurchaseFields),
});

export const dataSchema = z.object({
  body: z.object({
    ...commonPurchaseFields,
    billersCode: phone,
    variation_code: z.string().min(1),
  }),
});

export const tvSchema = z.object({
  body: z.object({
    ...commonPurchaseFields,
    billersCode: z.string().min(1),
    variation_code: z.string().min(1),
  }),
});

export const electricitySchema = z.object({
  body: z.object({
    ...commonPurchaseFields,
    billersCode: z.string().min(1),
    variation_code: z.enum(["prepaid", "postpaid"]),
  }),
});

export const educationSchema = z.object({
  body: z.object({
    ...commonPurchaseFields,
    billersCode: z.string().min(1).optional(),
    variation_code: z.string().min(1).optional(),
  }),
});

export const insuranceSchema = z.object({
  body: z.object({
    ...commonPurchaseFields,
    billersCode: z.string().min(1).optional(),
    variation_code: z.string().min(1).optional(),
  }),
});

export type BillPurchaseInput =
  | z.infer<typeof airtimeSchema>["body"]
  | z.infer<typeof dataSchema>["body"]
  | z.infer<typeof tvSchema>["body"]
  | z.infer<typeof electricitySchema>["body"]
  | z.infer<typeof educationSchema>["body"]
  | z.infer<typeof insuranceSchema>["body"];
