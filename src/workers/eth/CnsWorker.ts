import { Contract } from 'ethers';
import { ETHContracts } from '../../contracts';
import { EthProvider, EthWorkerStrategy } from './EthWorkerStrategy';

export class CNSProvider extends EthProvider {}

export class CNSWorkerStrategy extends EthWorkerStrategy {
  registry: Contract;

  constructor() {
    super();
    this.registry = ETHContracts.CNSRegistry.getContract();
  }
}
