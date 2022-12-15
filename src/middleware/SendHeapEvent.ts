import { Response, Request, NextFunction } from 'express';
import { ParsedQs } from 'qs';

import { HttpMethods } from '../types/common';
import {
  track,
  parseQueryParams,
  normalizeResponseProperties,
} from '../utils/heap';
import { logger } from '../logger';
import { HeapEvents } from '../types/heap';

const trackRequest = (
  req: Request,
  res: Response,
  originalRequestInfo: {
    // need to pass in the original params and query, express delete them after requests finished
    originalParams: any;
    originalQuery: any;
    trackingQueryParams: string[];
  },
) => {
  const { originalParams, originalQuery, trackingQueryParams } =
    originalRequestInfo;
  switch (req.method) {
    case HttpMethods.GET:
      try {
        if (!res.locals.heapEventName) {
          throw new Error('No Heap Event Name was set in controller logic');
        }

        const trackingQueries: ParsedQs = {};
        for (const query of trackingQueryParams) {
          if (Object.prototype.hasOwnProperty.call(originalQuery, query)) {
            trackingQueries[query] = originalQuery[query];
          }
        }

        void track({
          identity: req.ip,
          eventName: res.locals.heapEventName,
          properties: {
            ...(res.locals.trackedResponseProperties
              ? normalizeResponseProperties(
                  res.locals.trackedResponseProperties,
                )
              : undefined),
            ...parseQueryParams(trackingQueries),
            ...originalParams,
            apiKey: req.apiKey?.apiKey,
            uri: req.originalUrl,
            responseCode: res.statusCode,
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
};

export function AttachHeapTrackingMiddleware(
  heapEventName: HeapEvents,
  trackingQueryParams: string[] = [],
): (request: Request, response: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.heapEventName = heapEventName;
    const originalParams = req.params;
    const originalQuery = req.query;
    req.on('close', () =>
      trackRequest(req, res, {
        originalParams,
        originalQuery,
        trackingQueryParams,
      }),
    );
    next();
  };
}
