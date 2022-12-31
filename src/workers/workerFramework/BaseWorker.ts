import winston from 'winston';
import { EthUpdaterError } from '../../errors/EthUpdaterError';
import { WorkerLogger } from '../../logger';
import { Blockchain } from '../../types/common';
import { IWorker, IWorkerStrategy, WorkerEvent, WorkerConfig } from '.';
import { WorkerRepository } from './WorkerRepository';

export class BaseWorker implements IWorker {
  readonly blockchain: Blockchain;
  readonly networkId: number;

  private config: WorkerConfig;

  private currentSyncBlock = 0;
  private currentSyncBlockHash: string | undefined = '';

  private logger: winston.Logger;
  private workerStrategy: IWorkerStrategy;
  private workerRepository: WorkerRepository;

  constructor(config: WorkerConfig, workerStrategy: IWorkerStrategy) {
    this.logger = WorkerLogger(config.blockchain);
    this.workerStrategy = workerStrategy;
    this.config = config;
    this.networkId = config.networkId;
    this.blockchain = config.blockchain;
  }

  // reorg handling
  private async findLastMatchingBlock(): Promise<{
    blockNumber: number;
    blockHash: string;
  }> {
    const latestEventBlocks = await this.workerRepository.latestEventBlocks(
      this.config.maxReorgSize,
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
        `Detected reorg that is larger than ${this.config.maxReorgSize} blocks. Manual resync is required.`,
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

  private async rebuildDomainFromEvents(node: string) {
    this.logger.warn(`Rebuilding domain ${node} from db events`);
    const domainEvents = await this.workerRepository.findEventsForDomain(node);
    await this.workerRepository.removeAllResolutionsForDomain(node);
    await this.workerStrategy.processEvents(domainEvents);
  }

  private async handleReorg(): Promise<number> {
    const reorgStartingBlock = await this.findLastMatchingBlock();
    await this.workerRepository.saveLastMirroredBlock(
      reorgStartingBlock.blockNumber,
      reorgStartingBlock.blockHash,
    );

    const cleanUp = await this.workerRepository.cleanUpEvents(
      reorgStartingBlock.blockNumber,
    );

    const promises: Promise<void>[] = [];
    for (const node of cleanUp.affected) {
      promises.push(this.rebuildDomainFromEvents(node));
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
    const latestMirrored =
      (await this.workerRepository.getLatestMirroredBlock()) ||
      this.config.eventsStartingBlock;
    const latestNetBlock = (
      await this.workerStrategy.getLatestNetworkBlock(latestMirrored)
    ).blockNumber;

    if (!this.config.handleReorgs) {
      return { fromBlock: latestMirrored, toBlock: latestNetBlock };
    }

    const latestMirroredHash =
      await this.workerRepository.getLatestMirroredBlockHash();
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

  // saving events
  private async saveEvents(events: WorkerEvent[]): Promise<void> {
    await this.workerRepository.saveEvents(events);
  }

  // running functions
  public async run(): Promise<void> {
    try {
      this.workerRepository = await WorkerRepository.startTransaction(
        this.blockchain,
        this.networkId,
      );

      this.logger.info(`EthUpdater is pulling updates from ${this.blockchain}`);

      const { fromBlock, toBlock } = await this.syncBlockRanges();

      this.logger.info(
        `Current network block ${toBlock}: Syncing mirror from ${fromBlock} to ${toBlock}`,
      );

      this.currentSyncBlock = fromBlock;

      while (this.currentSyncBlock < toBlock) {
        const fetchBlock = Math.min(
          this.currentSyncBlock + this.config.blockFetchLimit,
          toBlock,
        );

        const events = await this.workerStrategy.getEvents(
          this.currentSyncBlock + 1,
          fetchBlock,
        );
        this.logger.info(
          `Fetched ${events.length} events from ${this.blockchain}.`,
        );
        await this.saveEvents(events);
        await this.workerStrategy.processEvents(events);

        this.currentSyncBlock = fetchBlock;
        this.currentSyncBlockHash = (
          await this.workerStrategy.getBlock(this.currentSyncBlock)
        )?.blockHash;
        await this.workerRepository.saveLastMirroredBlock(
          this.currentSyncBlock,
          this.currentSyncBlockHash,
        );
      }

      await WorkerRepository.commitTransaction(this.blockchain);
    } catch (error) {
      this.logger.error(error);
      await WorkerRepository.rollbackTransaction(this.blockchain);
    }
  }

  public async resync(fromBlock: number): Promise<void> {
    try {
      this.workerRepository = await WorkerRepository.startTransaction(
        this.blockchain,
        this.networkId,
      );

      const latestMirrored =
        await this.workerRepository.getLatestMirroredBlock();
      this.logger.info(
        `Latest mirrored block ${latestMirrored}. Resync requested from block ${fromBlock}.`,
      );
      const netBlock = await this.workerStrategy.getBlock(fromBlock);

      let cleanUp = 0;

      await this.workerRepository.saveLastMirroredBlock(
        fromBlock,
        netBlock.blockHash,
      );

      ({ deleted: cleanUp } = await this.workerRepository.cleanUpEvents(
        fromBlock,
      ));

      this.logger.info(
        `Deleted ${cleanUp} events. Restart the service without RESYNC_FROM to sync again.`,
      );

      await WorkerRepository.commitTransaction(this.blockchain);
    } catch (error) {
      this.logger.error(error);
      await WorkerRepository.rollbackTransaction(this.blockchain);
    }
  }
}
