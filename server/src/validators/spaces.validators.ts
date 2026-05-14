import { z } from 'zod';

export const createSpacePostSchema = z.object({
  content: z.string().trim().min(1, 'Content is required').max(500, 'Content must be 500 characters or less'),
}).strict();

export const flagSpacePostSchema = z.object({}).strict();
