import { Router } from "express";
import { asyncHandler } from "../../common/utils/async-handler";
import { validate } from "../../common/middlewares/validate.middleware";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyResetCodeSchema,
} from "./auth.schema";
import {
  login,
  register,
  requestPasswordReset,
  updatePassword,
  verify,
  verifyPasswordResetCode,
} from "./auth.controller";

const router = Router();

router.post("/register", validate(registerSchema), asyncHandler(register));
router.post("/login", validate(loginSchema), asyncHandler(login));
router.post("/verify-email", validate(verifyEmailSchema), asyncHandler(verify));
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncHandler(requestPasswordReset),
);
router.post(
  "/verify-reset-code",
  validate(verifyResetCodeSchema),
  asyncHandler(verifyPasswordResetCode),
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(updatePassword),
);

export default router;
