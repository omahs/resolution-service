import { cond } from 'lodash';
import {
  EntityManager,
  EntityTarget,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  FindOptionsUtils,
  getConnection,
  In,
  MoreThan,
  RemoveOptions,
  Repository,
  SaveOptions,
} from 'typeorm';
import {
  CnsRegistryEvent,
  Domain,
  DomainsResolution,
  DomainsReverseResolution,
  Model,
  WorkerStatus,
  ZnsTransaction,
} from '../../models';
import { Blockchain } from '../../types/common';
import { eip137Namehash, znsNamehash } from '../../utils/namehash';

// A db connection with its own manager and repositories
class WorkerRepositoryTxContext {
  manager: EntityManager;
  eventRepository: Repository<CnsRegistryEvent>;
  domainRepository: Repository<Domain>;
  domainResolutionRepository: Repository<DomainsResolution>;
  domainReverseRepository: Repository<DomainsReverseResolution>;
  workerStatusRepository: Repository<WorkerStatus>;
  znsTransactionRepository: Repository<ZnsTransaction>;
}

export class WorkerRepository {
  private blockchain: Blockchain;
  private networkId: number;
  private static txContexts: Record<
    Blockchain,
    WorkerRepositoryTxContext | undefined
  > = {
    ETH: undefined,
    ZIL: undefined,
    MATIC: undefined,
  };

  private constructor(blockchain: Blockchain, networkId: number) {
    this.blockchain = blockchain;
    this.networkId = networkId;
  }

  public get context(): WorkerRepositoryTxContext {
    const context = WorkerRepository.txContexts[this.blockchain];
    if (!context) {
      throw Error('transaction closed');
    }
    return context;
  }

  // generic save/remove/find methods
  public async remove<T extends Model>(
    entity: T,
    options?: RemoveOptions | undefined,
  ) {
    return this.context.manager.remove(entity, options);
  }

  public async save<T extends Model>(
    entity: T | T[],
    options?: SaveOptions | undefined,
  ) {
    return this.context.manager.save(entity, options);
  }

  public async findOne<T extends Model>(
    entity: EntityTarget<T>,
    conditions?: FindConditions<T> | undefined,
    options?: FindOneOptions<T> | undefined,
  ) {
    return this.context.manager.findOne(entity, conditions, options);
  }

  public async find<T extends Model>(
    entity: EntityTarget<T>,
    conditions?: FindConditions<T> | undefined,
  ): Promise<T[]>;
  public async find<T extends Model>(
    entity: EntityTarget<T>,
    options?: FindManyOptions<T> | undefined,
  ): Promise<T[]>;

  public async find<T extends Model>(
    entity: EntityTarget<T>,
    optionsOrConditions?: FindConditions<T> | FindManyOptions<T>,
  ) {
    if (FindOptionsUtils.isFindManyOptions(optionsOrConditions)) {
      return this.context.manager.find(entity, optionsOrConditions);
    } else {
      return this.context.manager.find(
        entity,
        optionsOrConditions as FindConditions<T>,
      );
    }
  }

  // specific methods with custom logic
  // eventRepository
  public async cleanUpEvents(
    block: number,
  ): Promise<{ deleted: number; affected: Set<string> }> {
    const repository = this.context.eventRepository;
    const eventsToDelete = await repository.find({
      where: {
        blockNumber: MoreThan(block),
        blockchain: this.blockchain,
        networkId: this.networkId,
      },
    });
    const affectedTokenIds = new Set<string>();
    for (const event of eventsToDelete) {
      affectedTokenIds.add(event.returnValues['tokenId']);
    }
    await repository.remove(eventsToDelete);
    return { deleted: eventsToDelete.length, affected: affectedTokenIds };
  }

  public async latestEventBlocks(
    count: number,
  ): Promise<{ blockNumber: number; blockHash: string }[]> {
    const repository = this.context.eventRepository;
    const res = await repository
      .createQueryBuilder()
      .select('block_number, block_hash')
      .where('blockchain = :blockchain', { blockchain: this.blockchain })
      .andWhere('network_id = :networkId', { networkId: this.networkId })
      .groupBy('block_number, block_hash')
      .orderBy('block_number', 'DESC')
      .limit(count)
      .getRawMany();
    return res
      .map((value) => {
        return {
          blockNumber: value?.block_number as number,
          blockHash: value?.block_hash as string,
        };
      })
      .reverse();
  }

  // domain repository
  public async findAllByNodes(nodes: string[]): Promise<Domain[]> {
    if (!nodes.length) {
      return [];
    }

    return this.context.domainRepository.find({
      where: { node: In(nodes) },
      relations: ['resolutions', 'parent'],
    });
  }

  public async findByNode(node?: string): Promise<Domain | undefined> {
    return node
      ? await this.context.domainRepository.findOne({
          where: { node },
          relations: ['resolutions', 'reverseResolutions', 'parent'],
        })
      : undefined;
  }

  public async findOrBuildByNode(node: string): Promise<Domain> {
    return (
      (await this.context.domainRepository.findOne({
        where: { node },
        relations: ['resolutions', 'reverseResolutions', 'parent'],
      })) || new Domain({ node }, this.context.domainRepository)
    );
  }

  public async findOrCreateByName(name: string): Promise<Domain> {
    const domain = await this.context.domainRepository.findOne({
      where: { name },
      relations: ['resolutions', 'reverseResolutions', 'parent'],
    });
    if (domain) {
      return domain;
    }

    const node =
      this.blockchain === Blockchain.ZIL
        ? znsNamehash(name)
        : eip137Namehash(name);

    const newDomain = new Domain(
      {
        name: name,
        node: node,
      },
      this.context.domainRepository,
    );
    await this.context.domainRepository.save(newDomain);
    return newDomain;
  }

  // private methods
  private getEventRepository() {
    switch (this.blockchain) {
      case Blockchain.ETH:
      case Blockchain.MATIC:
        return this.context.eventRepository;
      case Blockchain.ZIL:
        return this.context.znsTransactionRepository;
    }
  }

  // static tx management methods
  public static getRepository(blockchain: Blockchain, networkId: number) {
    if (!WorkerRepository.txContexts[blockchain]) {
      const context: WorkerRepositoryTxContext =
        new WorkerRepositoryTxContext(); // = txContexts
      context.manager = getConnection().createQueryRunner().manager;
      context.eventRepository = context.manager.getRepository(CnsRegistryEvent);
      context.domainRepository = context.manager.getRepository(Domain);
      context.domainResolutionRepository =
        context.manager.getRepository(DomainsResolution);
      context.domainReverseRepository = context.manager.getRepository(
        DomainsReverseResolution,
      );
      context.workerStatusRepository =
        context.manager.getRepository(WorkerStatus);
      WorkerRepository.txContexts[blockchain] = context;
    }
    return new WorkerRepository(blockchain, networkId);
  }

  public static async startTransaction(
    blockchain: Blockchain,
    networkId: number,
  ): Promise<WorkerRepository> {
    if (!WorkerRepository.txContexts[blockchain]) {
      const context: WorkerRepositoryTxContext =
        new WorkerRepositoryTxContext(); // = txContexts
      context.manager = getConnection().createQueryRunner().manager;
      context.eventRepository = context.manager.getRepository(CnsRegistryEvent);
      context.domainRepository = context.manager.getRepository(Domain);
      context.domainResolutionRepository =
        context.manager.getRepository(DomainsResolution);
      context.domainReverseRepository = context.manager.getRepository(
        DomainsReverseResolution,
      );
      context.workerStatusRepository =
        context.manager.getRepository(WorkerStatus);

      await context.manager.queryRunner?.startTransaction('REPEATABLE READ');
      await WorkerStatus.lockBlockchainStatus(blockchain, context.manager);
      WorkerRepository.txContexts[blockchain] = context;
    }
    return new WorkerRepository(blockchain, networkId);
  }

  public static async commitTransaction(blockchain: Blockchain): Promise<void> {
    const context = WorkerRepository.txContexts[blockchain];
    try {
      await context?.manager.queryRunner?.commitTransaction();
    } finally {
      await context?.manager.release();
      WorkerRepository.txContexts[blockchain] = undefined;
    }
  }

  public static async rollbackTransaction(
    blockchain: Blockchain,
  ): Promise<void> {
    const context = WorkerRepository.txContexts[blockchain];
    try {
      await context?.manager.queryRunner?.rollbackTransaction();
    } finally {
      await context?.manager.release();
      WorkerRepository.txContexts[blockchain] = undefined;
    }
  }
}
