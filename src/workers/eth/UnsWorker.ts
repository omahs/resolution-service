import { WorkerLogger } from '../../logger';
import {
  CnsRegistryEvent,
  Domain,
  DomainsReverseResolution,
  WorkerStatus,
} from '../../models';
import { Contract, Event, BigNumber } from 'ethers';
import { EntityManager, Repository } from 'typeorm';
import { CryptoConfig, getEthConfig } from '../../contracts';
import { eip137Namehash } from '../../utils/namehash';
import { EthUpdaterError } from '../../errors/EthUpdaterError';
import {
  GetProviderForConfig,
  StaticJsonRpcProvider,
} from '../../workers/EthereumProvider';
import { unwrap } from '../../utils/option';
import { CnsResolverError } from '../../errors/CnsResolverError';
import { ExecutionRevertedError } from './BlockchainErrors';
import { CnsResolver } from './CnsResolver';
import { Blockchain } from '../../types/common';
import { EthUpdaterConfig } from '../../env';
import winston from 'winston';
import { cacheSocialPictureInCDN } from '../../utils/socialPicture';
import { Block, IWorkerStrategy, WorkerRepository } from '../workerFramework';

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

    this.workerRepository = WorkerRepository.getRepository(
      this.blockchain,
      this.networkId,
    );
    this.cnsResolver = new CnsResolver(
      this.cryptoConfig,
      this.workerRepository,
    );
  }

  public async getLatestNetworkBlock(): Promise<Block> {
    const block = await this.provider.getBlock('latest');

    return {
      blockNumber: block.number - this.config.CONFIRMATION_BLOCKS,
      blockHash: block.hash,
    };
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    const block = await this.provider.getBlock(blockNumber);
    return {
      blockNumber: block.number,
      blockHash: block.hash,
    };
  }

  public async getEvents(fromBlock: number, toBlock: number): Promise<Event[]> {
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

    return events;
  }

  public async processEvents(events: Event[]) {
    let lastProcessedEvent: Event | undefined = undefined;
    for (const event of events) {
      try {
        this.logger.info(
          `Processing event: type - '${event.event}'; args - ${JSON.stringify(
            event.args,
          )};${event.decodeError ? ` error: ${event.decodeError}` : ''}`,
        );
        switch (event.event) {
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
          case 'Approval':
          case 'ApprovalForAll':
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

  private async processTransfer(event: Event): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await this.workerRepository.findByNode(node);
    //Check if it's not a new URI
    if (event.args?.from !== Domain.NullAddress) {
      if (!domain) {
        throw new EthUpdaterError(
          `Transfer event was not processed. Could not find domain for ${node}`,
        );
      }
      const resolution = domain.getResolution(this.blockchain, this.networkId);

      //Check if it's a burn
      if (event.args?.to === Domain.NullAddress) {
        resolution.ownerAddress = Domain.NullAddress;
        resolution.resolution = {};
        resolution.resolver = null;
        resolution.registry = null;
        domain.setResolution(resolution);
        await this.workerRepository.save(domain);
      } else {
        resolution.ownerAddress = event.args?.to?.toLowerCase();
        await this.workerRepository.save(domain);
      }
    } else if (domain) {
      // domain exists, so it's probably a bridge
      const resolution = domain.getResolution(this.blockchain, this.networkId);

      resolution.ownerAddress = event.args?.to?.toLowerCase();
      resolution.registry = this.cnsRegistry.address;

      const contractAddress = event.address.toLowerCase();
      if (contractAddress === this.unsRegistry.address.toLowerCase()) {
        resolution.resolver = contractAddress;
        resolution.registry = this.unsRegistry.address.toLowerCase();
      }
      domain.setResolution(resolution); // create resolution for L2
      await this.workerRepository.save(domain);
    }
  }

  private async processNewUri(
    event: Event,
    lastProcessedEvent: Event | undefined,
  ): Promise<void> {
    if (!event.args) {
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Invalid event args.`,
      );
    }

    const { uri, tokenId } = event.args;
    const expectedNode = eip137Namehash(uri);
    const producedNode = CnsRegistryEvent.tokenIdToNode(tokenId);

    //Check if the domain name matches tokenID
    if (expectedNode !== producedNode) {
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Invalid domain name: ${uri}`,
      );
    }

    //Check if the previous event is "mint" - transfer from 0x0
    if (
      !lastProcessedEvent ||
      lastProcessedEvent.event !== 'Transfer' ||
      lastProcessedEvent.args?.from !== Domain.NullAddress
    ) {
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Unexpected order of events. Expected last processed event to be 'Transfer', got :'${lastProcessedEvent?.event}'`,
      );
    }

    const domain = await this.workerRepository.findOrBuildByNode(producedNode);
    const resolution = domain.getResolution(this.blockchain, this.networkId);

    domain.name = uri;
    resolution.ownerAddress = lastProcessedEvent.args?.to.toLowerCase();
    resolution.registry = this.cnsRegistry.address;

    const contractAddress = event.address.toLowerCase();
    if (contractAddress === this.unsRegistry.address.toLowerCase()) {
      resolution.resolver = contractAddress;
      resolution.registry = this.unsRegistry.address.toLowerCase();
    }
    domain.setResolution(resolution);
    await this.workerRepository.save(domain);
  }

  private async processResetRecords(event: Event): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await this.workerRepository.findByNode(node);

    if (!domain) {
      throw new EthUpdaterError(
        `ResetRecords event was not processed. Could not find domain for ${node}`,
      );
    }

    const resolution = domain.getResolution(this.blockchain, this.networkId);
    resolution.resolution = {};
    domain.setResolution(resolution);
    await this.workerRepository.save(domain);
  }

  private async processSet(event: Event): Promise<void> {
    const args = unwrap(event.args);
    // For some reason ethers got a problem with assigning names for this event.
    const [, , , key, value] = args;
    const tokenId = args[0];
    const node = CnsRegistryEvent.tokenIdToNode(tokenId);
    const domain = await this.workerRepository.findByNode(node);
    if (!domain) {
      throw new EthUpdaterError(
        `Set event was not processed. Could not find domain for ${node}`,
      );
    }
    const resolution = domain.getResolution(this.blockchain, this.networkId);
    resolution.resolution[key] = value;
    domain.setResolution(resolution);
    await this.workerRepository.save(domain);
    if (key === 'social.picture.value' && !!value) {
      try {
        await cacheSocialPictureInCDN(value, domain, resolution);
      } catch (error) {
        this.logger.error(`Failed to cache PFP for ${domain}: ${error}`);
      }
    }
  }

  private async processResolve(event: Event): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await this.workerRepository.findByNode(node);
    if (!domain) {
      throw new EthUpdaterError(
        `Resolve event was not processed. Could not find domain for ${node}`,
      );
    }
    const resolution = domain.getResolution(this.blockchain, this.networkId);
    await this.cnsResolver.fetchResolver(domain, resolution);
  }

  private async processSync(event: Event): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await this.workerRepository.findByNode(node);
    if (!domain) {
      throw new EthUpdaterError(
        `Sync event was not processed. Could not find domain for node: ${node}`,
      );
    }
    if (event.args?.updateId === undefined) {
      throw new EthUpdaterError(
        `Sync event was not processed. Update id not specified.`,
      );
    }

    const resolution = domain.getResolution(this.blockchain, this.networkId);

    const keyHash = event.args?.updateId.toString();
    const resolverAddress = await this.cnsResolver.getResolverAddress(node);
    if (keyHash === '0' || !resolverAddress) {
      resolution.resolution = {};
      domain.setResolution(resolution);
      await this.workerRepository.save(domain);
      return;
    }

    try {
      const resolutionRecord =
        await this.cnsResolver.getResolverRecordsByKeyHash(
          resolverAddress,
          keyHash,
          node,
        );
      resolution.resolution[resolutionRecord.key] = resolutionRecord.value;
    } catch (error: unknown) {
      if (error instanceof CnsResolverError) {
        this.logger.warn(error);
      } else if (
        error instanceof Error &&
        error.message.includes(ExecutionRevertedError)
      ) {
        resolution.resolution = {};
      } else {
        throw error;
      }
    }

    domain.setResolution(resolution);
    await this.workerRepository.save(domain);
  }

  private async processSetReverse(event: Event): Promise<void> {
    const args = unwrap(event.args);
    const { addr, tokenId } = args;
    const node = CnsRegistryEvent.tokenIdToNode(tokenId);
    const domain = await this.workerRepository.findByNode(node);
    if (!domain) {
      throw new EthUpdaterError(
        `SetReverse event was not processed. Could not find domain for ${node}`,
      );
    }

    let reverse = await this.workerRepository.findOne(
      DomainsReverseResolution,
      {
        reverseAddress: addr,
        blockchain: this.blockchain,
        networkId: this.networkId,
      },
      {
        relations: ['domain'],
      },
    );

    if (!reverse) {
      reverse = new DomainsReverseResolution({
        reverseAddress: addr,
        blockchain: this.blockchain,
        networkId: this.networkId,
        domain: domain,
      });
    } else {
      const oldDomain = reverse.domain;
      oldDomain.removeReverseResolution(this.blockchain, this.networkId);
      await this.workerRepository.save(oldDomain);
      reverse.domain = domain;
    }
    domain.setReverseResolution(reverse);
    await this.workerRepository.save(domain);
  }

  private async processRemoveReverse(event: Event): Promise<void> {
    const args = unwrap(event.args);
    const { addr } = args;

    const reverseResolution = await this.workerRepository.findOne(
      DomainsReverseResolution,
      {
        reverseAddress: addr,
        blockchain: this.blockchain,
        networkId: this.networkId,
      },
    );
    if (!reverseResolution) {
      throw new EthUpdaterError(
        `RemoveReverse event was not processed. Could not find reverse resolution for ${addr}`,
      );
    }
    await this.workerRepository.remove(reverseResolution);
  }
}
