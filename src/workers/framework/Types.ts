import { Blockchain } from '../../types/common';

// helpers
export type Block = {
  blockNumber: number;
  blockHash?: string;
};

export type WorkerConfig = {
  /**
   * determines whether the worker should check and handle blockchain reorgs
   */
  handleReorgs: boolean;
  /**
   * sets how many blocks to check at one time to avoid running into provider limits
   */
  blockFetchLimit: number;
  /**
   * sets the block height from which to start looking for events
   */
  eventsStartingBlock: number;
  /**
   * sets the maximum reorg size in blocks which may be handled by the worker
   */
  maxReorgSize: number;
  /**
   * blockchain network id
   */
  networkId: number;
  /**
   * blockchain type
   */
  blockchain: Blockchain;
};

// entities
export type EventSource = {
  blockchain?: keyof typeof Blockchain;
  networkId?: number;
  blockNumber?: number;
  attributes?: Record<string, string | number | null>;
};

export class WorkerEvent {
  // namehash of related domain
  node?: string | null;
  // event type
  type?: string;
  // event source
  source?: EventSource;
  // parsed event args
  args?: Record<string, string>;
  // for raw provider-specific event objects
  innerEvent?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export class Domain {
  static NullAddress = '0x0000000000000000000000000000000000000000';
  // human-readable domain name
  name?: string;
  // human-readable domain label (first part before `.` e.g. label.tld)
  label?: string;
  // eip137Namehash or other NS-appropriate namehash
  node: string;
  // eip137Namehash or other NS-appropriate namehash of parent domain
  parentNode?: string;
}

export class Resolution {
  // eip137Namehash or other NS-appropriate namehash of the domain
  node: string;
  // Blockchain id of resolution
  blockchain: Blockchain;
  // Network id of resolution
  networkId: number;
  ownerAddress?: string | null = null;
  resolver?: string | null = null;
  registry?: string | null = null;
  resolution?: Record<string, string> = undefined;

  get updated(): boolean {
    return !(
      this.ownerAddress === undefined &&
      this.resolver === undefined &&
      this.registry === undefined &&
      this.resolution &&
      Object.keys(this.resolution).length == 0
    );
  }

  constructor({
    node,
    blockchain,
    networkId,
    ownerAddress,
    resolver,
    registry,
    resolution = {},
  }: {
    node: string;
    blockchain: Blockchain;
    networkId: number;
    ownerAddress?: string | null;
    resolver?: string | null;
    registry?: string | null;
    resolution?: Record<string, string>;
  }) {
    this.node = node;
    this.blockchain = blockchain;
    this.networkId = networkId;
    this.ownerAddress = ownerAddress;
    this.resolver = resolver;
    this.registry = registry;
    this.resolution = resolution;
  }
}

export class ReverseResolution {
  // Blockchain id of resolution
  blockchain: Blockchain;
  // Network id of resolution
  networkId: number;
  // Address of reverse resolution
  reverseAddress?: string;
  // eip137Namehash or other NS-appropriate namehash of the domain
  node?: string;
}
