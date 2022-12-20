import { IWorker, IEvent } from '../workerFramework';
import { EthWorkerStrategy, EthProvider } from './EthWorkerStrategy';

export class EthBaseWorker extends IWorker {
  config: EthProvider;
  workerStrategy: EthWorkerStrategy;

  constructor(config: EthProvider, workerStrategy: EthWorkerStrategy) {
    super(config, workerStrategy);
  }

  public async run(): Promise<void> {}

  public async resync(): Promise<void> {}

  private async syncBlockRanges(): Promise<void> {}

  private async handleReOrge(): Promise<void> {}

  private async getEvents(): Promise<IEvent[]> {
    return [];
  }

  private async processEvents(events: IEvent[]): Promise<void> {}

  private async saveWorkerStatus(): Promise<void> {}
}
