import {
  Column,
  Entity,
  In,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Repository,
} from 'typeorm';
import { IsOptional, IsString, Matches } from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import { Model } from '.';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import { Attributes } from '../types/common';
import punycode from 'punycode';
import DomainsResolution from './DomainsResolution';
import { Blockchain } from '../types/common';
import { queryNewURIEvent } from '../utils/ethersUtils';
import { logger } from '../logger';
import DomainsReverseResolution from './DomainsReverseResolution';
import { env } from '../env';
import { tokenIdToNode } from '../utils/domain';

const ON_CHAIN_LOG_PREFIX = 'On Chain Data Lookup';

@Entity({ name: 'domains' })
export default class Domain extends Model {
  static NullAddress = '0x0000000000000000000000000000000000000000';

  @IsString()
  @ValidateWith<Domain>('nameMatchesNode', {
    message: "Node doesn't match the name",
  })
  @Index({ unique: false })
  @Column('text')
  name: string;

  @Matches(/^0x[a-f0-9]{64}$/)
  @Index({ unique: true })
  @Column('text')
  node: string;

  @IsOptional()
  @Index()
  @ManyToOne(() => Domain, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Domain | null;

  @OneToMany(() => Domain, (domain) => domain.parent)
  children: Domain[];

  @OneToMany(
    () => DomainsResolution,
    (domainResolution) => domainResolution.domain,
    {
      cascade: ['insert', 'update', 'remove'],
    },
  )
  resolutions: DomainsResolution[];

  @OneToMany(() => DomainsReverseResolution, (reverse) => reverse.domain, {
    cascade: ['insert', 'update', 'remove'],
    orphanedRowAction: 'delete',
  })
  reverseResolutions: DomainsReverseResolution[];

  private validationRepository?: Repository<Domain>;

  constructor(
    attributes?: Attributes<Domain>,
    validationRepository?: Repository<Domain>,
  ) {
    super();
    this.attributes<Domain>(attributes);
    this.validationRepository = validationRepository;
  }

  protected async beforeValidate(): Promise<void> {
    if (!this.parent) {
      this.parent = await this.setParent();
    }
  }

  private async setParent(): Promise<Domain | null> {
    const splittedName = this.getSplittedName();
    let parentName = splittedName[splittedName.length - 1];

    if (splittedName.length > 2) {
      splittedName.shift();
      parentName = splittedName.join('.');
    }

    const parent = this.validationRepository
      ? (await this.validationRepository.findOne({ name: parentName })) || null
      : (await Domain.findOne({ name: parentName })) || null;

    return parent;
  }

  nameMatchesNode(): boolean {
    return (
      this.correctNode(Blockchain.ETH) === this.node ||
      this.correctNode(Blockchain.ZIL) === this.node
    );
  }

  /** TODO: Fix or rename label()
   * it should only return the label instead of everything but extension
   * it should return {label}.blah.crypto
   * currently returns {label.blah}.crypto
   **/
  get label(): string {
    const splittedName = this.getSplittedName();
    splittedName.pop();
    return splittedName.join('.');
  }

  get extension(): string {
    return this.getSplittedName().pop() || '';
  }

  get level(): number {
    return this.name.split('.').length;
  }

  get unicodeName(): string {
    return punycode.toUnicode(this.name);
  }

  get isUnicodeName(): boolean {
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u00ff]/.test(this.name);
  }

  get hasReverseResolution(): boolean {
    return this.reverseResolutions.length > 0;
  }

  static async getSubdomainCountByParentName(
    name: string,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<number> {
    return repository.count({
      where: { parent: { name } },
      relations: ['parent'],
      cache: env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME,
    });
  }

  static async findAllByNodes(
    nodes: string[],
    repository: Repository<Domain> = this.getRepository(),
    cache?: boolean,
  ): Promise<Domain[]> {
    if (!nodes.length) {
      return [];
    }

    return repository.find({
      where: { node: In(nodes) },
      relations: ['resolutions', 'parent'],
      cache: cache ? env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME : undefined,
    });
  }

  static async findByNode(
    node?: string,
    repository: Repository<Domain> = this.getRepository(),
    cache?: boolean,
  ): Promise<Domain | undefined> {
    return node
      ? await repository.findOne({
          where: { node },
          relations: ['resolutions', 'reverseResolutions', 'parent'],
          cache: cache ? env.CACHE.IN_MEMORY_CACHE_EXPIRATION_TIME : undefined,
        })
      : undefined;
  }

  static async findOrBuildByNode(
    node: string,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain> {
    return (
      (await repository.findOne({
        where: { node },
        relations: ['resolutions', 'reverseResolutions', 'parent'],
      })) || new Domain({ node }, repository)
    );
  }

  static async findOnChainNoSafe(token: string): Promise<Domain | undefined> {
    try {
      const newURIevent = await queryNewURIEvent(token);
      if (!newURIevent || !newURIevent.args) {
        return undefined;
      }

      const { uri, tokenId } = newURIevent.args;

      logger.info(
        `${ON_CHAIN_LOG_PREFIX} - Found new event for token ${token}`,
      );

      const expectedNode = eip137Namehash(uri);
      const producedNode = tokenIdToNode(tokenId);

      if (expectedNode !== producedNode) {
        return undefined;
      }

      const domain = new Domain({ node: producedNode });
      domain.name = uri;
      // we are not saving the domain on the db to make sure there is no race conditions between api and workers
      // domain will be parsed and stored by workers eventually
      return domain;
    } catch (error) {
      logger.error(
        `${ON_CHAIN_LOG_PREFIX} - Couldn't query NewURI event: ${error}`,
      );
      return undefined;
    }
  }

  private getSplittedName(): string[] {
    return this.name ? this.name.split('.') : [];
  }

  private correctNode(type: Blockchain): string | undefined {
    if (!this.name || this.name !== this.name.toLowerCase()) {
      return undefined;
    }
    if (type == Blockchain.ZIL) {
      return znsNamehash(this.name);
    }
    return eip137Namehash(this.name);
  }

  public getResolution(
    blockchain: Blockchain,
    networkId: number,
  ): DomainsResolution {
    let resolution = this.resolutions?.filter(
      (res) => res.blockchain === blockchain && res.networkId === networkId,
    )[0];
    if (resolution == undefined) {
      resolution = new DomainsResolution({
        blockchain,
        networkId,
      });
    }
    return resolution;
  }

  public setResolution(resolution: DomainsResolution): void {
    const otherResolutions = this.resolutions?.filter(
      (res) =>
        !(
          res.blockchain == resolution.blockchain &&
          res.networkId == resolution.networkId
        ),
    );
    if (otherResolutions) {
      this.resolutions = [resolution, ...otherResolutions];
    } else {
      this.resolutions = [resolution];
    }
  }

  public getReverseResolution(
    blockchain: Blockchain,
    networkId: number,
  ): DomainsReverseResolution | undefined {
    const reverse = this.reverseResolutions?.find(
      (res) => res.blockchain === blockchain && res.networkId === networkId,
    );
    return reverse;
  }

  public setReverseResolution(reverse: DomainsReverseResolution): void {
    const removed = this.removeReverseResolution(
      reverse.blockchain,
      reverse.networkId,
    );
    if (removed && !reverse.id) {
      reverse.id = removed.id; // set the id of removed element to help typeorm figure out how to update entities
    }
    if (this.reverseResolutions) {
      this.reverseResolutions.push(reverse);
    } else {
      this.reverseResolutions = [reverse];
    }
  }

  public removeReverseResolution(
    blockchain: Blockchain,
    networkId: number,
  ): DomainsReverseResolution | undefined {
    const removed = this.reverseResolutions?.find(
      (res) => res.blockchain == blockchain && res.networkId == networkId,
    );
    this.reverseResolutions = this.reverseResolutions?.filter(
      (res) => !(res.blockchain == blockchain && res.networkId == networkId),
    );
    return removed;
  }

  static async findOrCreateByName(
    name: string,
    blockchain: Blockchain,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain> {
    const domain = await repository.findOne({
      where: { name },
      relations: ['resolutions', 'reverseResolutions', 'parent'],
    });
    if (domain) {
      return domain;
    }

    const node =
      blockchain === Blockchain.ZIL
        ? znsNamehash(this.name)
        : eip137Namehash(name);

    const newDomain = new Domain(
      {
        name: name,
        node: node,
      },
      repository,
    );
    await repository.save(newDomain);
    return newDomain;
  }
}
