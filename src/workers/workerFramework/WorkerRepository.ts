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
import { Attributes, Blockchain } from '../../types/common';
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

  private get context(): WorkerRepositoryTxContext {
    const context = WorkerRepository.txContexts[this.blockchain];
    if (!context) {
      throw Error('transaction closed');
    }
    return context;
  }

  // generic save/remove/find methods
  public create<T extends Model>(
    type:
      | { new (a: Attributes<T> | undefined): T }
      | { new (a: Attributes<T> | undefined, r: Repository<T> | undefined): T },
    attributes?: Attributes<T>,
  ) {
    return new type(attributes, this.context.manager.getRepository(type));
  }

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
    return CnsRegistryEvent.cleanUpEvents(
      block,
      this.blockchain,
      this.networkId,
      repository,
    );
  }

  public async latestEventBlocks(
    count: number,
  ): Promise<{ blockNumber: number; blockHash: string }[]> {
    const repository = this.context.eventRepository;
    return CnsRegistryEvent.latestEventBlocks(
      count,
      this.blockchain,
      this.networkId,
      repository,
    );
  }

  // domain repository
  public async findAllByNodes(nodes: string[]): Promise<Domain[]> {
    return Domain.findAllByNodes(nodes, this.context.domainRepository);
  }

  public async findByNode(node?: string): Promise<Domain | undefined> {
    return Domain.findByNode(node, this.context.domainRepository);
  }

  public async findOrBuildByNode(node: string): Promise<Domain> {
    return Domain.findOrBuildByNode(node, this.context.domainRepository);
  }

  public async findOrCreateByName(name: string): Promise<Domain> {
    return Domain.findOrCreateByName(
      name,
      this.blockchain,
      this.context.domainRepository,
    );
  }

  // worker status
  public getLatestMirroredBlock(): Promise<number> {
    return WorkerStatus.latestMirroredBlockForWorker(
      this.blockchain,
      this.context.workerStatusRepository,
    );
  }

  public getLatestMirroredBlockHash(): Promise<string | undefined> {
    return WorkerStatus.latestMirroredBlockHashForWorker(
      this.blockchain,
      this.context.workerStatusRepository,
    );
  }

  public saveLastMirroredBlock(
    currentSyncBlock: number,
    currentSyncBlockHash: string,
  ) {
    return WorkerStatus.saveWorkerStatus(
      this.blockchain,
      currentSyncBlock,
      currentSyncBlockHash,
      undefined,
      this.context.workerStatusRepository,
    );
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
