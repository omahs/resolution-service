import { Blockchain } from '../../types/common';
import { Domain, Resolution, ReverseResolution } from './Types';
import { WorkerRepository } from './WorkerRepository';

// public interface of the worker repository
export abstract class IWorkerRepository {
  abstract saveDomains(domain: Domain | Domain[]): Promise<void>;

  abstract saveResolutions(
    resolution: Resolution | Resolution[],
  ): Promise<void>;

  abstract saveReverseResolutions(
    reverseResolution: ReverseResolution | ReverseResolution[],
  ): Promise<void>;

  abstract removeReverseResolutions(
    reverseResolution: ReverseResolution | ReverseResolution[],
  ): Promise<void>;
}

export function getWorkerRepository(
  blockchain: Blockchain,
  networkId: number,
): IWorkerRepository {
  return WorkerRepository.getRepository(blockchain, networkId);
}
