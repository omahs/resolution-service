#!/usr/bin/env node

import { Blockchain } from '../types/common';
import WorkerRunner from '../workers/WorkerRunner';
import { basename, resolve, join } from 'path';
import fs from 'fs';
import connect from '../database/connect';
import { logger } from '../logger';

// worker entrypoint
startWorker()
  .then(() => {
    logger.info('Done.');
  })
  .catch((err) => logger.error(err));

function findAllInFolder(name: string) {
  const resolvedDir = resolve(process.cwd() || '.');
  const realDir = fs.realpathSync.native(resolvedDir);
  const path = join(realDir, name);
  if (path) {
    return fs
      .readdirSync(path)
      .map((val) => ({ filename: val, path: join(path, val) }));
  } else {
    throw new Error(`Failed to load ${path}`);
  }
}

function importByPath(filePath: string, doDefault = false) {
  // If config file was found
  if (fs.existsSync(filePath)) {
    const fileName = basename(filePath);
    let userConfigModule: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      userConfigModule = doDefault
        ? require(filePath).default
        : require(filePath);

      return userConfigModule;
    } catch (err) {
      logger.error(`Failed to load ${fileName}`);
      throw err;
    }
  } else {
    logger.error(`File not found ${filePath}`);
  }
  return {};
}

function importUserModule(fileName: string) {
  const resolvedDir = resolve(process.cwd() || '.');
  const realDir = fs.realpathSync.native(resolvedDir);
  const path = join(realDir, fileName);

  return importByPath(path);
}

async function startWorker() {
  // parse cli args, maybe use a lib
  const args = process.argv.slice(2);
  const [command, ...params] = args;

  if (command !== 'start') {
    logger.error(`
        Invalid arguments.
        Usage: ud-worker <command> [options]
          Available commands:
            start [fetch interval] - starts the worker with fetch interval
        `);
    process.exit(1);
  }

  // allow to terminate process so it doesn't hang
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));

  // pull configs
  // move default config somewhere
  const defaultConfig = {
    handleReorgs: true,
    blockFetchLimit: 500,
    eventsStartingBlock: 0,
    maxReorgSize: 200,
    networkId: 1,
    blockchain: Blockchain.ETH,
  };

  // TODO: parse node env and and select an appropriate config, provide different config options (json, js, etc.)
  const configFileName = 'worker.config.js';
  const userConfigModule = importUserModule(configFileName);
  const workerConfigs =
    userConfigModule && userConfigModule.workers
      ? Object.keys(userConfigModule.workers).reduce(
          (configs, config) => ({
            ...configs,
            [config]: {
              ...defaultConfig,
              ...userConfigModule.workers[config],
            },
          }),
          {} as any,
        )
      : { default: defaultConfig };

  // setup workers
  const fetchInterval = Number.parseInt(params[0] || '1000'); // TODO: setup better args and store defaults somewhere
  const runner = new WorkerRunner();
  const workerModules = findAllInFolder('build/workers');
  for (const key in workerConfigs) {
    const config = workerConfigs[key];
    const module = workerModules.find((m) => m.filename.includes(key));
    if (module) {
      const userWorkerModule = importByPath(module.path, true);
      runner.addWorker(userWorkerModule(config), { fetchInterval });
    }
  }

  // run
  if (command === 'start') {
    return connect().then(() => {
      runner.run();
    });
  }
}
