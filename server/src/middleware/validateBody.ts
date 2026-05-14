import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body ?? {});

    if (!parsed.success) {
      const errors = parsed.error.issues.map(issue => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      res.status(400).json({ error: 'Invalid request body', fields: errors });
      return;
    }

    req.body = parsed.data;
    next();
  };
};

export const formatZodError = (error: ZodError) => {
  return error.issues.map(issue => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
};
