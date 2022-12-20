import { Contract, Event } from 'ethers';
import {
  IWorkerStrategy,
  IEvent,
  UNNAMED_EVENT,
  IProvider,
} from '../workerFramework';

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

  private async processTransfer(event: Event): Promise<void> {
    return Promise.resolve();
  }

  private async processNewUri(event: Event): Promise<void> {
    return Promise.resolve();
  }

  private async processResetRecords(event: Event): Promise<void> {
    return Promise.resolve();
  }

  private async processSet(event: Event): Promise<void> {
    return Promise.resolve();
  }

  private async processResolve(event: Event): Promise<void> {
    return Promise.resolve();
  }

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
