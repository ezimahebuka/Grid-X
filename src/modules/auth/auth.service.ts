import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomInt } from "crypto";
import { prisma } from "../../database/prisma.client";
import { env } from "../../config/env";
import { AppError } from "../../common/utils/app-error";
import {
  isEmailConfigured,
  sendLoginNotification,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../common/services/email.service";
import { logger } from "../../common/utils/logger";
import {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
  VerifyResetCodeInput,
} from "./auth.schema";

const SALT_ROUNDS = 10;

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ phone: input.phone }, { email: input.email }] },
  });

  if (existing) {
    throw new AppError(
      "A user with this phone number or email already exists",
      409,
    );
  }

  if (!isEmailConfigured()) {
    throw new AppError("Email verification is not configured", 503);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const verificationCode = randomInt(100000, 1000000).toString();
  const verificationCodeHash = await bcrypt.hash(verificationCode, SALT_ROUNDS);
  const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      passwordHash,
      verificationCodeHash,
      verificationExpiresAt,
    },
  });

  // A wallet is created alongside every new user — every other module assumes it exists.
  await prisma.wallet.create({
    data: { userId: user.id, balanceKobo: 0 },
  });

  await sendVerificationEmail(
    input.email,
    input.fullName.split(" ")[0],
    verificationCode,
  );

  return sanitizeUser(user);
}

export async function verifyEmail(input: VerifyEmailInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (
    !user ||
    user.emailVerified ||
    !user.verificationCodeHash ||
    !user.verificationExpiresAt ||
    user.verificationExpiresAt < new Date() ||
    !(await bcrypt.compare(input.code, user.verificationCodeHash))
  ) {
    throw new AppError("Invalid or expired verification code", 400);
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verificationCodeHash: null,
      verificationExpiresAt: null,
    },
  });

  return sanitizeUser(verifiedUser);
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.emailVerified) {
    throw new AppError("Please verify your email before logging in", 403);
  }

  const isValidPassword = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  await sendSecurityNotification(
    () => sendLoginNotification(input.email, user.fullName.split(" ")[0]),
    "login",
  );

  return { user: sanitizeUser(user), token };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (user?.email && isEmailConfigured()) {
    const resetCode = randomInt(100000, 1000000).toString();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCodeHash: await bcrypt.hash(resetCode, SALT_ROUNDS),
        passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await sendPasswordResetEmail(
      user.email,
      user.fullName.split(" ")[0],
      resetCode,
    );
  }

  return {
    message: "If an account exists for that email, a reset code has been sent",
  };
}

async function getResetUser(input: VerifyResetCodeInput | ResetPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (
    !user?.passwordResetCodeHash ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt < new Date() ||
    !(await bcrypt.compare(input.code, user.passwordResetCodeHash))
  ) {
    throw new AppError("Invalid or expired reset code", 400);
  }
  return user;
}

export async function verifyResetCode(input: VerifyResetCodeInput) {
  await getResetUser(input);
  return { message: "Reset code verified successfully" };
}

export async function resetPassword(input: ResetPasswordInput) {
  const user = await getResetUser(input);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(input.newPassword, SALT_ROUNDS),
      passwordResetCodeHash: null,
      passwordResetExpiresAt: null,
    },
  });
  await sendSecurityNotification(
    () =>
      user.email
        ? sendPasswordChangedEmail(user.email, user.fullName.split(" ")[0])
        : Promise.resolve(),
    "password change",
  );
  return { message: "Password reset successfully" };
}

async function sendSecurityNotification(
  send: () => Promise<void>,
  event: string,
) {
  if (!isEmailConfigured()) {
    logger.warn(
      { event },
      "Security email notification skipped: SMTP is not configured",
    );
    return;
  }

  try {
    await send();
  } catch (error) {
    logger.error({ err: error, event }, "Security email notification failed");
  }
}

function sanitizeUser(user: {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
}) {
  // Never return passwordHash to the client.
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
  };
}
