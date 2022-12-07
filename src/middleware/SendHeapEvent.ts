import { Middleware, ExpressMiddlewareInterface } from 'routing-controllers';
import { Response, Request, NextFunction } from 'express';
import { HttpMethods } from '../types/common';
import { track } from '../utils/heap';
import { logger } from '../logger';

@Middleware({ type: 'after' })
export class SendHeapEvent implements ExpressMiddlewareInterface {
  async use(req: Request, res: Response, next: NextFunction) {
    switch (req.method) {
      case HttpMethods.GET:
        try {
          if (!res.locals.heapEventName) {
            throw new Error('No Heap Event Name was set in controller logic');
          }

          void track({
            identity: req.ip,
            eventName: res.locals.heapEventName,
            properties: {
              ...req.params,
              apiKey: req.apiKey?.apiKey,
              uri: req.originalUrl,
            },
          }).catch((error) => logger.error(error));
        } catch (error: any) {
          logger.error(error);
        }
        break;
      case HttpMethods.POST:
        break;
      default:
        break;
    }
    return next();
  }
}
