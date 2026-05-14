import { ErrorRequestHandler } from 'express';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error({
    err,
    req: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      headers: req.headers,
      body: req.body,
    },
  }, 'Unhandled request error');

  if (env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Something went wrong' });
    return;
  }

  res.status(500).json({
    error: err?.message || 'Something went wrong',
    stack: err?.stack,
  });
};
