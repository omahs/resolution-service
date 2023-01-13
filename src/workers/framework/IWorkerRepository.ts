import { Domain, Resolution, ReverseResolution } from './Types';

/**
 * Repository used for saving domain and resolution data.
 * Use `getWorkerRepository` to get an instance of the WorkerRepository for a specific blockchain network.
 */
export abstract class IWorkerRepository {
  /**
   * Upserts a domain or a list of domains.
   * Only saves domains with a specified `name` or `label` and `parentNode`.
   * @param domain domains to save or update.
   */
  abstract saveDomains(domain: Domain | Domain[]): Promise<void>;

  /**
   * Upserts a domain resolution or a list of resolutions.
   * Only changes resolutions with `Resolution.updated === true`.
   * @param resolution resolutions to save or update.
   */
  abstract saveResolutions(
    resolution: Resolution | Resolution[],
  ): Promise<void>;

  /**
   * Upserts a reverse resolution or a list of reverse resolutions.
   * @param resolution reverse resolutions to save or update.
   */
  abstract saveReverseResolutions(
    reverseResolution: ReverseResolution | ReverseResolution[],
  ): Promise<void>;

  /**
   * Removes a reverse resolution or a list of reverse resolutions.
   * @param resolution reverse resolutions to remove.
   */
  abstract removeReverseResolutions(
    reverseResolution: ReverseResolution | ReverseResolution[],
  ): Promise<void>;
}
