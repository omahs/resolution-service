import './apm';
import 'reflect-metadata';
import { api } from './api';
import { blockchainRunningModes, env } from './env';
import { logger } from './logger';

const runningMode = env.APPLICATION.RUNNING_MODE;
import connect from './database/connect';
import { Blockchains } from './types/common';
import { getRunnerOptions, getWorker } from './workers/WorkerFactory';
import WorkerRunner from './workers/WorkerRunner';

void connect().then(async () => {
  /**
   * Temporary disable snapshot feature until we implement chain reorg handling functionality.
   * Check the following story and PR for details:
   * - https://www.pivotaltracker.com/n/projects/2463706/stories/178945048
   * - https://github.com/unstoppabledomains/unstoppable-domains-website/pull/2908
   */

  // if (runningMode.includes('LOAD_SNAPSHOT')) {
  //   logger.info('Loading db snapshot');
  //   try {
  //     await loadSnapshot();
  //   } catch (error) {
  //     logger.error(error);
  //     process.exit(1);
  //   }
  //   logger.info('Db snapshot loaded');
  // }
  const runner: WorkerRunner = new WorkerRunner();

  for (const blockchain of Blockchains) {
    if (runningMode.includes(blockchainRunningModes[blockchain])) {
      runner.addWorker(getWorker(blockchain), getRunnerOptions(blockchain));
    }
  }

  runner.run();

  // We're running API on any case since we need to
  // expose status, readiness and health check endpoints even in workers mode
  api.listen(env.APPLICATION.PORT);
  logger.info(`API is enabled and running on port ${env.APPLICATION.PORT}`);
});
