import {
  IsNumber,
  IsObject,
  IsString,
  Matches,
  Min,
  ValidateIf,
  IsOptional,
} from 'class-validator';
import { Column, Entity, Index, MoreThan, Not, Repository } from 'typeorm';
import ValidateWith from '../services/ValidateWith';
import { Attributes, DomainOperationTypes } from '../types/common';
import Model from './Model';
import { BigNumber } from '@ethersproject/bignumber';
import { Blockchain } from '../types/common';
import { tokenIdToNode } from '../utils/domain';

@Entity({ name: 'cns_registry_events' })
@Index(['blockNumber', 'blockchain', 'networkId', 'logIndex'], { unique: true })
@Index(['type', 'blockchain', 'blockNumber', 'node'])
export default class CnsRegistryEvent extends Model {
  @Column('text')
  contractAddress: string;

  @Column({ type: 'text' })
  @Index()
  type: string;

  @IsString()
  @Column({ type: 'text' })
  @Index()
  blockchain: keyof typeof Blockchain;

  @IsNumber()
  @Column('int')
  networkId: number;

  @IsNumber()
  @ValidateWith<CnsRegistryEvent>('blockNumberIncreases')
  @Column({ type: 'int' })
  @Index()
  blockNumber = 0;

  @IsOptional()
  @Matches(/0x[0-9a-f]+/)
  @Column({ type: 'text', nullable: true })
  blockHash: string | null = null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateWith<CnsRegistryEvent>('logIndexForBlockIncreases')
  @Column({ type: 'int', nullable: true })
  logIndex: number | null = null;

  @IsOptional()
  @IsString()
  @Matches(/0x[0-9a-f]+/)
  @ValidateWith<CnsRegistryEvent>('consistentBlockNumberForHash')
  @Column({ type: 'text', nullable: true })
  @Index()
  transactionHash: string | null = null;

  @IsObject()
  @Column({ type: 'json' })
  returnValues: Record<string, string> = {};

  @IsOptional()
  @ValidateIf((e) => e.domainOperation())
  @IsString()
  @Matches(/0x[0-9a-f]+/)
  @Column({ type: 'text', nullable: true })
  @Index()
  node: string | null = null;

  private validationRepository?: Repository<CnsRegistryEvent>;

  constructor(
    attributes?: Attributes<CnsRegistryEvent>,
    validationRepository?: Repository<CnsRegistryEvent>,
  ) {
    super();
    this.attributes<CnsRegistryEvent>(attributes);
    this.validationRepository = validationRepository;
  }

  async blockNumberIncreases(): Promise<boolean> {
    if (this.validationRepository) {
      if (this.validationRepository?.hasId(this)) {
        return true;
      }
      return !(await this.validationRepository.findOne({
        blockchain: this.blockchain,
        networkId: this.networkId,
        blockNumber: MoreThan(this.blockNumber),
      }));
    } else {
      // use default repositories so typeorm doesn't make extra txes
      if (this.hasId()) {
        return true;
      }
      return !(await CnsRegistryEvent.findOne({
        blockchain: this.blockchain,
        networkId: this.networkId,
        blockNumber: MoreThan(this.blockNumber),
      }));
    }
  }

  async logIndexForBlockIncreases(): Promise<boolean> {
    if (this.validationRepository) {
      return !(await this.validationRepository.findOne({
        blockchain: this.blockchain,
        networkId: this.networkId,
        blockNumber: this.blockNumber,
        logIndex: MoreThan(this.logIndex),
      }));
    }
    return !(await CnsRegistryEvent.findOne({
      blockchain: this.blockchain,
      networkId: this.networkId,
      blockNumber: this.blockNumber,
      logIndex: MoreThan(this.logIndex),
    }));
  }

  domainOperation(): boolean {
    return this.type in DomainOperationTypes;
  }

  tokenId(): string | undefined {
    return this.returnValues.tokenId;
  }

  async beforeValidate(): Promise<void> {
    if (!this.node) {
      const tokenId = this.tokenId();
      this.node = tokenId ? tokenIdToNode(BigNumber.from(tokenId)) : null;
    }
  }

  async consistentBlockNumberForHash(): Promise<boolean> {
    const inconsistentEvent = await CnsRegistryEvent.findOne({
      blockchain: this.blockchain,
      networkId: this.networkId,
      transactionHash: this.transactionHash,
      blockNumber: Not(this.blockNumber),
    });
    return !inconsistentEvent;
  }

  toObject(): Partial<CnsRegistryEvent> {
    return {
      blockNumber: this.blockNumber,
      blockHash: this.blockHash,
      logIndex: this.logIndex,
      transactionHash: this.transactionHash,
      returnValues: this.returnValues,
      node: this.node,
      contractAddress: this.contractAddress,
      type: this.type,
      blockchain: this.blockchain,
      networkId: this.networkId,
    };
  }

  static async latestEventBlocks(
    count: number,
    blockchain: Blockchain,
    networkId: number,
    repository: Repository<CnsRegistryEvent> = this.getRepository(),
  ): Promise<{ blockNumber: number; blockHash: string }[]> {
    const res = await repository
      .createQueryBuilder()
      .select('block_number, block_hash')
      .where('blockchain = :blockchain', { blockchain })
      .andWhere('network_id = :networkId', { networkId })
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

  static async cleanUpEvents(
    block: number,
    blockchain: Blockchain,
    networkId: number,
    repository: Repository<CnsRegistryEvent> = this.getRepository(),
  ): Promise<{ deleted: number; affected: Set<string> }> {
    const eventsToDelete = await repository.find({
      where: { blockNumber: MoreThan(block), blockchain, networkId },
    });
    const affectedTokenIds = new Set<string>();
    for (const event of eventsToDelete) {
      affectedTokenIds.add(event.returnValues['tokenId']);
    }
    await repository.remove(eventsToDelete);
    return { deleted: eventsToDelete.length, affected: affectedTokenIds };
  }
}
