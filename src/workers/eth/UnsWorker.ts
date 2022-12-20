import { Contract } from 'ethers';
import { IProvider } from '../workerFramework';
import { ETHContracts } from '../../contracts';
import { EthWorkerStrategy } from './EthWorkerStrategy';

export class UNSProvider implements IProvider {}

export class UNSWorkerStrategy extends EthWorkerStrategy {
  registry: Contract;

  constructor() {
    super();
    this.registry = ETHContracts.UNSRegistry.getContract();
  }
}
