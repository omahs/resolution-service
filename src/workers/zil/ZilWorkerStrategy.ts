import { isBech32 } from '@zilliqa-js/util/dist/validation';
import { fromBech32Address } from '@zilliqa-js/crypto';
import { WorkerLogger } from '../../logger';
import { ConfiguredEvent, NewDomainEvent } from '../../models/ZnsTransaction';
import { Blockchain } from '../../types/common';
import {
  Block,
  Domain,
  WorkerEvent,
  getWorkerRepository,
  IWorkerStrategy,
  WorkerRepository,
  Resolution,
} from '../workerFramework';
import ZnsProvider from './ZilProvider';
import { znsChildhash } from '../../utils/namehash';

export class ZNSWorkerStrategy implements IWorkerStrategy {
  workerRepository: WorkerRepository;
  logger = WorkerLogger(Blockchain.ZIL);
  provider: ZnsProvider;
  blockchain: Blockchain;
  networkId: number;
  perPage: number;

  constructor(networkId: number, perPage = 25) {
    this.workerRepository = getWorkerRepository(Blockchain.ZIL, networkId);
    this.provider = new ZnsProvider();
    this.perPage = perPage;
    this.blockchain = Blockchain.ZIL;
    this.networkId = networkId;
  }

  public async getLatestNetworkBlock(fromBlock: number): Promise<Block> {
    const projectedToBlock = fromBlock + this.perPage - 1;
    const transactions = await this.provider.getLatestTransactions(
      fromBlock,
      projectedToBlock,
    );

    return {
      blockNumber: transactions[transactions.length - 1].atxuid,
    };
  }

  public async getBlock(blockNumber: number): Promise<Block> {
    return {
      blockNumber,
    };
  }

  public async getEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<WorkerEvent[]> {
    const transactions = await this.provider.getLatestTransactions(
      fromBlock,
      toBlock,
    );
    const events: WorkerEvent[] = [];
    for (const tx of transactions) {
      const txEvents = tx.events;
      txEvents.reverse();
      const baseEvent = {
        source: {
          blockchain: Blockchain.ZIL,
          networkId: this.networkId,
          blockNumber: tx.blockNumber,
          attributes: {
            transactionHash: tx.hash,
            atxuid: tx.atxuid,
          },
        },
        innerEvent: tx,
      };
      if (txEvents.length === 0) {
        events.push(baseEvent);
      }
      for (const event of txEvents) {
        const params = event.params as Record<string, string>;
        events.push({
          ...baseEvent,
          node:
            params['node'] ||
            (params['label'] && params['parent']
              ? znsChildhash(params['label'], params['parent'])
              : undefined),
          type: event.name,
          args: params,
        });
      }
    }
    return events;
  }

  public async processEvents(events: Event[]): Promise<void> {
    for (const event of events) {
      try {
        await this.processTransactionEvent(event);
      } catch (error) {
        this.logger.error(`Failed to process event. ${JSON.stringify(event)}`);
        this.logger.error(error);
      }
    }
  }

  private async processTransactionEvent(event: WorkerEvent): Promise<void> {
    const zilEvent = { name: event.type, params: event.args };
    this.logger.info(
      `Processing event: type - '${event.type}'; args - ${JSON.stringify(
        event.args,
      )}`,
    );
    switch (event.type) {
      case 'NewDomain': {
        await this.parseNewDomainEvent(zilEvent as NewDomainEvent);
        break;
      }
      case 'Configured': {
        await this.parseConfiguredEvent(zilEvent as ConfiguredEvent);
        break;
      }
    }
  }

  private async parseNewDomainEvent(event: NewDomainEvent): Promise<void> {
    const { label, parent } = event.params;
    if (this.isInvalidLabel(label)) {
      throw new Error(
        `Invalid domain label ${label} at NewDomain event for ${parent}`,
      );
    }
    const node = znsChildhash(parent, label);
    const domain: Domain = {
      node,
      label,
      parentNode: parent,
    };
    await this.workerRepository.saveDomains(domain);
    const resolution = new Resolution({
      node,
      blockchain: this.blockchain,
      networkId: this.networkId,
      registry: this.provider.registryAddress,
    });
    await this.workerRepository.saveResolutions(resolution);
  }

  private async parseConfiguredEvent(event: ConfiguredEvent): Promise<void> {
    const eventParams = event.params;
    const { node } = event.params;
    const owner = isBech32(eventParams.owner)
      ? fromBech32Address(eventParams.owner).toLowerCase()
      : eventParams.owner;
    const resolver = isBech32(eventParams.resolver)
      ? fromBech32Address(eventParams.resolver).toLowerCase()
      : eventParams.resolver;
    if (node.match(/^0x[a-f0-9]{64}$/)) {
      const resolution = await this.provider.requestZilliqaResolutionFor(
        resolver,
      );
      const dbResolution = new Resolution({
        node,
        blockchain: this.blockchain,
        networkId: this.networkId,
        resolver: resolver !== Domain.NullAddress ? resolver : null,
        registry:
          owner !== Domain.NullAddress ? this.provider.registryAddress : null,
        ownerAddress: owner,
        resolution: resolution,
      });
      await this.workerRepository.saveResolutions(dbResolution);
    }
  }

  private isInvalidLabel(label: string | undefined) {
    return !label || label.includes('.') || !!label.match(/[A-Z]/);
  }
}
