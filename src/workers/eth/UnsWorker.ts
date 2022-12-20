import { Contract, Event } from 'ethers';
import { IProvider } from '../workerFramework';
import { ETHContracts } from '../../contracts';
import { EthWorkerStrategy } from './EthWorkerStrategy';
import { DomainsResolution } from '../../models';

export class UNSProvider implements IProvider {}

export class UNSWorkerStrategy extends EthWorkerStrategy {
  registry: Contract;

  constructor() {
    super();
    this.registry = ETHContracts.UNSRegistry.getContract();
  }

  protected setResolutionAddresses(
    resolution: DomainsResolution,
    event: Event,
  ) {
    const contractAddress = event.address.toLowerCase();
    resolution.resolver = contractAddress;
    resolution.registry = this.registry.address.toLowerCase();
  }
}
