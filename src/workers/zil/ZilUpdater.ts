import { logger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { env } from '../../env';
import { Blockchain } from '../../types/common';
import { BaseWorker, IWorker, WorkerConfig } from '../framework';
import { ZNSWorkerStrategy } from './ZilWorkerStrategy';

const runWorker = async (worker: IWorker): Promise<void> => {
  try {
    logger.info('ZilUpdater is pulling updates from Zilliqa');
    await worker.run();
  } catch (error) {
    logger.error('Failed to run the ZilWorker');
    logger.error(error);
  }
};

export default (): void => {
  const strategy = new ZNSWorkerStrategy(env.APPLICATION.ZILLIQA.NETWORK_ID);
  const workerConfig: WorkerConfig = {
    handleReorgs: false,
    blockFetchLimit: 25,
    eventsStartingBlock: 0,
    maxReorgSize: 0,
    networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
    blockchain: Blockchain.ZIL,
  };
  const worker = new BaseWorker(workerConfig, strategy);
  setIntervalAsync(async () => {
    await runWorker(worker);
  }, env.APPLICATION.ZILLIQA.FETCH_INTERVAL);
};
