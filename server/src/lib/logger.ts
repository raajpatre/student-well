import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      'password',
      '*.password',
      'body.password',
      'req.body.password',
      'token',
      '*.token',
      'authorization',
      'headers.authorization',
      'req.headers.authorization',
      'phone',
      '*.phone',
      'body.phone',
      'email',
      '*.email',
      'body.email',
      'content',
      '*.content',
      'body.content',
      'message.content',
    ],
    censor: '[REDACTED]',
  },
});
