import { Response, Request, NextFunction } from 'express';
import { InvalidInputError } from '../../errors/HttpErrors';
import {
  isSupportedTLD,
  isValidDomainNameLabel,
  isValidToken,
} from '../../utils/domain';

export function ValidateAndTransformOnDomainNameOrToken(
  param: string,
  allowedSuffixes?: string[],
): (request: Request, response: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    let value = req.params[param].trim();

    if (!value) {
      throw new InvalidInputError('Empty input');
    }

    if (!value.includes('.')) {
      if (!isValidToken(value)) {
        throw new InvalidInputError('Invalid token');
      }
    } else {
      if (allowedSuffixes) {
        const matchedSuffix = allowedSuffixes.includes(
          value.split('.').pop() as string,
        )
          ? value.split('.').pop()
          : undefined;

        if (matchedSuffix) {
          value = value.substring(0, value.length - matchedSuffix.length - 1);
        }
      }

      if (!isSupportedTLD(value) || !isValidDomainNameLabel(value)) {
        throw new InvalidInputError('Unsupported TLD');
      }
    }

    req.params[param] = value;

    next();
  };
}

export function ValidateAndTransformOnDomainName(
  param: string,
): (request: Request, response: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const value = req.params[param].trim();

    if (!value) {
      throw new InvalidInputError('Empty input');
    }

    if (
      !value.includes('.') ||
      !isValidDomainNameLabel(value) ||
      !isSupportedTLD(value)
    ) {
      throw new InvalidInputError('Unsupported TLD');
    }

    req.params[param] = value;

    next();
  };
}
