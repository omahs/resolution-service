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
import { Block, IWorkerStrategy } from '../workerFramework';

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

  eventRepository: Repository<CnsRegistryEvent>;
  domainRepository: Repository<Domain>;
  domainReverseRepository: Repository<DomainsReverseResolution>;

  constructor(blockchain: Blockchain, config: EthUpdaterConfig) {
    this.logger = WorkerLogger(blockchain);
    this.config = config;
    this.networkId = config.NETWORK_ID;
    this.blockchain = blockchain;
    this.provider = GetProviderForConfig(config);
    this.cryptoConfig = getEthConfig(this.networkId.toString(), this.provider);

    this.unsRegistry = this.cryptoConfig.UNSRegistry.getContract();
    this.cnsRegistry = this.cryptoConfig.CNSRegistry.getContract();
    this.cnsResolver = new CnsResolver(this.cryptoConfig);
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

  private async processTransfer(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
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
        await domainRepository.save(domain);
      } else {
        resolution.ownerAddress = event.args?.to?.toLowerCase();
        await domainRepository.save(domain);
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
      await domainRepository.save(domain);
    }
  }

  private async processNewUri(
    event: Event,
    lastProcessedEvent: Event | undefined,
    domainRepository: Repository<Domain>,
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

    const domain = await Domain.findOrBuildByNode(
      producedNode,
      domainRepository,
    );
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
    await domainRepository.save(domain);
  }

  private async processResetRecords(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);

    if (!domain) {
      throw new EthUpdaterError(
        `ResetRecords event was not processed. Could not find domain for ${node}`,
      );
    }

    const resolution = domain.getResolution(this.blockchain, this.networkId);
    resolution.resolution = {};
    domain.setResolution(resolution);
    await domainRepository.save(domain);
  }

  private async processSet(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const args = unwrap(event.args);
    // For some reason ethers got a problem with assigning names for this event.
    const [, , , key, value] = args;
    const tokenId = args[0];
    const node = CnsRegistryEvent.tokenIdToNode(tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new EthUpdaterError(
        `Set event was not processed. Could not find domain for ${node}`,
      );
    }
    const resolution = domain.getResolution(this.blockchain, this.networkId);
    resolution.resolution[key] = value;
    domain.setResolution(resolution);
    await domainRepository.save(domain);
    if (key === 'social.picture.value' && !!value) {
      try {
        await cacheSocialPictureInCDN(value, domain, resolution);
      } catch (error) {
        this.logger.error(`Failed to cache PFP for ${domain}: ${error}`);
      }
    }
  }

  private async processResolve(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new EthUpdaterError(
        `Resolve event was not processed. Could not find domain for ${node}`,
      );
    }
    const resolution = domain.getResolution(this.blockchain, this.networkId);
    await this.cnsResolver.fetchResolver(domain, resolution, domainRepository);
  }

  private async processSync(
    event: Event,
    domainRepository: Repository<Domain>,
  ): Promise<void> {
    const node = CnsRegistryEvent.tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
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
      await domainRepository.save(domain);
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
    await domainRepository.save(domain);
  }

  private async processSetReverse(
    event: Event,
    domainRepository: Repository<Domain>,
    reverseRepository: Repository<DomainsReverseResolution>,
  ): Promise<void> {
    const args = unwrap(event.args);
    const { addr, tokenId } = args;
    const node = CnsRegistryEvent.tokenIdToNode(tokenId);
    const domain = await Domain.findByNode(node, domainRepository);
    if (!domain) {
      throw new EthUpdaterError(
        `SetReverse event was not processed. Could not find domain for ${node}`,
      );
    }

    let reverse = await reverseRepository.findOne(
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
      await domainRepository.save(oldDomain);
      reverse.domain = domain;
    }
    domain.setReverseResolution(reverse);
    await domainRepository.save(domain);
  }

  private async processRemoveReverse(
    event: Event,
    reverseRepository: Repository<DomainsReverseResolution>,
  ): Promise<void> {
    const args = unwrap(event.args);
    const { addr } = args;

    const reverseResolution = await reverseRepository.findOne({
      where: {
        reverseAddress: addr,
        blockchain: this.blockchain,
        networkId: this.networkId,
      },
    });
    if (!reverseResolution) {
      throw new EthUpdaterError(
        `RemoveReverse event was not processed. Could not find reverse resolution for ${addr}`,
      );
    }
    await reverseRepository.remove(reverseResolution);
  }

  private async saveEvent(event: Event): Promise<void> {
    const values: Record<string, string> = {};
    Object.entries(event?.args || []).forEach(([key, value]) => {
      values[key] = BigNumber.isBigNumber(value) ? value.toHexString() : value;
    });
    const contractAddress = event.address.toLowerCase();
    await this.eventRepository.save(
      new CnsRegistryEvent(
        {
          contractAddress,
          type: event.event,
          blockNumber: event.blockNumber,
          blockHash: event.blockHash,
          logIndex: event.logIndex,
          transactionHash: event.transactionHash,
          returnValues: values,
          blockchain: this.blockchain,
          networkId: this.networkId,
          node: event.args?.[0],
        },
        this.eventRepository,
      ),
    );
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
            await this.processTransfer(event, this.domainRepository);
            break;
          }
          case 'NewURI': {
            await this.processNewUri(
              event,
              lastProcessedEvent,
              this.domainRepository,
            );
            break;
          }
          case 'ResetRecords': {
            await this.processResetRecords(event, this.domainRepository);
            break;
          }
          case 'Set': {
            await this.processSet(event, this.domainRepository);
            break;
          }
          case 'Resolve': {
            await this.processResolve(event, this.domainRepository);
            break;
          }
          case 'Sync': {
            await this.processSync(event, this.domainRepository);
            break;
          }
          case 'SetReverse': {
            await this.processSetReverse(
              event,
              this.domainRepository,
              this.domainReverseRepository,
            );
            break;
          }
          case 'RemoveReverse': {
            await this.processRemoveReverse(
              event,
              this.domainReverseRepository,
            );
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
      try {
        if (event.event) {
          await this.saveEvent(event);
        }
      } catch (error) {
        this.logger.error(
          `Failed to save ${this.blockchain} event: ${JSON.stringify(
            event,
          )}. Error:  ${error}`,
        );
      }
      lastProcessedEvent = event;
    }
  }
}
