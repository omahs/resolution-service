import BaseError from '../../errors/BaseError';
import { Blockchain } from '../../types/common';

// Public worker error to be thrown from worker strategies
export class WorkerError extends BaseError {
  constructor(blockchain: Blockchain, message: string, cause?: Error) {
    super(`WorkerError[${blockchain}]: ${message}`, cause);
  }
}

// Internal error class for the base worker
export class BaseWorkerError extends BaseError {
  constructor(blockchain: Blockchain, message: string, cause?: Error) {
    super(`BaseWorkerError[${blockchain}]: ${message}`, cause);
  }
}
