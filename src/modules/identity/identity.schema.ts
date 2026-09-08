import { z } from "zod";

export const verifyIdentitySchema = z
  .object({
    body: z.object({
      type: z.enum(["NIN", "BVN"]),
      id: z.string().min(1, "Identity number is required").optional(),
      number: z.string().min(1, "Identity number is required").optional(),
      verification_consent: z.literal(true).default(true),
    }),
  })
  .superRefine((value, context) => {
    const identityNumber = value.body.id ?? value.body.number;

    if (!identityNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "id"],
        message: "Identity number is required",
      });
      return;
    }

    if (value.body.type === "BVN" && !/^\d{11}$/.test(identityNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "id"],
        message: "BVN must be exactly 11 digits",
      });
    }

    if (value.body.type === "NIN" && !/^\d{11}$/.test(identityNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body", "id"],
        message: "NIN must be exactly 11 digits",
      });
    }
  });

export type VerifyIdentityInput = z.infer<typeof verifyIdentitySchema>["body"];
