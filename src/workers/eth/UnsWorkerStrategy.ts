import winston from 'winston';
import { WorkerLogger } from '../../logger';
import {
  Block,
  IWorkerStrategy,
  WorkerEvent,
  Domain,
  WorkerRepository,
  ReverseResolution,
  Resolution,
  getWorkerRepository,
  WorkerError,
} from '../framework';
import { Contract, Event, BigNumber } from 'ethers';
import { CryptoConfig, getEthConfig } from '../../contracts';
import { eip137Namehash } from '../../utils/namehash';
import {
  GetProviderForConfig,
  StaticJsonRpcProvider,
} from './EthereumProvider';
import { CnsResolverError } from '../../errors/CnsResolverError';
import { ExecutionRevertedError } from './BlockchainErrors';
import { CnsResolver } from './CnsResolver';
import { Blockchain, DomainOperationTypes } from '../../types/common';
import { EthUpdaterConfig } from '../../env';
import { unwrap } from '../../utils/option';
import { tokenIdToNode } from '../../utils/domain';

import * as ethersUtils from '../../utils/ethersUtils';

const getNameHashFromEvent = (event: Event): string | undefined => {
  const tokenId = event.args && (event.args['tokenId'] || event.args['0']);

  if (tokenId && BigNumber.isBigNumber(tokenId)) {
    return tokenIdToNode(tokenId);
  }

  return undefined;
};

export class UNSWorkerStrategy implements IWorkerStrategy {
  private unsRegistry: Contract;
  private cnsRegistry: Contract;
  private cnsResolver: CnsResolver;
  readonly blockchain: Blockchain;
  readonly networkId: number;
  private provider: StaticJsonRpcProvider;

  private config: EthUpdaterConfig;
  private cryptoConfig: CryptoConfig;

  private logger: winston.Logger;
  private workerRepository: WorkerRepository;

  constructor(blockchain: Blockchain, config: EthUpdaterConfig) {
    this.logger = WorkerLogger(blockchain);
    this.config = config;
    this.networkId = config.NETWORK_ID;
    this.blockchain = blockchain;
    this.provider = GetProviderForConfig(config);
    this.cryptoConfig = getEthConfig(this.networkId.toString(), this.provider);

    this.unsRegistry = this.cryptoConfig.UNSRegistry.getContract();
    this.cnsRegistry = this.cryptoConfig.CNSRegistry.getContract();

    this.workerRepository = getWorkerRepository(
      this.blockchain,
      this.networkId,
    );
    this.cnsResolver = new CnsResolver(
      this.cryptoConfig,
      this.workerRepository,
    );
  }

  public async getLatestNetworkBlock(): Promise<Block> {
    const blockNumber = await ethersUtils.getLatestNetworkBlock(this.provider);
    const latestBlock = await this.provider.getBlock(
      blockNumber - this.config.CONFIRMATION_BLOCKS,
    );

    return {
      blockNumber: latestBlock.number,
      blockHash: latestBlock.hash,
    };
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    const block = await this.provider.getBlock(blockNumber);
    return {
      blockNumber: block?.number,
      blockHash: block?.hash,
    };
  }

  public async getEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<WorkerEvent[]> {
    let unsEvents: Event[] = [];
    if (this.unsRegistry.address != Domain.NullAddress) {
      unsEvents = await this.unsRegistry.queryFilter({}, fromBlock, toBlock);
      this.logger.info(
        `Fetched ${
          unsEvents.length
        } unsEvents from ${fromBlock} to ${toBlock} by ${
          toBlock - fromBlock + 1
        } `,
      );
    }

    let cnsEvents: Event[] = [];
    if (this.cnsRegistry.address != Domain.NullAddress) {
      cnsEvents = await this.cnsRegistry.queryFilter({}, fromBlock, toBlock);

      this.logger.info(
        `Fetched ${
          cnsEvents.length
        } cnsEvents from ${fromBlock} to ${toBlock} by ${
          toBlock - fromBlock + 1
        } `,
      );
    }

    // Merge UNS and CNS events and sort them by block number and index.
    const events: Event[] = [...cnsEvents, ...unsEvents];
    events.sort((a, b) => {
      if (a.blockNumber === b.blockNumber) {
        if (a.logIndex === b.logIndex) {
          throw new Error(
            "Pairs of block numbers and log indexes can't be equal",
          );
        }
        return a.logIndex < b.logIndex ? -1 : 1;
      }
      return a.blockNumber < b.blockNumber ? -1 : 1;
    });

    return events.map((e: Event) => {
      const node = getNameHashFromEvent(e);

      const values: Record<string, string> = {};
      Object.entries(e.args || []).forEach(([key, value]) => {
        values[key] = BigNumber.isBigNumber(value)
          ? value.toHexString()
          : value;
      });

      return {
        node,
        type: e.event,
        source: {
          blockchain: this.blockchain,
          networkId: this.networkId,
          blockNumber: e.blockNumber,
          attributes: {
            blockHash: e.blockHash,
            transactionHash: e.transactionHash,
            logIndex: e.logIndex,
            contractAddress: e.address,
          },
        },
        args: values,
        innerEvent: e,
      };
    });
  }

  public async processEvents(events: WorkerEvent[]): Promise<void> {
    let lastProcessedEvent: WorkerEvent | undefined = undefined;
    for (const event of events) {
      try {
        this.logger.info(
          `Processing event: type - '${event.type}'; args - ${JSON.stringify(
            event.args,
          )};${
            event.innerEvent?.decodeError
              ? ` error: ${event.innerEvent?.decodeError}`
              : ''
          }`,
        );
        if (event.type && event.type in DomainOperationTypes && !event.node) {
          // verify that domain operations have a node
          throw new WorkerError(this.blockchain, 'Invalid event node.');
        }
        switch (event.type) {
          case 'Transfer': {
            await this.processTransfer(event);
            break;
          }
          case 'NewURI': {
            await this.processNewUri(event, lastProcessedEvent);
            break;
          }
          case 'ResetRecords': {
            await this.processResetRecords(event);
            break;
          }
          case 'Set': {
            await this.processSet(event);
            break;
          }
          case 'Resolve': {
            await this.processResolve(event);
            break;
          }
          case 'Sync': {
            await this.processSync(event);
            break;
          }
          case 'SetReverse': {
            await this.processSetReverse(event);
            break;
          }
          case 'RemoveReverse': {
            await this.processRemoveReverse(event);
            break;
          }
          default:
            break;
        }
      } catch (error) {
        this.logger.error(
          `Failed to process ${this.blockchain} event: ${JSON.stringify(
            event,
          )}. Error:  ${error}`,
        );
      }
      lastProcessedEvent = event;
    }
  }

  private async processTransfer(event: WorkerEvent): Promise<void> {
    const node = unwrap(event.node);
    const resolution = new Resolution({
      node,
      blockchain: this.blockchain,
      networkId: this.networkId,
    });

    //Check if it's not a new URI
    if (event.args?.from !== Domain.NullAddress) {
      //Check if it's a burn
      if (event.args?.to === Domain.NullAddress) {
        resolution.ownerAddress = Domain.NullAddress;
        resolution.resolution = undefined;
        resolution.resolver = null;
        resolution.registry = null;
        await this.workerRepository.saveResolutions(resolution);
      } else {
        resolution.ownerAddress = event.args?.to?.toLowerCase();
        await this.workerRepository.saveResolutions(resolution);
      }
    } else {
      // this is probably a bridge
      // this will be a no-op for new uri as we will not save a resolution without a domain
      resolution.ownerAddress = event.args?.to?.toLowerCase();
      resolution.registry = this.cnsRegistry.address;
      const contractAddress = (
        event.source?.attributes?.contractAddress as string | undefined
      )?.toLowerCase();
      if (contractAddress === this.unsRegistry.address.toLowerCase()) {
        resolution.resolver = contractAddress;
        resolution.registry = this.unsRegistry.address.toLowerCase();
      }
      await this.workerRepository.saveResolutions(resolution);
    }
  }

  private async processNewUri(
    event: WorkerEvent,
    lastProcessedEvent: WorkerEvent | undefined,
  ): Promise<void> {
    if (!event.args) {
      throw new WorkerError(
        this.blockchain,
        `NewUri event wasn't processed. Invalid event args.`,
      );
    }

    const { uri } = event.args;
    const expectedNode = eip137Namehash(uri);
    const producedNode = unwrap(event.node);

    //Check if the domain name matches tokenID
    if (expectedNode !== producedNode) {
      throw new WorkerError(
        this.blockchain,
        `NewUri event wasn't processed. Invalid domain name: ${uri}`,
      );
    }

    //Check if the previous event is "mint" - transfer from 0x0
    if (
      !lastProcessedEvent ||
      lastProcessedEvent.type !== 'Transfer' ||
      lastProcessedEvent.args?.from !== Domain.NullAddress
    ) {
      throw new WorkerError(
        this.blockchain,
        `NewUri event wasn't processed. Unexpected order of events. Expected last processed event to be 'Transfer', got :'${lastProcessedEvent?.type}'`,
      );
    }

    const domain: Domain = {
      name: uri,
      node: producedNode,
    };

    const resolution = new Resolution({
      node: producedNode,
      blockchain: this.blockchain,
      networkId: this.networkId,
    });

    resolution.ownerAddress = lastProcessedEvent.args?.to.toLowerCase();
    resolution.registry = this.cnsRegistry.address;

    const contractAddress = (
      event.source?.attributes?.['contractAddress'] as string | undefined
    )?.toLowerCase();
    if (contractAddress === this.unsRegistry.address.toLowerCase()) {
      resolution.resolver = contractAddress;
      resolution.registry = this.unsRegistry.address.toLowerCase();
    }
    await this.workerRepository.saveDomains(domain);
    await this.workerRepository.saveResolutions(resolution);
  }

  private async processResetRecords(event: WorkerEvent): Promise<void> {
    const node = unwrap(event.node);
    const resolution = new Resolution({
      node,
      blockchain: this.blockchain,
      networkId: this.networkId,
    });
    resolution.resolution = undefined;
    await this.workerRepository.saveResolutions(resolution);
  }

  private async processSet(event: WorkerEvent): Promise<void> {
    const node = unwrap(event.node);
    // For some reason ethers does not parse this event correctly
    const key = event.args?.['3'];
    const value = event.args?.['4'];
    if (key === undefined || value === undefined) {
      throw new WorkerError(
        this.blockchain,
        `Set event was not processed. Key or value not specified.`,
      );
    }

    const resolution: Resolution = new Resolution({
      node,
      blockchain: this.blockchain,
      networkId: this.networkId,
    });

    if (key !== undefined && value !== undefined && resolution.resolution) {
      resolution.resolution[key] = value;
      await this.workerRepository.saveResolutions(resolution);
    }
  }

  private async processResolve(event: WorkerEvent): Promise<void> {
    const node = unwrap(event.node);
    const resolution: Resolution = new Resolution({
      node,
      blockchain: this.blockchain,
      networkId: this.networkId,
    });
    await this.cnsResolver.fetchResolver(resolution);
  }

  private async processSync(event: WorkerEvent): Promise<void> {
    const node = unwrap(event.node);
    if (event.args?.updateId === undefined) {
      throw new WorkerError(
        this.blockchain,
        `Sync event was not processed. Update id not specified.`,
      );
    }

    const resolution: Resolution = new Resolution({
      node,
      blockchain: this.blockchain,
      networkId: this.networkId,
    });

    const keyHash = event.args?.updateId.toString();
    const resolverAddress = await this.cnsResolver.getResolverAddress(node);
    if (BigNumber.from(keyHash).eq(BigNumber.from(0)) || !resolverAddress) {
      resolution.resolution = undefined;
      await this.workerRepository.saveResolutions(resolution);
      return;
    }

    try {
      const resolutionRecord =
        await this.cnsResolver.getResolverRecordsByKeyHash(
          resolverAddress,
          keyHash,
          node,
        );
      if (resolution.resolution) {
        resolution.resolution[resolutionRecord.key] = resolutionRecord.value;
      }
    } catch (error: unknown) {
      if (error instanceof CnsResolverError) {
        this.logger.warn(error);
      } else if (
        error instanceof Error &&
        error.message.includes(ExecutionRevertedError)
      ) {
        resolution.resolution = undefined;
      } else {
        throw error;
      }
    }

    await this.workerRepository.saveResolutions(resolution);
  }

  private async processSetReverse(event: WorkerEvent): Promise<void> {
    const node = unwrap(event.node);
    const args = unwrap(event.args);
    const { addr } = args;

    const reverse: ReverseResolution = {
      node,
      reverseAddress: addr,
      blockchain: this.blockchain,
      networkId: this.networkId,
    };
    await this.workerRepository.saveReverseResolutions(reverse);
  }

  private async processRemoveReverse(event: WorkerEvent): Promise<void> {
    const args = unwrap(event.args);
    const { addr } = args;

    const reverseResolution: ReverseResolution = {
      blockchain: this.blockchain,
      networkId: this.networkId,
      reverseAddress: addr,
    };
    await this.workerRepository.removeReverseResolutions(reverseResolution);
  }
}
