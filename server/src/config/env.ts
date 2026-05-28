import dotenv from 'dotenv';
import { logger } from '../lib/logger';

dotenv.config();

const requiredEnvs = [
  'CLIENT_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'NODE_ENV'
] as const;

type RequiredEnv = typeof requiredEnvs[number];

const missingEnvs = requiredEnvs.filter((env) => !process.env[env]);

if (missingEnvs.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvs.join(', ')}`);
}

// Optional — needed only when WhatsApp is configured (Addition 3, not yet built)
if (!process.env.WHATSAPP_API_TOKEN) {
  logger.warn('WHATSAPP_API_TOKEN not set — WhatsApp notifications disabled');
}
if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
  logger.warn('WHATSAPP_PHONE_NUMBER_ID not set — WhatsApp notifications disabled');
}

export const env = {
  PORT: process.env.PORT,
  CLIENT_URL: process.env.CLIENT_URL as string,
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY as string,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY as string,
  WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
  JWT_SECRET: process.env.JWT_SECRET as string,
  NODE_ENV: process.env.NODE_ENV as string,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
};
