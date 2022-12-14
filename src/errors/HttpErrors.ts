import { HttpError } from 'routing-controllers';

export class InvalidInputError extends HttpError {
  name: string;
  constructor(message: string) {
    super(400);
    this.name = 'InvalidInputError';
    this.message = message;
  }
}
