import {
  Middleware,
  ExpressMiddlewareInterface,
  ForbiddenError,
} from 'routing-controllers';
import { Response, Request, NextFunction } from 'express';
import { ApiKey } from '../models';

@Middleware({ type: 'before' })
export class ApiKeyAuthMiddleware implements ExpressMiddlewareInterface {
  static BearerKeyRegex = /^Bearer (.*)$/i;

  async use(req: Request, res: Response, next: NextFunction) {
    const providedKey = req.headers.authorization?.match(
      ApiKeyAuthMiddleware.BearerKeyRegex,
    );
    if (providedKey) {
      const apiKey = await ApiKey.queryApiKey(providedKey[1]);
      if (apiKey !== undefined) {
        req.apiKey = apiKey;
        return next();
      }
    }

    throw new ForbiddenError('Please provide a valid API key.');
  }
}
