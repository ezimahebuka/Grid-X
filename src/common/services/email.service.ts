import nodemailer from "nodemailer";
import { env } from "../../config/env";

const transporter =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      })
    : null;

export function isEmailConfigured() {
  return Boolean(transporter && env.EMAIL_FROM);
}

export async function sendVerificationEmail(
  recipient: string,
  firstName: string,
  verificationCode: string,
) {
  if (!transporter || !env.EMAIL_FROM) {
    throw new Error("Email service is not configured");
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: recipient,
    subject: `${verificationCode} is your Grid X verification code`,
    text: `Hi ${firstName}, your Grid X verification code is ${verificationCode}. It expires in 10 minutes. If you did not create an account, you can ignore this email.`,
    html: createVerificationEmail(firstName, verificationCode),
  });
}

export async function sendPasswordResetEmail(
  recipient: string,
  firstName: string,
  resetCode: string,
) {
  if (!transporter || !env.EMAIL_FROM) {
    throw new Error("Email service is not configured");
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: recipient,
    subject: `${resetCode} is your Grid X password reset code`,
    text: `Hi ${firstName}, your Grid X password reset code is ${resetCode}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: createPasswordResetEmail(firstName, resetCode),
  });
}

export async function sendLoginNotification(
  recipient: string,
  firstName: string,
) {
  if (!transporter || !env.EMAIL_FROM) {
    throw new Error("Email service is not configured");
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: recipient,
    subject: "New login to your Grid X account",
    text: `Hi ${firstName}, your Grid X account was just used to log in. If this was not you, reset your password immediately.`,
    html: createSecurityNotificationEmail(
      firstName,
      "New login detected",
      "Your Grid X account was just used to log in.",
      "If this was not you, reset your password immediately and contact support.",
    ),
  });
}

export async function sendPasswordChangedEmail(
  recipient: string,
  firstName: string,
) {
  if (!transporter || !env.EMAIL_FROM) {
    throw new Error("Email service is not configured");
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: recipient,
    subject: "Your Grid X password was changed",
    text: `Hi ${firstName}, your Grid X password was changed successfully. If this was not you, contact support immediately.`,
    html: createSecurityNotificationEmail(
      firstName,
      "Password changed",
      "Your Grid X password was changed successfully.",
      "If this was not you, contact support immediately.",
    ),
  });
}

function createVerificationEmail(firstName: string, verificationCode: string) {
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f5f8;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px;border-bottom:1px solid #edf0f4;">
          <div style="font-size:20px;font-weight:700;letter-spacing:.2px;color:#101a31;">Grid X</div>
          <div style="margin-top:5px;font-size:12px;color:#718096;">Smart energy, made clear.</div>
        </td></tr>
        <tr><td style="padding:36px 32px 30px;">
          <div style="font-size:14px;color:#60708a;">ACCOUNT SECURITY</div>
          <h1 style="margin:10px 0 14px;font-size:28px;line-height:1.2;color:#101a31;">Verify your email</h1>
          <p style="margin:0;font-size:16px;line-height:1.6;color:#4a586d;">Hi ${escapeHtml(firstName)}, use the verification code below to finish setting up your Grid X account.</p>
          <div style="margin:28px 0;padding:20px;text-align:center;background:#f5f7fb;border:1px solid #dce3ed;border-radius:8px;">
            <div style="font-size:12px;letter-spacing:1.8px;color:#718096;">YOUR CODE</div>
            <div style="margin-top:10px;font-size:34px;line-height:1;font-weight:700;letter-spacing:8px;color:#101a31;">${verificationCode}</div>
          </div>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#718096;">This code expires in <strong style="color:#4a586d;">10 minutes</strong>. For your security, never share it with anyone.</p>
          <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#718096;">If you did not create a Grid X account, no action is needed.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;background:#fafbfc;border-top:1px solid #edf0f4;font-size:12px;line-height:1.5;color:#8995a6;">This is an automated message from Grid X. Please do not reply to this email.</td></tr>
      </table>
    </div>
  </body>
</html>`;
}

function createPasswordResetEmail(firstName: string, resetCode: string) {
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f5f8;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:40px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #edf0f4;font-size:20px;font-weight:700;color:#101a31;">Grid X</td></tr>
      <tr><td style="padding:36px 32px 30px;"><div style="font-size:14px;color:#60708a;">ACCOUNT SECURITY</div>
        <h1 style="margin:10px 0 14px;font-size:28px;line-height:1.2;color:#101a31;">Reset your password</h1>
        <p style="margin:0;font-size:16px;line-height:1.6;color:#4a586d;">Hi ${escapeHtml(firstName)}, use the code below to create a new password.</p>
        <div style="margin:28px 0;padding:20px;text-align:center;background:#f5f7fb;border:1px solid #dce3ed;border-radius:8px;"><div style="font-size:12px;letter-spacing:1.8px;color:#718096;">RESET CODE</div><div style="margin-top:10px;font-size:34px;line-height:1;font-weight:700;letter-spacing:8px;color:#101a31;">${resetCode}</div></div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#718096;">This code expires in <strong style="color:#4a586d;">10 minutes</strong>. If you did not request a reset, you can ignore this email.</p>
      </td></tr>
    </table></div>
  </body>
</html>`;
}

function createSecurityNotificationEmail(
  firstName: string,
  heading: string,
  message: string,
  warning: string,
) {
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f5f8;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:40px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #edf0f4;font-size:20px;font-weight:700;color:#101a31;">Grid X</td></tr>
      <tr><td style="padding:36px 32px 30px;"><div style="font-size:14px;color:#60708a;">ACCOUNT SECURITY</div>
        <h1 style="margin:10px 0 14px;font-size:28px;line-height:1.2;color:#101a31;">${heading}</h1>
        <p style="margin:0;font-size:16px;line-height:1.6;color:#4a586d;">Hi ${escapeHtml(firstName)}, ${message}</p>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#718096;">${warning}</p>
      </td></tr>
    </table></div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}
