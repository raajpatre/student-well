import { z } from 'zod';

export const uuidSchema = z.uuid();
export const nonEmptyString = z.string().trim().min(1);
export const optionalText = z.string().trim().max(2000).optional().nullable();
export const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20);
