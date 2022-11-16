import rateLimit, { Options } from 'express-rate-limit';
import type { Handler } from 'express';
import { env } from '../env';

export default (options?: Partial<Options>): Handler => {
  const opts = { ...options };

  // 'max': maximum number of requests within the window time
  opts.windowMs = opts.windowMs ?? env.APPLICATION.RATE_LIMITER.WINDOW_MS;
  opts.max = opts.max ?? env.APPLICATION.RATE_LIMITER.DEFAULT_MAX_REQUESTS;

  // rate limiting is disabled, so just make a passthrough middleware
  if (env.APPLICATION.RATE_LIMITER.RATE_LIMITER_DISABLED) {
    return (_req, res, next) => {
      if (typeof opts.max === 'number') {
        res.setHeader('X-Debug-RateLimit-Limit', opts.max);
      }
      res.setHeader('X-Debug-RateLimit-Time', opts.windowMs!);
      next();
    };
  }

  return rateLimit({
    ...opts,
  });
};
