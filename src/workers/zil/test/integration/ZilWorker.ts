import { Blockchain } from '../../../../types/common';
import { env } from '../../../../env';
import { BaseWorker, WorkerConfig } from '../../../framework';
import { ZNSWorkerStrategy } from '../../ZilWorkerStrategy';

type ZilWorkerOptions = {
  perPage?: number;
};

// keep this for tests
export default class ZilWorker {
  worker: BaseWorker;

  constructor(options?: ZilWorkerOptions) {
    const strategy = new ZNSWorkerStrategy(
      env.APPLICATION.ZILLIQA.NETWORK_ID,
      options?.perPage,
    );
    const workerConfig: WorkerConfig = {
      handleReorgs: false,
      blockFetchLimit: options?.perPage || 25,
      eventsStartingBlock: 0,
      maxReorgSize: 0,
      networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
      blockchain: Blockchain.ZIL,
    };
    this.worker = new BaseWorker(workerConfig, strategy);
  }

  public run(): Promise<void> {
    return this.worker.run();
  }

  public get blockchain(): Blockchain {
    return this.worker.blockchain;
  }

  public get networkId(): number {
    return this.worker.networkId;
  }
}
