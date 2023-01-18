import { Response, Request, NextFunction } from 'express';
import { ParsedQs } from 'qs';

import { HttpMethods } from '../types/common';
import {
  track,
  parseQueryParams,
  normalizeHeapProperties,
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
    trackingRequestBody: string[];
  },
) => {
  const {
    originalParams,
    originalQuery,
    trackingQueryParams,
    trackingRequestBody,
  } = originalRequestInfo;

  const requestBodyProperties: { [key: string]: string } = {};

  switch (req.method) {
    case HttpMethods.GET:
    case HttpMethods.POST:
      if (req.method === HttpMethods.POST && trackingRequestBody.length > 0) {
        trackingRequestBody.forEach((property: string) => {
          requestBodyProperties[property] = req.body[property];
        });
      }

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
              ? normalizeHeapProperties(res.locals.trackedResponseProperties)
              : undefined),
            ...normalizeHeapProperties(requestBodyProperties),
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
    default:
      break;
  }
};

export function AttachHeapTrackingMiddleware(options: {
  heapEventName: HeapEvents;
  trackingQueryParams?: string[];
  trackingRequestBody?: string[];
}): (request: Request, response: Response, next: NextFunction) => void {
  const {
    heapEventName,
    trackingQueryParams = [],
    trackingRequestBody = [],
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    res.locals.heapEventName = heapEventName;
    const originalParams = req.params;
    const originalQuery = req.query;
    req.on('close', () =>
      trackRequest(req, res, {
        originalParams,
        originalQuery,
        trackingQueryParams,
        trackingRequestBody,
      }),
    );
    next();
  };
}
