import { HttpError } from 'routing-controllers';

export class InvalidInputError extends HttpError {
  name: string;
  constructor(message: string) {
    super(400);
    this.name = 'InvalidInputError';
    this.message = message;
  }
}

export class RpcProviderError extends HttpError {
  name: string;
  constructor(message: string, httpCode: number) {
    super(httpCode);
    this.name = 'RpcProviderError';
    this.message = message;
  }
}
