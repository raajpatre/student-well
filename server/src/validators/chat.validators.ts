import { z } from 'zod';
import { uuidSchema } from './common';

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  session_id: uuidSchema.optional().nullable(),
}).strict();

export const shareSessionSchema = z.object({}).strict();
