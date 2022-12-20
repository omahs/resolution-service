import { IWorkerStrategy } from './IWorkerStrategy';
import { IProvider } from './IProvider';
import { IEvent } from './Types';

export abstract class IWorker {
  workerStrategy: IWorkerStrategy;
  config: IProvider;

  constructor(config: IProvider, workerStrategy: IWorkerStrategy) {
    this.config = config;
    this.workerStrategy = workerStrategy;
  }

  public abstract run(): Promise<void>;
  public abstract resync(): Promise<void>;
}
