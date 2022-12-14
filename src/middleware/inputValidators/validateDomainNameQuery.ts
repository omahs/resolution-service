import { Response, Request, NextFunction } from 'express';
import { InvalidInputError } from '../../errors/HttpErrors';
import { isSupportedTLD } from '../../utils/domain';

export function ValidateIsDomainNameParam(
  param: string,
  allowedSuffixes?: string[],
): (request: Request, response: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    let value = req.params[param].trim();
    if (!value) {
      throw new InvalidInputError('Empty input');
    }

    if (!value.includes('.')) {
      next();
      return;
    }

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

    if (!isSupportedTLD(value)) {
      throw new InvalidInputError('Unsupported TLD');
    }

    next();
  };
}
