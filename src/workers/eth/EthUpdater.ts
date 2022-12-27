import { logger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { Blockchain } from '../../types/common';
import { EthUpdaterConfig } from '../../env';
import { BaseWorker } from '../workerFramework/BaseWorker';
import { UNSWorkerStrategy } from './UnsWorker';
import { Block, IWorkerStrategy } from '../workerFramework';

export class EthUpdater {
  blockchain: Blockchain;
  config: EthUpdaterConfig;
  networkId: number;

  constructor(blockchain: Blockchain, config: EthUpdaterConfig) {
    this.config = config;
    this.blockchain = blockchain;
    this.networkId = config.NETWORK_ID;
  }

  public run(): Promise<void> {
    const strategy = new UNSWorkerStrategy(this.blockchain, this.config);
    return new BaseWorker(this.config, this.blockchain, strategy).run();
  }

  public resync(): Promise<void> {
    const strategy = new UNSWorkerStrategy(this.blockchain, this.config);
    return new BaseWorker(this.config, this.blockchain, strategy).resync();
  }
}

export function startWorker(
  blockchain: Blockchain,
  config: EthUpdaterConfig,
): void {
  if (config.RESYNC_FROM !== undefined) {
    void new EthUpdater(blockchain, config).resync().then(() => {
      logger.info('Resync successful.');
    });
  } else {
    setIntervalAsync(async () => {
      try {
        await new EthUpdater(blockchain, config).run();
      } catch (error) {
        logger.error(error);
      }
    }, config.FETCH_INTERVAL);
  }
}
