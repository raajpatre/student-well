import { z } from 'zod';
import { tagsSchema } from './common';

export const updatePreferencesSchema = z.object({
  checkin_day: z.union([
    z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
    z.number().int().min(0).max(6),
  ]).optional(),
  checkin_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Invalid check-in time').optional(),
  delivery_method: z.enum(['in_app', 'whatsapp', 'sms']).optional(),
  language: z.string().trim().min(2).max(12).optional(),
  notifications_enabled: z.boolean().optional(),
}).strict();

export const onboardingSchema = z.object({
  interest_tags: tagsSchema,
  delivery_preference: z.enum(['in_app', 'whatsapp', 'sms']).optional(),
  language: z.string().trim().min(2).max(12).optional(),
}).strict();
