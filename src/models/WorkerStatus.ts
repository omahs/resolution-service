import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import {
  Column,
  Entity,
  EntityManager,
  Index,
  Repository,
  Unique,
} from 'typeorm';
import { Attributes, Blockchain } from '../types/common';
import Model from './Model';

@Entity({ name: 'resolution_worker_status' })
export default class WorkerStatus extends Model {
  @IsEnum(Blockchain)
  @Column('text')
  @Index({ unique: true })
  location: Blockchain;

  @IsNumber()
  @Column({ type: 'int' })
  lastMirroredBlockNumber = 0;

  @IsOptional()
  @Column({ type: 'text', nullable: true })
  lastMirroredBlockHash?: string = undefined;

  @IsOptional()
  @IsNumber()
  @Column({ type: 'int', nullable: true })
  @ValidateWith<WorkerStatus>('lastAtxuidIncreases', {
    message: 'the value of lastAtxuid should increase',
  })
  lastAtxuid?: number = undefined;

  constructor(attributes?: Attributes<WorkerStatus>) {
    super();
    this.attributes<WorkerStatus>(attributes);
  }

  async lastAtxuidIncreases(): Promise<boolean> {
    const previousAtxuid = await WorkerStatus.latestAtxuidForWorker(
      this.location,
    );
    if (previousAtxuid === undefined) {
      return true;
    }
    return this.lastAtxuid === undefined
      ? false
      : previousAtxuid <= this.lastAtxuid;
  }

  static async latestMirroredBlockForWorker(
    location: Blockchain,
    repository: Repository<WorkerStatus> = WorkerStatus.getRepository(),
  ): Promise<number> {
    const status = await repository.findOne({ location });
    return status ? status.lastMirroredBlockNumber : 0;
  }

  static async latestMirroredBlockHashForWorker(
    location: Blockchain,
    repository: Repository<WorkerStatus> = WorkerStatus.getRepository(),
  ): Promise<string | undefined> {
    const status = await repository.findOne({ location });
    return status?.lastMirroredBlockHash;
  }

  static async latestAtxuidForWorker(
    location: Blockchain,
    repository: Repository<WorkerStatus> = WorkerStatus.getRepository(),
  ): Promise<number | undefined> {
    const status = await repository.findOne({ location });
    return status?.lastAtxuid;
  }

  static async saveWorkerStatus(
    location: Blockchain,
    latestBlock: number,
    latestBlockHash?: string,
    lastAtxuid?: number,
    repository: Repository<WorkerStatus> = WorkerStatus.getRepository(),
  ): Promise<void> {
    let workerStatus = await repository.findOne({ location });
    if (workerStatus === undefined) {
      workerStatus = new WorkerStatus({
        location,
      });
    }
    workerStatus.lastMirroredBlockNumber = latestBlock;
    workerStatus.lastMirroredBlockHash = latestBlockHash;
    workerStatus.lastAtxuid = lastAtxuid;
    await repository.save(workerStatus);
  }

  static async lockBlockchainStatus(
    location: Blockchain,
    manager: EntityManager,
  ): Promise<void> {
    await manager.query(
      `LOCK TABLE resolution_worker_status IN ROW EXCLUSIVE MODE`,
    );
    await manager.query(
      `SELECT * FROM resolution_worker_status WHERE location = '${location}' FOR UPDATE NOWAIT`,
    );
  }
}
