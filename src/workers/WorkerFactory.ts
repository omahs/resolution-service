import { env, EthUpdaterConfig } from '../env';
import { Blockchain } from '../types/common';
import { UNSWorkerStrategy } from './eth/UnsWorkerStrategy';
import { BaseWorker, IWorker, WorkerConfig } from './framework';
import { RunOptions } from './WorkerRunner';
import { ZNSWorkerStrategy } from './zil/ZilWorkerStrategy';

// mapping of networks/nameservices to config objects
const evmConfigs = {
  [Blockchain.ETH]: env.APPLICATION.ETHEREUM,
  [Blockchain.MATIC]: env.APPLICATION.POLYGON,
};

// mapping of networks/nameservices to constructor closures
const strategyFactories = {
  [Blockchain.ETH]: () => {
    return new UNSWorkerStrategy(Blockchain.ETH, evmConfigs[Blockchain.ETH]);
  },
  [Blockchain.MATIC]: () => {
    return new UNSWorkerStrategy(
      Blockchain.MATIC,
      evmConfigs[Blockchain.MATIC],
    );
  },
  [Blockchain.ZIL]: () => {
    return new ZNSWorkerStrategy(env.APPLICATION.ZILLIQA.NETWORK_ID);
  },
};

function evmNetworkConfig(
  blockchain: Blockchain,
  config: EthUpdaterConfig,
): WorkerConfig {
  return {
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

// mapping of networks/nameservices to config generator closures
const workerConfigs = {
  [Blockchain.ETH]: () => {
    return evmNetworkConfig(Blockchain.ETH, evmConfigs[Blockchain.ETH]);
  },
  [Blockchain.MATIC]: () => {
    return evmNetworkConfig(Blockchain.MATIC, evmConfigs[Blockchain.MATIC]);
  },
  [Blockchain.ZIL]: () => {
    return {
      handleReorgs: false,
      blockFetchLimit: 25,
      eventsStartingBlock: 0,
      maxReorgSize: 0,
      networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
      blockchain: Blockchain.ZIL,
    };
  },
};

const fetchIntervals = {
  [Blockchain.ETH]: env.APPLICATION.ETHEREUM.FETCH_INTERVAL,
  [Blockchain.MATIC]: env.APPLICATION.POLYGON.FETCH_INTERVAL,
  [Blockchain.ZIL]: env.APPLICATION.ZILLIQA.FETCH_INTERVAL,
};

const resyncBlocks = {
  [Blockchain.ETH]: env.APPLICATION.ETHEREUM.RESYNC_FROM,
  [Blockchain.MATIC]: env.APPLICATION.POLYGON.RESYNC_FROM,
  [Blockchain.ZIL]: env.APPLICATION.ZILLIQA.RESYNC_FROM,
};

export function getWorker(blockchain: Blockchain): IWorker {
  return new BaseWorker(
    workerConfigs[blockchain](),
    strategyFactories[blockchain](),
  );
}

export function getRunnerOptions(blockchain: Blockchain): RunOptions {
  return {
    fetchInterval: fetchIntervals[blockchain],
    resyncFrom: resyncBlocks[blockchain],
  };
}
