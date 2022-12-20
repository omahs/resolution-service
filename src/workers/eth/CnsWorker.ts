import { Contract, Event } from 'ethers';
import { ETHContracts } from '../../contracts';
import { EthProvider, EthWorkerStrategy } from './EthWorkerStrategy';
import { DomainsResolution } from '../../models';

export class CNSProvider extends EthProvider {}

export class CNSWorkerStrategy extends EthWorkerStrategy {
  registry: Contract;

  constructor() {
    super();
    this.registry = ETHContracts.CNSRegistry.getContract();
  }

  protected setResolutionAddresses(
    resolution: DomainsResolution,
    event: Event,
  ) {
    resolution.ownerAddress = event.args?.to?.toLowerCase();
    resolution.registry = this.registry.address;
  }
}
