import nodemailer from 'nodemailer';
import { logger } from '../lib/logger';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

function getTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export const sendActivationEmail = async (to: string, userName: string, activationLink: string) => {
  const transport = getTransport();

  if (!transport) {
    logger.warn({ to, userName, activationLink }, 'SMTP not configured — activation link logged here');
    return { success: false };
  }

  try {
    await transport.sendMail({
      from: `"StudentWell" <${SMTP_FROM}>`,
      to,
      subject: 'Activate your StudentWell account',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-weight:300;color:#2d4a3e;margin-bottom:8px">Welcome to StudentWell</h2>
          <p style="color:#555;margin-bottom:24px">Hi ${userName}, your account has been created. Click below to set your password and activate your account.</p>
          <a href="${activationLink}"
             style="display:inline-block;background:#4a7c6b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">
            Activate my account
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">This link expires in 7 days. If you didn't expect this email, ignore it.</p>
        </div>
      `,
    });
    logger.info({ to, userName }, 'Activation email sent');
    return { success: true };
  } catch (err) {
    logger.error({ err, to }, 'Failed to send activation email');
    return { success: false };
  }
};

export const sendPasswordResetEmail = async (to: string, userName: string, resetLink: string) => {
  const transport = getTransport();

  if (!transport) {
    logger.warn({ to, userName, resetLink }, 'SMTP not configured — reset link logged here');
    return { success: false };
  }

  try {
    await transport.sendMail({
      from: `"StudentWell" <${SMTP_FROM}>`,
      to,
      subject: 'Set your StudentWell password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-weight:300;color:#2d4a3e;margin-bottom:8px">Set your password</h2>
          <p style="color:#555;margin-bottom:24px">Hi ${userName}, click below to set a password for your StudentWell account.</p>
          <a href="${resetLink}"
             style="display:inline-block;background:#4a7c6b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px">
            Set my password
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">If you didn't expect this email, ignore it.</p>
        </div>
      `,
    });
    logger.info({ to, userName }, 'Password reset email sent');
    return { success: true };
  } catch (err) {
    logger.error({ err, to }, 'Failed to send password reset email');
    return { success: false };
  }
};

// Kept for backward compatibility with counsellor creation
export const sendRecoveryMessage = async (
  _method: 'whatsapp' | 'sms',
  to: string,
  link: string,
  userName: string
) => {
  return sendPasswordResetEmail(to, userName, link);
};
