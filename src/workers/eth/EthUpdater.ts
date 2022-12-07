import { logger, WorkerLogger } from '../../logger';
import { setIntervalAsync } from 'set-interval-async/dynamic';
import {
  CnsRegistryEvent,
  Domain,
  DomainsReverseResolution,
  WorkerStatus,
} from '../../models';
import { Contract, Event, BigNumber } from 'ethers';
import { EntityManager, getConnection, Repository } from 'typeorm';
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
import * as ethersUtils from '../../utils/ethersUtils';
import { Blockchain } from '../../types/common';
import { EthUpdaterConfig } from '../../env';
import winston from 'winston';
import { cacheSocialPictureInCDN } from '../../utils/socialPicture';

export class EthUpdater {
  private unsRegistry: Contract;
  private cnsRegistry: Contract;
  private cnsResolver: CnsResolver;
  readonly blockchain: Blockchain;
  readonly networkId: number;
  private provider: StaticJsonRpcProvider;

  private config: EthUpdaterConfig;
  private cryptoConfig: CryptoConfig;

  private currentSyncBlock = 0;
  private currentSyncBlockHash = '';

  private logger: winston.Logger;

  private manager: EntityManager;

  private eventRepository: Repository<CnsRegistryEvent>;
  private domainRepository: Repository<Domain>;
  private domainReverseRepository: Repository<DomainsReverseResolution>;
  private workerStatusRepository: Repository<WorkerStatus>;

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

  async getLatestNetworkBlock(): Promise<number> {
    return (
      (await ethersUtils.getLatestNetworkBlock(this.provider)) -
      this.config.CONFIRMATION_BLOCKS
    );
  }

  getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker(
      this.blockchain,
      this.workerStatusRepository,
    );
  }

  getLatestMirroredBlockHash(): Promise<string | undefined> {
    return WorkerStatus.latestMirroredBlockHashForWorker(
      this.blockchain,
      this.workerStatusRepository,
    );
  }

  private async saveLastMirroredBlock(): Promise<void> {
    return WorkerStatus.saveWorkerStatus(
      this.blockchain,
      this.currentSyncBlock,
      this.currentSyncBlockHash,
      undefined,
      this.workerStatusRepository,
    );
  }

  private async getRegistryEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<Event[]> {
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

  private async processEvents(events: Event[], save = true) {
    let lastProcessedEvent: Event | undefined = undefined;
    for (const event of events) {
      try {
        this.logger.info(
          `Processing event: type - '${event.event}'; args - ${JSON.stringify(
            event.args,
          )}; error - ${event.decodeError}`,
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
        if (save && event.event) {
          await this.saveEvent(event);
        }
        lastProcessedEvent = event;
      } catch (error) {
        this.logger.error(
          `Failed to process ${this.blockchain} event: ${JSON.stringify(
            event,
          )}. Error:  ${error}`,
        );
        throw error;
      }
    }
  }

  private async findLastMatchingBlock(
    repository: Repository<CnsRegistryEvent>,
  ): Promise<{
    blockNumber: number;
    blockHash: string;
  }> {
    const latestEventBlocks = await CnsRegistryEvent.latestEventBlocks(
      this.config.MAX_REORG_SIZE,
      this.blockchain,
      this.networkId,
      repository,
    );

    // Check first and last blocks as edge cases
    const [firstNetBlock, lastNetBlock] = await Promise.all([
      this.provider.getBlock(latestEventBlocks[0].blockNumber),
      this.provider.getBlock(
        latestEventBlocks[latestEventBlocks.length - 1].blockNumber,
      ),
    ]);

    // If the oldest event block doesn't match, the reorg must be too long.
    if (firstNetBlock.hash !== latestEventBlocks[0].blockHash) {
      throw new EthUpdaterError(
        `Detected reorg that is larger than ${this.config.MAX_REORG_SIZE} blocks. Manual resync is required.`,
      );
    }

    // Latest event block != last mirrored block. There could be blocks without events during the reorg.
    if (
      lastNetBlock.hash ===
      latestEventBlocks[latestEventBlocks.length - 1].blockHash
    ) {
      return latestEventBlocks[latestEventBlocks.length - 1];
    }

    // Binary search for reorg start
    let searchReorgFrom = 0;
    let searchReorgTo = latestEventBlocks.length - 1;
    while (searchReorgTo - searchReorgFrom > 1) {
      const mid =
        searchReorgFrom + Math.floor((searchReorgTo - searchReorgFrom) / 2);
      const ourBlock = latestEventBlocks[mid];
      const netBlock = await this.provider.getBlock(ourBlock.blockNumber);
      if (ourBlock.blockHash !== netBlock.hash) {
        searchReorgTo = mid;
      } else {
        searchReorgFrom = mid;
      }
    }
    return latestEventBlocks[searchReorgFrom];
  }

  private async rebuildDomainFromEvents(tokenId: string) {
    const domain = await Domain.findByNode(
      tokenId,
      this.domainRepository,
      false,
    );
    if (!domain) {
      return;
    }

    this.logger.warn(`Rebuilding domain ${domain.name} from db events`);
    const domainEvents = await this.eventRepository.find({
      where: {
        node: tokenId,
        blockchain: this.blockchain,
        networkId: this.networkId,
      },
      order: { blockNumber: 'ASC', logIndex: 'ASC' },
    });
    const convertedEvents: Event[] = [];
    for (const event of domainEvents) {
      const tmpEvent = {
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        logIndex: event.logIndex,
        event: event.type,
        args: event.returnValues as Record<string, any>,
        address: event.contractAddress,
      };
      tmpEvent.args.tokenId = BigNumber.from(tokenId);
      convertedEvents.push(tmpEvent as Event);
    }

    const resolution = domain.getResolution(this.blockchain, this.networkId);
    if (resolution.ownerAddress) {
      await this.manager.remove(resolution);
    }
    const reverseResolution = domain.getReverseResolution(
      this.blockchain,
      this.networkId,
    );
    if (reverseResolution) {
      await this.manager.remove(reverseResolution);
    }
    await this.processEvents(convertedEvents, false);
  }

  private async handleReorg(): Promise<number> {
    const reorgStartingBlock = await this.findLastMatchingBlock(
      this.eventRepository,
    );
    await WorkerStatus.saveWorkerStatus(
      this.blockchain,
      reorgStartingBlock.blockNumber,
      reorgStartingBlock.blockHash,
      undefined,
      this.workerStatusRepository,
    );

    const cleanUp = await CnsRegistryEvent.cleanUpEvents(
      reorgStartingBlock.blockNumber,
      this.blockchain,
      this.networkId,
      this.eventRepository,
    );

    const promises: Promise<void>[] = [];
    for (const tokenId of cleanUp.affected) {
      promises.push(this.rebuildDomainFromEvents(tokenId));
    }
    await Promise.all(promises);

    this.logger.warn(
      `Deleted ${cleanUp.deleted} events after reorg and reverted ${cleanUp.affected.size} domains`,
    );

    return reorgStartingBlock.blockNumber;
  }

  private async syncBlockRanges(): Promise<{
    fromBlock: number;
    toBlock: number;
  }> {
    const latestMirrored = await this.getLatestMirroredBlock();
    const latestNetBlock = await this.getLatestNetworkBlock();
    if (latestMirrored === 0) {
      return {
        fromBlock: Math.min(
          this.config.UNS_REGISTRY_EVENTS_STARTING_BLOCK,
          this.config.CNS_REGISTRY_EVENTS_STARTING_BLOCK,
        ),
        toBlock: latestNetBlock,
      };
    }

    const latestMirroredHash = await this.getLatestMirroredBlockHash();
    const networkHash = (await this.provider.getBlock(latestMirrored))?.hash;

    const blockHeightMatches = latestNetBlock >= latestMirrored;
    const blockHashMatches = latestMirroredHash === networkHash;
    if (blockHeightMatches && blockHashMatches) {
      return { fromBlock: latestMirrored, toBlock: latestNetBlock };
    }

    if (!blockHeightMatches) {
      this.logger.warn(
        `Blockchain reorg detected: Sync last block ${latestMirrored} is less than the current mirror block ${latestNetBlock}`,
      );
    } else {
      this.logger.warn(
        `Blockchain reorg detected: last mirrored block hash ${latestMirroredHash} does not match the network block hash ${networkHash}`,
      );
    }

    const reorgStartingBlock = await this.handleReorg();
    this.logger.warn(
      `Handled blockchain reorg starting from block ${reorgStartingBlock}`,
    );

    return { fromBlock: reorgStartingBlock, toBlock: latestNetBlock };
  }

  private async runInTransaction(func: () => Promise<void>): Promise<void> {
    this.manager = getConnection().createQueryRunner().manager;
    this.eventRepository = this.manager.getRepository(CnsRegistryEvent);
    this.domainRepository = this.manager.getRepository(Domain);
    this.domainReverseRepository = this.manager.getRepository(
      DomainsReverseResolution,
    );
    this.workerStatusRepository = this.manager.getRepository(WorkerStatus);
    await this.manager.queryRunner?.startTransaction('REPEATABLE READ');
    try {
      await WorkerStatus.lockBlockchainStatus(this.blockchain, this.manager);
      await func();
      await this.manager.queryRunner?.commitTransaction();
    } catch (error) {
      this.logger.error(
        `Unhandled error occured while processing ${this.blockchain} events: ${error}`,
      );
      await this.manager.queryRunner?.rollbackTransaction();
    } finally {
      await this.manager.release();
    }
  }

  public async run(): Promise<void> {
    return this.runInTransaction(() => this.runWorkerSync());
  }

  public async runWorkerSync(): Promise<void> {
    this.logger.info(`EthUpdater is pulling updates from ${this.blockchain}`);

    const { fromBlock, toBlock } = await this.syncBlockRanges();

    this.logger.info(
      `Current network block ${toBlock}: Syncing mirror from ${fromBlock} to ${toBlock}`,
    );

    this.currentSyncBlock = fromBlock;

    while (this.currentSyncBlock < toBlock) {
      const fetchBlock = Math.min(
        this.currentSyncBlock + this.config.BLOCK_FETCH_LIMIT,
        toBlock,
      );

      const events = await this.getRegistryEvents(
        this.currentSyncBlock + 1,
        fetchBlock,
      );

      await this.processEvents(events);
      this.currentSyncBlock = fetchBlock;
      this.currentSyncBlockHash = (
        await this.provider.getBlock(this.currentSyncBlock)
      )?.hash;
      await this.saveLastMirroredBlock();
    }
  }

  public async resync(): Promise<void> {
    return this.runInTransaction(() => this.runWorkerReync());
  }

  public async runWorkerReync(): Promise<void> {
    if (this.config.RESYNC_FROM === undefined) {
      return;
    }
    const latestMirrored = await this.getLatestMirroredBlock();
    this.logger.info(
      `Latest mirrored block ${latestMirrored}. Resync requested from block ${this.config.RESYNC_FROM}.`,
    );
    const netBlock = await this.provider.getBlock(this.config.RESYNC_FROM);

    let cleanUp = 0;

    await WorkerStatus.saveWorkerStatus(
      this.blockchain,
      this.config.RESYNC_FROM,
      netBlock.hash,
      undefined,
      this.workerStatusRepository,
    );

    ({ deleted: cleanUp } = await CnsRegistryEvent.cleanUpEvents(
      this.config.RESYNC_FROM,
      this.blockchain,
      this.networkId,
      this.eventRepository,
    ));

    this.logger.info(
      `Deleted ${cleanUp} events. Restart the service without RESYNC_FROM to sync again.`,
    );
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
