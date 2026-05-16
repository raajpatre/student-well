import { z } from 'zod';

const score = z.number().int().min(1).max(5);

export const submitCheckinSchema = z.object({
  emotional_score: score.optional(),
  sleep_score: score.optional(),
  academic_score: score.optional(),
  social_score: score.optional(),
  reflection_text: z.string().trim().min(1).max(2000).optional(),
}).strict().refine(
  body => Object.values(body).some(value => value !== undefined),
  { message: 'At least one score or a reflection is required' }
);
