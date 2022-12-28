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
import { IWorker, IWorkerStrategy, Block, WorkerRepository } from '.';

// TODO:
//  [x] extract db repositories
//  [x] save events in base worker
//  [] get rid of EthUpdater
//  [] cleanup files structure, add modules
//  [] change event to generic struct
//  [] organise configs
//  [] redo tests

export class BaseWorker implements IWorker {
  readonly blockchain: Blockchain;
  readonly networkId: number;

  private config: EthUpdaterConfig;

  private currentSyncBlock = 0;
  private currentSyncBlockHash = '';

  private logger: winston.Logger;
  private workerStrategy: IWorkerStrategy;
  private workerRepository: WorkerRepository;

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
  private async findLastMatchingBlock(): Promise<{
    blockNumber: number;
    blockHash: string;
  }> {
    const latestEventBlocks = await this.workerRepository.latestEventBlocks(
      this.config.MAX_REORG_SIZE,
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
    const domain = await this.workerRepository.findByNode(tokenId);
    if (!domain) {
      return;
    }

    this.logger.warn(`Rebuilding domain ${domain.name} from db events`);
    const domainEvents = await this.workerRepository.find(CnsRegistryEvent, {
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
      await this.workerRepository.remove(resolution);
    }
    const reverseResolution = domain.getReverseResolution(
      this.blockchain,
      this.networkId,
    );
    if (reverseResolution) {
      await this.workerRepository.remove(reverseResolution);
    }
    await this.workerStrategy.processEvents(convertedEvents);
  }

  private async handleReorg(): Promise<number> {
    const reorgStartingBlock = await this.findLastMatchingBlock();
    await WorkerStatus.saveWorkerStatus(
      this.blockchain,
      reorgStartingBlock.blockNumber,
      reorgStartingBlock.blockHash,
      undefined,
    );

    const cleanUp = await this.workerRepository.cleanUpEvents(
      reorgStartingBlock.blockNumber,
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
    const latestMirrored = await this.workerRepository.getLatestMirroredBlock();
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
  private async saveEvents(events: Event[]): Promise<void> {
    const preparedEvents: CnsRegistryEvent[] = [];
    for (const event of events) {
      const values: Record<string, string> = {};
      Object.entries(event?.args || []).forEach(([key, value]) => {
        values[key] = BigNumber.isBigNumber(value)
          ? value.toHexString()
          : value;
      });
      const contractAddress = event.address.toLowerCase();
      preparedEvents.push(
        this.workerRepository.create(CnsRegistryEvent, {
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
        }),
      );
    }
    await this.workerRepository.save(preparedEvents);
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
          this.currentSyncBlock + this.config.BLOCK_FETCH_LIMIT,
          toBlock,
        );

        const events = await this.workerStrategy.getEvents(
          this.currentSyncBlock + 1,
          fetchBlock,
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

        await WorkerRepository.commitTransaction(this.blockchain);
      }
    } catch (error) {
      this.logger.error(error);
      await WorkerRepository.rollbackTransaction(this.blockchain);
    }
  }

  public async resync(): Promise<void> {
    try {
      this.workerRepository = await WorkerRepository.startTransaction(
        this.blockchain,
        this.networkId,
      );

      if (this.config.RESYNC_FROM === undefined) {
        return;
      }
      const latestMirrored =
        await this.workerRepository.getLatestMirroredBlock();
      this.logger.info(
        `Latest mirrored block ${latestMirrored}. Resync requested from block ${this.config.RESYNC_FROM}.`,
      );
      const netBlock = await this.workerStrategy.getBlock(
        this.config.RESYNC_FROM,
      );

      let cleanUp = 0;

      await this.workerRepository.saveLastMirroredBlock(
        this.config.RESYNC_FROM,
        netBlock.blockHash,
      );

      ({ deleted: cleanUp } = await this.workerRepository.cleanUpEvents(
        this.config.RESYNC_FROM,
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
