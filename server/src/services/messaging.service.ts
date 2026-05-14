import { logger } from '../lib/logger';

export const sendRecoveryMessage = async (
  method: 'whatsapp' | 'sms',
  to: string,
  link: string,
  userName: string
) => {
  // In a real implementation, you would call WhatsApp Cloud API or Twilio API here.
  // For development, we log a redacted mock notification event.
  logger.info({ method, to, userName, token: link }, 'Mock recovery message sent');

  return { success: true };
};
