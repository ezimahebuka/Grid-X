import { z } from "zod";

const strongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, "Full name is required"),
    phone: z.string().min(10, "Phone number is required"),
    email: z.string().email("A valid email address is required"),
    password: strongPasswordSchema,
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email address is required"),
    password: z.string().min(8, "Password is required"),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email address is required"),
    code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email address is required"),
  }),
});

export const verifyResetCodeSchema = z.object({
  body: z.object({
    email: z.string().email("A valid email address is required"),
    code: z.string().regex(/^\d{6}$/, "Reset code must be 6 digits"),
  }),
});

export const resetPasswordSchema = z
  .object({
    body: z.object({
      email: z.string().email("A valid email address is required"),
      code: z.string().regex(/^\d{6}$/, "Reset code must be 6 digits"),
      newPassword: strongPasswordSchema,
      confirmPassword: strongPasswordSchema,
    }),
  })
  .refine((value) => value.body.newPassword === value.body.confirmPassword, {
    path: ["body", "confirmPassword"],
    message: "Passwords do not match",
  });

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type VerifyResetCodeInput = z.infer<
  typeof verifyResetCodeSchema
>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
