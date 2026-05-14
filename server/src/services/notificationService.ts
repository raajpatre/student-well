// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const sendWhatsApp = async (phone: string, message: string) => {
  if (!process.env.WHATSAPP_API_TOKEN) {
    logger.warn('WhatsApp not configured, skipping send');
    return false;
  }

  try {
    // MOCK: In a real app, this would call the WhatsApp Business API
    // e.g., fetch(`https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, ...)

    logger.info({ phone, message }, 'MOCK WHATSAPP API CALL');

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
  } catch (error) {
    logger.error({ err: error, phone }, 'Failed to send WhatsApp message');
    return false;
  }
};

export const sendInApp = async (
  userId: string,
  tenantId: string,
  message: string,
  type: string
) => {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      tenant_id: tenantId,
      type,
      message,
      is_read: false
    });

    if (error) {
      logger.error({ err: error, userId, type }, 'Failed to insert in-app notification');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ err: error, userId, type }, 'Exception while sending in-app notification');
    return false;
  }
};

export const notify = async (
  userId: string,
  tenantId: string,
  message: string,
  type: string,
  channel?: 'whatsapp' | 'in_app' | 'both'
) => {
  try {
    // 1. Get user phone and preference if not specified
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('phone, notification_preference')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      logger.error({ err: userErr, userId }, 'Failed to fetch user for notification routing');
      // Fallback to in-app if we can't find the user
      return sendInApp(userId, tenantId, message, type);
    }

    const preference = channel || user.notification_preference || 'whatsapp';

    let success = true;

    if (preference === 'whatsapp' || preference === 'both') {
      if (user.phone) {
        const waSuccess = await sendWhatsApp(user.phone, message);
        if (!waSuccess) {
          // Fallback to in-app if WhatsApp fails
          await sendInApp(userId, tenantId, message, type);
          success = false;
        }
      } else {
        // Fallback to in-app if no phone number
        await sendInApp(userId, tenantId, message, type);
        success = false;
      }
    }

    if (preference === 'in_app' || preference === 'both') {
      const inAppSuccess = await sendInApp(userId, tenantId, message, type);
      if (!inAppSuccess) success = false;
    }

    return success;
  } catch (error) {
    logger.error({ err: error, userId }, 'Exception in notification routing');
    return false;
  }
};

// Helper for broadcasting to all managers
export const notifyManagers = async (
  tenantId: string,
  message: string,
  type: string,
  channel?: 'whatsapp' | 'in_app' | 'both'
) => {
  try {
    const { data: managers, error } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'manager')
      .eq('is_active', true);

    if (error || !managers) return;

    for (const manager of managers) {
      await notify(manager.id, tenantId, message, type, channel);
    }
  } catch (error) {
    logger.error({ err: error, tenantId }, 'Exception while broadcasting to managers');
  }
};
