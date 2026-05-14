import rateLimit from 'express-rate-limit';
import { logger } from '../lib/logger';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logger.warn({ ip: req.ip }, 'Login rate limit exceeded');
    res.status(options.statusCode).json(options.message);
  },
});

export const chatMessageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: req => req.user!.id,
  message: { error: "I'm a little busy right now — try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const checkinSubmitLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: req => req.user!.id,
  message: { error: 'Too many check-in submissions today' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const studentImportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: req => req.user!.id,
  message: { error: 'Too many imports, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const newtonSyncLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: req => req.user!.id,
  message: {
    error: 'You can sync manually up to 3 times per day. Automatic sync runs every Sunday night.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
