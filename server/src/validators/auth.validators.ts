import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Password is required'),
}).strict();

export const emptyBodySchema = z.object({}).strict();
