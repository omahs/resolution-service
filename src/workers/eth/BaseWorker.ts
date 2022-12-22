import { BigNumber, Event } from 'ethers';
import { EntityManager, getConnection, Repository } from 'typeorm';
import winston from 'winston';
import { EthUpdaterConfig } from '../../env';
import { EthUpdaterError } from '../../errors/EthUpdaterError';
import { WorkerLogger } from '../../logger';
import {
  CnsRegistryEvent,
  Domain,
  DomainsReverseResolution,
  WorkerStatus,
} from '../../models';
import { Blockchain } from '../../types/common';
import { IWorker, IWorkerStrategy, Block } from '../workerFramework';

export class BaseWorker implements IWorker {
  readonly blockchain: Blockchain;
  readonly networkId: number;

  private config: EthUpdaterConfig;

  private currentSyncBlock = 0;
  private currentSyncBlockHash = '';

  private logger: winston.Logger;

  private manager: EntityManager;

  private eventRepository: Repository<CnsRegistryEvent>;
  private domainRepository: Repository<Domain>;
  private domainReverseRepository: Repository<DomainsReverseResolution>;
  private workerStatusRepository: Repository<WorkerStatus>;

  private workerStrategy: IWorkerStrategy;

  constructor(
    config: EthUpdaterConfig,
    blockchain: Blockchain,
    workerStrategy: IWorkerStrategy,
  ) {
    this.logger = WorkerLogger(blockchain);
    this.workerStrategy = workerStrategy;
    this.config = config;
    this.networkId = config.NETWORK_ID;
    this.blockchain = blockchain;
  }

  // reorg handling

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
      this.workerStrategy.getBlock(latestEventBlocks[0].blockNumber),
      this.workerStrategy.getBlock(
        latestEventBlocks[latestEventBlocks.length - 1].blockNumber,
      ),
    ]);

    // If the oldest event block doesn't match, the reorg must be too long.
    if (firstNetBlock.blockHash !== latestEventBlocks[0].blockHash) {
      throw new EthUpdaterError(
        `Detected reorg that is larger than ${this.config.MAX_REORG_SIZE} blocks. Manual resync is required.`,
      );
    }

    // Latest event block != last mirrored block. There could be blocks without events during the reorg.
    if (
      lastNetBlock.blockHash ===
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
      const netBlock = await this.workerStrategy.getBlock(ourBlock.blockNumber);
      if (ourBlock.blockHash !== netBlock.blockHash) {
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
    await this.workerStrategy.processEvents(convertedEvents);
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

  private getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker(
      this.blockchain,
      this.workerStatusRepository,
    );
  }

  private getLatestMirroredBlockHash(): Promise<string | undefined> {
    return WorkerStatus.latestMirroredBlockHashForWorker(
      this.blockchain,
      this.workerStatusRepository,
    );
  }

  private async syncBlockRanges(): Promise<{
    fromBlock: number;
    toBlock: number;
  }> {
    const latestMirrored = await this.getLatestMirroredBlock();
    const latestNetBlock = (await this.workerStrategy.getLatestNetworkBlock())
      .blockNumber;
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
    const networkHash = (await this.workerStrategy.getBlock(latestMirrored))
      ?.blockHash;

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

  // running functions

  private async runInTransaction(func: () => Promise<void>): Promise<void> {
    this.manager = getConnection().createQueryRunner().manager;
    this.eventRepository = this.manager.getRepository(CnsRegistryEvent);
    this.domainRepository = this.manager.getRepository(Domain);
    this.domainReverseRepository = this.manager.getRepository(
      DomainsReverseResolution,
    );

    // TODO: separate out a DB manager
    (this.workerStrategy as any).eventRepository = this.eventRepository;
    (this.workerStrategy as any).domainRepository = this.domainRepository;
    (this.workerStrategy as any).domainReverseRepository =
      this.domainReverseRepository;

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

  private async saveLastMirroredBlock(): Promise<void> {
    return WorkerStatus.saveWorkerStatus(
      this.blockchain,
      this.currentSyncBlock,
      this.currentSyncBlockHash,
      undefined,
      this.workerStatusRepository,
    );
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

      const events = await this.workerStrategy.getEvents(
        this.currentSyncBlock + 1,
        fetchBlock,
      );
      await this.workerStrategy.processEvents(events);

      this.currentSyncBlock = fetchBlock;
      this.currentSyncBlockHash = (
        await this.workerStrategy.getBlock(this.currentSyncBlock)
      )?.blockHash;
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
    const netBlock = await this.workerStrategy.getBlock(
      this.config.RESYNC_FROM,
    );

    let cleanUp = 0;

    await WorkerStatus.saveWorkerStatus(
      this.blockchain,
      this.config.RESYNC_FROM,
      netBlock.blockHash,
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
