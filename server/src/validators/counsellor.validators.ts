import { z } from 'zod';

export const counsellorStatusSchema = z.object({
  status: z.enum(['contacted', 'ongoing', 'resolved', 'escalated']),
  note: z.string().trim().max(2000).optional().default(''),
  resolution_note: z.string().trim().max(2000).optional(),
}).strict();

export const profileEditRequestSchema = z.object({
  requested_changes: z.record(z.string(), z.unknown()).refine(
    value => Object.keys(value).length > 0,
    { message: 'At least one requested change is required' }
  ),
}).strict();
