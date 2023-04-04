import { BatchLoader, CacheLoader } from 'batchloader';
import { env } from '../env';

class BatchingStats {
  n = 0;
  min: number = Number.MAX_VALUE;
  max: number = Number.MIN_VALUE;
  sum = 0;

  public update(num: number) {
    this.n++;
    this.min = this.min < num ? this.min : num;
    this.max = this.max > num ? this.max : num;
    this.sum += num;
  }

  public toJSON() {
    return {
      n: this.n,
      min: this.min,
      max: this.max,
      sum: this.sum,
      mean: this.sum / this.n,
    };
  }
}

export const batchingStats = new BatchingStats();

export type BatchFunction<KeyType, ValueType> = (
  keys: readonly KeyType[],
) => ValueType[] | Promise<ValueType[]>;
export type KeyFunction<KeyType, ValueType> = (val: ValueType) => KeyType;
export type KeyIdFunction<KeyType> = (key: KeyType) => string;

/**
 * Builds a batching loader which combines many `.load` operations into one call of `batchFunction`.
 * @param batchFunction function that performs batch loading
 * @param keyFunction function for deriving keys from values (value => value.key). Used for aligning output, to ensure that the right values are returned for the right keys.
 * @param options extra options:
 *  - keyToIdFunction - used to remove duplicate keys. By default, duplicates will not be removed.
 *  - maxBatchSize - specify the maximum batch size. By default, uses the `MAX_BATCH_SIZE` env variable.
 *  - cache - enables batching cache. By default, uses the `CACHING_ENABLED` env variable.
 *  - name - used for logging
 * @returns A batch loader instance.
 */
export function buildBatchLoader<KeyType, ValueType>(
  batchFunction: BatchFunction<KeyType, ValueType>,
  keyFunction: KeyFunction<KeyType, ValueType>,
  options?: {
    keyToIdFunction?: KeyIdFunction<KeyType>;
    maxBatchSize?: number;
    cache?: boolean;
    name?: string;
  },
):
  | BatchLoader<KeyType, ValueType | Error>
  | CacheLoader<KeyType, ValueType | Error> {
  const batchSize = env.APPLICATION.BATCHING.ENABLED
    ? options?.maxBatchSize || env.APPLICATION.BATCHING.MAX_BATCH_SIZE
    : 1;
  const loader = new BatchLoader<KeyType, ValueType | Error>(
    async (keys: readonly KeyType[]) => {
      const values = await batchFunction(keys);
      batchingStats.update(keys.length);
      return keys.map(
        (key) =>
          values.find((d) => keyFunction(d) === key) ||
          new Error(
            `${options?.name || 'BatchLoader'}: Failed to load key ${key}`,
          ),
      );
    },
    options?.keyToIdFunction || null,
    env.APPLICATION.BATCHING.TIMEOUT_MS,
    batchSize,
  );
  return options?.cache || env.APPLICATION.BATCHING.CACHING_ENABLED
    ? loader.cacheLoader()
    : loader;
}
