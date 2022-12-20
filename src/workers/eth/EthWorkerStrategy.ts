import { Contract, Event } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import { eip137Namehash } from '../../utils/namehash';

import { EthUpdaterError } from '../../errors/EthUpdaterError';
import { Domain, DomainsResolution } from '../../models';
import { unwrap } from '../../utils/option';
import { cacheSocialPictureInCDN } from '../../utils/socialPicture';

import {
  IWorkerStrategy,
  IEvent,
  UNNAMED_EVENT,
  IProvider,
} from '../workerFramework';

const tokenIdToNode = (tokenId: BigNumber): string => {
  const node = tokenId.toHexString().replace(/^(0x)?/, '');
  return '0x' + node.padStart(64, '0');
};

export class EthProvider implements IProvider {
  startingBlock: number;
  networkId: number;
  confirmationBlocks: number;
  rpcURL: string;
  recordsPerPage: number;
  fetchInterval: number;
  maxReOrgSize: number;
  acceptableDelayInBlocks: number;
  resyncFrom = 0;
}

export class EthWorkerStrategy implements IWorkerStrategy {
  registry: Contract;

  async getEvents(fromBlock: number, toBlock: number): Promise<IEvent[]> {
    const events = await this.registry.queryFilter({}, fromBlock, toBlock);

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

    return events.map((event: Event) => {
      return {
        type: event.event || UNNAMED_EVENT,
        data: event,
      };
    });
  }

  async handleEvent(event: IEvent): Promise<void> {
    switch (event.type) {
      case 'Transfer': {
        await this.processTransfer(event.data);
        break;
      }
      case 'NewURI': {
        await this.processNewUri(event.data);
        break;
      }
      case 'ResetRecords': {
        await this.processResetRecords(event.data);
        break;
      }
      case 'Set': {
        await this.processSet(event.data);
        break;
      }
      case 'Resolve': {
        await this.processResolve(event.data);
        break;
      }
      case 'Sync': {
        await this.processSync(event.data);
        break;
      }
      case 'SetReverse': {
        await this.processSetReverse(event.data);
        break;
      }
      case 'RemoveReverse': {
        await this.processRemoveReverse(event.data);
        break;
      }
      case 'Approval':
      case 'ApprovalForAll':
      default:
        break;
    }
  }

  protected setResolutionAddresses(
    resolution: DomainsResolution,
    event: Event,
  ) {}

  private async processTransfer(event: Event): Promise<void> {
    const node = tokenIdToNode(event.args?.tokenId);
    const domain = await Domain.findByNode(node, domainRepository);

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

      this.setResolutionAddresses(resolution, event);

      domain.setResolution(resolution); // create resolution for L2
      await domainRepository.save(domain);
    }
  }

  private async processNewUri(
    event: Event,
    lastProcessedEvent: Event,
  ): Promise<void> {
    if (!event.args) {
      throw new EthUpdaterError(
        `NewUri event wasn't processed. Invalid event args.`,
      );
    }

    const { uri, tokenId } = event.args;
    const expectedNode = eip137Namehash(uri);
    const producedNode = tokenIdToNode(tokenId);

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

    this.setResolutionAddresses(resolution, event);
    domain.setResolution(resolution);
    await domainRepository.save(domain);
  }

  private async processResetRecords(event: Event): Promise<void> {
    const node = tokenIdToNode(event.args?.tokenId);
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

  private async processSet(event: Event): Promise<void> {
    const args = unwrap(event.args);
    // For some reason ethers got a problem with assigning names for this event.
    const [, , , key, value] = args;
    const tokenId = args[0];
    const node = tokenIdToNode(tokenId);
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

  private async processResolve(event: Event): Promise<void> {}

  private async processSync(event: Event): Promise<void> {
    return Promise.resolve();
  }

  private async processSetReverse(event: Event): Promise<void> {
    return Promise.resolve();
  }

  private async processRemoveReverse(event: Event): Promise<void> {
    return Promise.resolve();
  }
}
