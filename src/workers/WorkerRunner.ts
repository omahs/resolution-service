import { setIntervalAsync } from 'set-interval-async/dynamic';
import { logger } from '../logger';
import { IWorker } from './framework';

export type RunOptions = { resyncFrom?: number; fetchInterval?: number };

export default class WorkerRunner {
  workers: {
    worker: IWorker;
    options: RunOptions;
  }[];

  private runWorker(worker: IWorker, interval: number): void {
    setIntervalAsync(async () => {
      try {
        await worker.run();
      } catch (error) {
        logger.error(error);
      }
    }, interval);
  }

  public addWorker(worker: IWorker, options: RunOptions): void {
    this.workers.push({ worker, options });
  }

  public async resync(): Promise<void> {
    for (const worker of this.workers) {
      if (worker.options.resyncFrom) {
        await worker.worker.resync(worker.options.resyncFrom);
      }
    }
  }

  public run(): void {
    for (const worker of this.workers) {
      if (worker.options.fetchInterval) {
        this.runWorker(worker.worker, worker.options.fetchInterval);
      }
    }
  }
}
