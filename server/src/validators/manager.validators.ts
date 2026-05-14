import { z } from 'zod';
import { optionalText, tagsSchema, uuidSchema } from './common';

export const createCounsellorSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.email(),
  phone: z.string().trim().min(7).max(20).optional().nullable(),
  specialisation_tags: tagsSchema.optional().default([]),
  personality_description: z.string().trim().max(1000).optional().nullable(),
  capacity_limit: z.number().int().min(1).max(200).optional(),
}).strict();

export const updateCounsellorSchema = z.object({
  specialisation_tags: tagsSchema.optional(),
  personality_description: z.string().trim().max(1000).optional().nullable(),
  capacity_limit: z.number().int().min(1).max(200).optional(),
  is_on_leave: z.boolean().optional(),
}).strict().refine(
  body => Object.values(body).some(value => value !== undefined),
  { message: 'At least one update is required' }
);

export const createAssignmentSchema = z.object({
  student_id: uuidSchema,
  counsellor_id: uuidSchema,
  flag_id: uuidSchema,
  manager_note: optionalText,
}).strict();

export const reassignAssignmentSchema = z.object({
  new_counsellor_id: uuidSchema,
  reason: optionalText,
}).strict();

export const emptyImportBodySchema = z.object({}).passthrough();
export const emptyManagerBodySchema = z.object({}).strict();
