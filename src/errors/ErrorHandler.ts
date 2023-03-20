import { NextFunction, Request, Response } from 'express';
import {
  ExpressErrorMiddlewareInterface,
  HttpError,
  Middleware,
} from 'routing-controllers';
import { logger } from '../logger';

@Middleware({ type: 'after' })
export default class ErrorHandler implements ExpressErrorMiddlewareInterface {
  public error(
    error: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    const responseObject = {} as any;

    if (error instanceof HttpError && error.httpCode) {
      res.status(error.httpCode);
    } else {
      res.status(500);
    }
    // routing-controller errors has a self explanatory names such as BadRequest or NotFound which can be used as error code
    responseObject.code = error.name ? error.name : 'Error';

    const developmentMode: boolean = process.env.NODE_ENV === 'development';
    if (developmentMode) {
      // Add stack to the response only if in development
      responseObject.stack = error.stack;
    }
    responseObject.message = error.message ? error.message : '';
    if (error.name !== 'QueryFailedError') {
      responseObject.errors = error.errors ? error.errors : [error];
    }

    logger.error(error);
    res.json(responseObject);
  }
}
