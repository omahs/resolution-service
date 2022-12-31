import { logger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { Blockchain } from '../../types/common';
import { EthUpdaterConfig } from '../../env';
import { BaseWorker } from '../workerFramework/BaseWorker';
import { UNSWorkerStrategy } from './UnsWorkerStrategy';
import { WorkerConfig } from '../workerFramework';

// Keep for legacy tests compatibility
export class EthUpdater {
  blockchain: Blockchain;
  config: EthUpdaterConfig;
  workerConfig: WorkerConfig;
  networkId: number;

  constructor(blockchain: Blockchain, config: EthUpdaterConfig) {
    this.config = config;
    this.blockchain = blockchain;
    this.networkId = config.NETWORK_ID;

    this.workerConfig = {
      handleReorgs: true,
      blockFetchLimit: config.BLOCK_FETCH_LIMIT,
      eventsStartingBlock: Math.min(
        config.UNS_REGISTRY_EVENTS_STARTING_BLOCK,
        config.CNS_REGISTRY_EVENTS_STARTING_BLOCK,
      ),
      maxReorgSize: config.MAX_REORG_SIZE,
      networkId: config.NETWORK_ID,
      blockchain: blockchain,
    };
  }

  public run(): Promise<void> {
    const strategy = new UNSWorkerStrategy(this.blockchain, this.config);
    return new BaseWorker(this.workerConfig, strategy).run();
  }

  public async resync(): Promise<void> {
    if (this.config.RESYNC_FROM !== undefined) {
      const strategy = new UNSWorkerStrategy(this.blockchain, this.config);
      await new BaseWorker(this.workerConfig, strategy).resync(
        this.config.RESYNC_FROM,
      );
    }
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
